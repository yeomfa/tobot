import { createId } from './factory';
import { isBlockStatement } from './types';
import type { Expression, NodeId, Statement } from './types';

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
      /*
        An else-if arm is addressed by its own id with slot 'body', rather than
        by adding a slot name per arm: the arms are a list, so their count is
        not known to the Slot type, and giving each one an id makes it a parent
        like any other block.
      */
      if (statement.elseIfs) {
        next.elseIfs = statement.elseIfs.map((arm) =>
          arm.id === parentId && slot === 'body'
            ? { ...arm, body: transform(arm.body) }
            : { ...arm, body: mapSlot(arm.body, parentId, slot, transform) },
        );
      }
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
      if (statement.elseIfs) {
        next.elseIfs = statement.elseIfs.map((arm) => ({
          ...arm,
          body: removeStatement(arm.body, id),
        }));
      }
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
      if (statement.elseIfs) {
        next.elseIfs = statement.elseIfs.map((arm) => ({
          ...arm,
          body: updateStatement(arm.body, id, update),
        }));
      }
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
        statement.elseIfs?.reduce<Statement | null>(
          (found, arm) => found ?? findStatement(arm.body, id),
          null,
        ) ??
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
        for (const arm of statement.elseIfs ?? []) walk(arm.body);
        if (statement.otherwise) walk(statement.otherwise);
      } else if (isBlockStatement(statement)) {
        walk((statement as { body: Statement[] }).body);
      }
    }
  };
  walk(statements);
  return [...new Set(names)];
}

/**
 * Renames a variable everywhere it appears.
 *
 * Renaming where a variable is declared used to change only that one word, so
 * every use went on pointing at a name that no longer existed — the algorithm
 * broke in places the student was not looking at, and nothing said so.
 *
 * A name at this level is a label rather than an identity: "call this
 * something else" is what a student means, so every reference follows. Undo
 * restores the whole rename at once, since it is one edit to the tree.
 *
 * Every site that can hold the name is covered: declarations, the target of
 * `preguntar`, a loop counter, assignments, and any expression that reads it.
 */
export function renameVariable(
  statements: Statement[],
  from: string,
  to: string,
): Statement[] {
  if (from === '' || from === to) return statements;

  const inExpression = (expression: Expression): Expression => {
    switch (expression.kind) {
      case 'variable':
        return expression.name === from ? { ...expression, name: to } : expression;
      case 'group':
        return { ...expression, inner: inExpression(expression.inner) };
      case 'unary':
        return { ...expression, operand: inExpression(expression.operand) };
      case 'binary':
        return {
          ...expression,
          left: inExpression(expression.left),
          right: inExpression(expression.right),
        };
      default:
        return expression;
    }
  };

  const walk = (list: Statement[]): Statement[] =>
    list.map((statement) => {
      switch (statement.kind) {
        case 'declare':
          return {
            ...statement,
            name: statement.name === from ? to : statement.name,
            value: inExpression(statement.value),
          };
        case 'assign':
          return {
            ...statement,
            name: statement.name === from ? to : statement.name,
            value: inExpression(statement.value),
          };
        case 'ask':
          return {
            ...statement,
            target: statement.target === from ? to : statement.target,
            prompt: inExpression(statement.prompt),
          };
        case 'say':
          return { ...statement, value: inExpression(statement.value) };
        case 'if':
          return {
            ...statement,
            condition: inExpression(statement.condition),
            then: walk(statement.then),
            elseIfs: statement.elseIfs?.map((arm) => ({
              ...arm,
              condition: inExpression(arm.condition),
              body: walk(arm.body),
            })),
            otherwise: statement.otherwise ? walk(statement.otherwise) : statement.otherwise,
          };
        case 'while':
          return {
            ...statement,
            condition: inExpression(statement.condition),
            body: walk(statement.body),
          };
        case 'repeat':
          return {
            ...statement,
            times: inExpression(statement.times),
            body: walk(statement.body),
          };
        case 'forEach':
          return {
            ...statement,
            variable: statement.variable === from ? to : statement.variable,
            from: inExpression(statement.from),
            to: inExpression(statement.to),
            step: inExpression(statement.step),
            body: walk(statement.body),
          };
        default:
          return statement;
      }
    });

  return walk(statements);
}

/** How many places a name is used, for telling the student what a rename did. */
export function countReferences(statements: Statement[], name: string): number {
  if (name === '') return 0;
  let total = 0;

  const inExpression = (expression: Expression): void => {
    if (expression.kind === 'variable' && expression.name === name) total += 1;
    else if (expression.kind === 'group') inExpression(expression.inner);
    else if (expression.kind === 'unary') inExpression(expression.operand);
    else if (expression.kind === 'binary') {
      inExpression(expression.left);
      inExpression(expression.right);
    }
  };

  const walk = (list: Statement[]): void => {
    for (const statement of list) {
      if (statement.kind === 'declare' || statement.kind === 'assign') {
        if (statement.kind === 'assign' && statement.name === name) total += 1;
        inExpression(statement.value);
      } else if (statement.kind === 'ask') inExpression(statement.prompt);
      else if (statement.kind === 'say') inExpression(statement.value);
      else if (statement.kind === 'if') {
        inExpression(statement.condition);
        walk(statement.then);
        for (const arm of statement.elseIfs ?? []) {
          inExpression(arm.condition);
          walk(arm.body);
        }
        if (statement.otherwise) walk(statement.otherwise);
      } else if (statement.kind === 'while') {
        inExpression(statement.condition);
        walk(statement.body);
      } else if (statement.kind === 'repeat') {
        inExpression(statement.times);
        walk(statement.body);
      } else if (statement.kind === 'forEach') {
        inExpression(statement.from);
        inExpression(statement.to);
        inExpression(statement.step);
        walk(statement.body);
      }
    }
  };

  walk(statements);
  return total;
}

/**
 * Copies a statement, giving every node in it a fresh id.
 *
 * Ids address blocks — a drop target, a flowchart highlight, the statement the
 * interpreter is on — so a copy sharing them would be a second block claiming
 * to be the first. A conditional carries a whole subtree, and every node in it
 * needs renaming, not just the root.
 */
export function copyStatement(statement: Statement): Statement {
  const copied: Statement = { ...statement, id: createId() };

  if (copied.kind === 'if') {
    return {
      ...copied,
      then: copied.then.map(copyStatement),
      elseIfs: copied.elseIfs?.map((arm) => ({
        ...arm,
        id: createId(),
        body: arm.body.map(copyStatement),
      })),
      otherwise: copied.otherwise?.map(copyStatement),
    };
  }

  if (isBlockStatement(copied)) {
    return {
      ...copied,
      body: (copied as { body: Statement[] }).body.map(copyStatement),
    } as Statement;
  }

  return copied;
}
