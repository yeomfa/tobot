import { isBlockStatement } from './types';
import type { NodeId, Statement } from './types';

/**
 * Every block statement stores its children under one or two named slots.
 * Addressing children as (statementId, slot) keeps insert/move/remove uniform
 * across `if`'s two branches and the single body of the loops.
 */
export type Slot = 'then' | 'otherwise' | 'body';

/** Where a statement lives: the root list, or a slot of a block statement. */
export interface Location {
  parentId: NodeId | null;
  slot: Slot | null;
  index: number;
}

function childrenOf(statement: Statement, slot: Slot): Statement[] | null {
  if (statement.kind === 'if') {
    if (slot === 'then') return statement.then;
    if (slot === 'otherwise') return statement.otherwise ?? null;
    return null;
  }
  if (isBlockStatement(statement) && slot === 'body') {
    return (statement as { body: Statement[] }).body;
  }
  return null;
}

function withChildren(statement: Statement, slot: Slot, children: Statement[]): Statement {
  if (statement.kind === 'if') {
    if (slot === 'then') return { ...statement, then: children };
    if (slot === 'otherwise') return { ...statement, otherwise: children };
    return statement;
  }
  if (isBlockStatement(statement) && slot === 'body') {
    return { ...statement, body: children } as Statement;
  }
  return statement;
}

/** Applies `transform` to the child list addressed by (parentId, slot). */
function mapSlot(
  statements: Statement[],
  parentId: NodeId | null,
  slot: Slot | null,
  transform: (children: Statement[]) => Statement[],
): Statement[] {
  if (parentId === null) return transform(statements);

  return statements.map((statement) => {
    if (statement.id === parentId && slot) {
      const current = childrenOf(statement, slot) ?? [];
      return withChildren(statement, slot, transform(current));
    }
    if (!isBlockStatement(statement)) return statement;

    if (statement.kind === 'if') {
      const next = { ...statement, then: mapSlot(statement.then, parentId, slot, transform) };
      if (statement.otherwise) {
        next.otherwise = mapSlot(statement.otherwise, parentId, slot, transform);
      }
      return next;
    }
    return {
      ...statement,
      body: mapSlot((statement as { body: Statement[] }).body, parentId, slot, transform),
    } as Statement;
  });
}

export function insertStatement(
  statements: Statement[],
  statement: Statement,
  location: Location,
): Statement[] {
  return mapSlot(statements, location.parentId, location.slot, (children) => {
    const index = Math.max(0, Math.min(location.index, children.length));
    return [...children.slice(0, index), statement, ...children.slice(index)];
  });
}

export function removeStatement(statements: Statement[], id: NodeId): Statement[] {
  return statements.flatMap((statement) => {
    if (statement.id === id) return [];
    if (!isBlockStatement(statement)) return [statement];

    if (statement.kind === 'if') {
      const next = { ...statement, then: removeStatement(statement.then, id) };
      if (statement.otherwise) next.otherwise = removeStatement(statement.otherwise, id);
      return [next];
    }
    return [
      {
        ...statement,
        body: removeStatement((statement as { body: Statement[] }).body, id),
      } as Statement,
    ];
  });
}

export function updateStatement(
  statements: Statement[],
  id: NodeId,
  update: (statement: Statement) => Statement,
): Statement[] {
  return statements.map((statement) => {
    if (statement.id === id) return update(statement);
    if (!isBlockStatement(statement)) return statement;

    if (statement.kind === 'if') {
      const next = { ...statement, then: updateStatement(statement.then, id, update) };
      if (statement.otherwise) next.otherwise = updateStatement(statement.otherwise, id, update);
      return next;
    }
    return {
      ...statement,
      body: updateStatement((statement as { body: Statement[] }).body, id, update),
    } as Statement;
  });
}

export function findStatement(statements: Statement[], id: NodeId): Statement | null {
  for (const statement of statements) {
    if (statement.id === id) return statement;
    if (!isBlockStatement(statement)) continue;

    if (statement.kind === 'if') {
      const hit =
        findStatement(statement.then, id) ??
        (statement.otherwise ? findStatement(statement.otherwise, id) : null);
      if (hit) return hit;
      continue;
    }
    const hit = findStatement((statement as { body: Statement[] }).body, id);
    if (hit) return hit;
  }
  return null;
}

export function findLocation(statements: Statement[], id: NodeId): Location | null {
  const search = (list: Statement[], parentId: NodeId | null, slot: Slot | null): Location | null => {
    for (let index = 0; index < list.length; index += 1) {
      const statement = list[index];
      if (statement.id === id) return { parentId, slot, index };
      if (!isBlockStatement(statement)) continue;

      if (statement.kind === 'if') {
        const hit =
          search(statement.then, statement.id, 'then') ??
          (statement.otherwise ? search(statement.otherwise, statement.id, 'otherwise') : null);
        if (hit) return hit;
        continue;
      }
      const hit = search((statement as { body: Statement[] }).body, statement.id, 'body');
      if (hit) return hit;
    }
    return null;
  };
  return search(statements, null, null);
}

/** True when `ancestorId` contains `descendantId`; guards moves into own subtree. */
export function containsStatement(
  statements: Statement[],
  ancestorId: NodeId,
  descendantId: NodeId,
): boolean {
  const ancestor = findStatement(statements, ancestorId);
  if (!ancestor || !isBlockStatement(ancestor)) return false;
  const scope: Statement[] =
    ancestor.kind === 'if'
      ? [...ancestor.then, ...(ancestor.otherwise ?? [])]
      : (ancestor as { body: Statement[] }).body;
  return findStatement(scope, descendantId) !== null;
}

/**
 * Moves a statement to a new location. Returns the original list when the move
 * would drop a block inside itself, which would detach the subtree.
 */
export function moveStatement(
  statements: Statement[],
  id: NodeId,
  destination: Location,
): Statement[] {
  if (destination.parentId === id) return statements;
  if (destination.parentId && containsStatement(statements, id, destination.parentId)) {
    return statements;
  }

  const moving = findStatement(statements, id);
  if (!moving) return statements;

  const origin = findLocation(statements, id);
  const without = removeStatement(statements, id);

  // Removing an earlier sibling shifts the target index down by one.
  let index = destination.index;
  if (
    origin &&
    origin.parentId === destination.parentId &&
    origin.slot === destination.slot &&
    origin.index < destination.index
  ) {
    index -= 1;
  }

  return insertStatement(without, moving, { ...destination, index });
}

/**
 * Collects declared variable names visible to the student, in document order.
 *
 * A statement that has not been named yet contributes nothing. New statements
 * arrive unnamed, and counting that as a declaration is what put a variable in
 * scope that nobody had written — every other block then offered it as a real
 * choice, because by then it was one.
 */
export function collectVariables(statements: Statement[]): string[] {
  const names: string[] = [];
  const add = (name: string): void => {
    if (name !== '') names.push(name);
  };
  const walk = (list: Statement[]): void => {
    for (const statement of list) {
      if (statement.kind === 'declare') add(statement.name);
      if (statement.kind === 'ask') add(statement.target);
      if (statement.kind === 'forEach') add(statement.variable);
      if (statement.kind === 'if') {
        walk(statement.then);
        if (statement.otherwise) walk(statement.otherwise);
      } else if (isBlockStatement(statement)) {
        walk((statement as { body: Statement[] }).body);
      }
    }
  };
  walk(statements);
  return [...new Set(names)];
}
