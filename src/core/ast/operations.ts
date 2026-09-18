import { castExpression, createId, emptyValue } from './factory';
import { isBlockStatement } from './types';
import type { ElseIfBranch, Expression, NodeId, Statement , Param } from './types';

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

/**
 * Inserts several statements at one place, in order.
 *
 * One operation rather than a loop of single inserts, so pasting three blocks
 * is one entry in the history: undo takes back the paste, not its last third.
 */
export function insertStatements(
  statements: Statement[],
  inserted: Statement[],
  location: Location,
): Statement[] {
  return mapSlot(statements, location.parentId, location.slot, (children) => {
    const index = Math.max(0, Math.min(location.index, children.length));
    return [...children.slice(0, index), ...inserted, ...children.slice(index)];
  });
}

/**
 * Removes several statements at once.
 *
 * Also one operation, for the same reason — and because removing them one at a
 * time would shift the positions of the ones still to go.
 */
export function removeStatements(statements: Statement[], ids: NodeId[]): Statement[] {
  const doomed = new Set(ids);
  const prune = (list: Statement[]): Statement[] =>
    list.flatMap((statement) => {
      if (doomed.has(statement.id)) return [];
      if (!isBlockStatement(statement)) return [statement];

      if (statement.kind === 'if') {
        const next = { ...statement, then: prune(statement.then) };
        if (statement.elseIfs) {
          next.elseIfs = statement.elseIfs.map((arm) => ({ ...arm, body: prune(arm.body) }));
        }
        if (statement.otherwise) next.otherwise = prune(statement.otherwise);
        return [next];
      }
      return [{ ...statement, body: prune((statement as { body: Statement[] }).body) } as Statement];
    });
  return prune(statements);
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
        /* Each else-if arm is addressed by its own id with slot 'body', the
           same way `mapSlot` and `removeStatement` treat them. Leaving them
           out made every statement inside an arm invisible to this — so
           anything that asks "where is this block" (moving it, duplicating it,
           selecting a range around it) silently did nothing there. */
        const hit =
          search(statement.then, statement.id, 'then') ??
          (statement.elseIfs ?? []).reduce<Location | null>(
            (found, arm) => found ?? search(arm.body, arm.id, 'body'),
            null,
          ) ??
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
/**
 * Every function declared in the program, with what it takes.
 *
 * Walks into bodies: a function declared inside an `if` is still callable —
 * the interpreter collects them the same way — and hiding it from the picker
 * would make the block look broken rather than explain anything.
 */
export function collectFunctions(
  statements: Statement[],
  into: { name: string; params: Param[] }[] = [],
): { name: string; params: Param[] }[] {
  for (const statement of statements) {
    if (statement.kind === 'function') {
      if (statement.name) into.push({ name: statement.name, params: statement.params });
      collectFunctions(statement.body, into);
      continue;
    }
    if (statement.kind === 'if') {
      collectFunctions(statement.then, into);
      for (const arm of statement.elseIfs ?? []) collectFunctions(arm.body, into);
      if (statement.otherwise) collectFunctions(statement.otherwise, into);
      continue;
    }
    const nested = (statement as { body?: Statement[] }).body;
    if (nested) collectFunctions(nested, into);
  }
  return into;
}

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
      /* `para cada elemento` binds a name too, and leaving it out meant the
         element being walked could not be referenced inside its own loop —
         the variable picker simply did not list it. `listOp` is deliberately
         absent: its name refers to a list that something else declared. */
      if (statement.kind === 'forEachItem') add(statement.variable);
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
 * Renames the name a loop binds, inside that loop only.
 *
 * A counter and a list element are not program-wide variables: they exist
 * between the loop's own braces and nowhere else. `renameVariable` walks the
 * whole algorithm, which is right for a declaration and wrong here — renaming
 * the element of `para cada nota en notas` was renaming every other `nota` in
 * the program, and when the list itself shared the name it renamed the list
 * out from under the loop that was reading it.
 *
 * So the rename is scoped: this loop's own binding, and the uses inside its
 * body. What the loop iterates over is deliberately untouched — the list is
 * named somewhere else, and this field never referred to it.
 */
export function renameLoopVariable(
  statements: Statement[],
  loopId: NodeId,
  to: string,
): Statement[] {
  const rebind = (statement: Statement): Statement => {
    if (statement.kind !== 'forEach' && statement.kind !== 'forEachItem') return statement;
    const from = statement.variable;
    if (from === '' || from === to) return { ...statement, variable: to };

    /*
      The body is renamed with the general walk, which is safe here: a name
      shadowed by an inner loop would be rebound by that loop's own binding,
      and every other use inside this body is this counter by definition.
    */
    const body = renameVariable(statement.body, from, to);
    return statement.kind === 'forEach'
      ? { ...statement, variable: to, body }
      : { ...statement, variable: to, body };
  };

  const walk = (list: Statement[]): Statement[] =>
    list.map((statement) => {
      if (statement.id === loopId) return rebind(statement);
      if (statement.kind === 'if') {
        return {
          ...statement,
          then: walk(statement.then),
          elseIfs: statement.elseIfs?.map((arm) => ({ ...arm, body: walk(arm.body) })),
          otherwise: statement.otherwise ? walk(statement.otherwise) : statement.otherwise,
        };
      }
      const nested = (statement as { body?: Statement[] }).body;
      if (nested) return { ...statement, body: walk(nested) } as Statement;
      return statement;
    });

  return walk(statements);
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
      /* A rename that stops at the edge of a list leaves the program broken in
         a place the student is not looking at, which is the whole reason this
         function exists. */
      case 'list':
        return { ...expression, items: expression.items.map(inExpression) };
      case 'index':
        return {
          ...expression,
          list: inExpression(expression.list),
          index: inExpression(expression.index),
        };
      case 'length':
        return { ...expression, list: inExpression(expression.list) };
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
        /*
          The two statements that came with lists, and both were missing.

          `forEachItem` names its element the way a counted loop names its
          counter, so a rename has to reach it — without this case the name
          fell to the `default` below and every keystroke in that field was
          silently discarded.

          `listOp` names a list it does not own, so its name is a *use*:
          renaming the declaration has to carry it, or the operation is left
          pointing at a variable that no longer exists.
        */
        case 'forEachItem':
          return {
            ...statement,
            variable: statement.variable === from ? to : statement.variable,
            list: inExpression(statement.list),
            body: walk(statement.body),
          };
        case 'listOp':
          return {
            ...statement,
            name: statement.name === from ? to : statement.name,
            value: statement.value ? inExpression(statement.value) : statement.value,
            index: statement.index ? inExpression(statement.index) : statement.index,
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
      } else if (statement.kind === 'forEachItem') {
        /* Missing here as it was in `renameVariable`: a name used only inside a
           `para cada` counted as unused, so the rename notice under-reported
           what it was about to change. */
        inExpression(statement.list);
        walk(statement.body);
      } else if (statement.kind === 'listOp') {
        /* The list it acts on is a use of that name, and so are its operands. */
        if (statement.name === name) total += 1;
        if (statement.value) inExpression(statement.value);
        if (statement.index) inExpression(statement.index);
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

/**
 * The statements between two, when both sit in the same list.
 *
 * Shift-clicking extends a selection, and "between" only means anything among
 * siblings: a block inside a loop and one after the loop have no range between
 * them that could be copied or deleted as a unit. Where the two are not
 * siblings, only the second is selected — the same thing a plain click does,
 * which is the least surprising way to refuse.
 */
export function rangeBetween(
  statements: Statement[],
  anchorId: NodeId,
  focusId: NodeId,
): NodeId[] {
  if (anchorId === focusId) return [focusId];

  const anchor = findLocation(statements, anchorId);
  const focus = findLocation(statements, focusId);
  if (!anchor || !focus) return [focusId];
  if (anchor.parentId !== focus.parentId || anchor.slot !== focus.slot) return [focusId];

  const siblings = anchor.parentId
    ? (childrenOfLocation(statements, anchor.parentId, anchor.slot) ?? [])
    : statements;

  const from = Math.min(anchor.index, focus.index);
  const to = Math.max(anchor.index, focus.index);
  return siblings.slice(from, to + 1).map((statement) => statement.id);
}

/**
 * The list a location points into, for reading a range out of it.
 *
 * An else-if arm carries its own id and is a parent in its own right, so it is
 * searched for separately — `findStatement` only ever returns statements, and
 * an arm is not one.
 */
function childrenOfLocation(
  statements: Statement[],
  parentId: NodeId,
  slot: Slot | null,
): Statement[] | null {
  if (!slot) return null;

  if (slot === 'body') {
    const arm = findElseIfArm(statements, parentId);
    if (arm) return arm.body;
  }

  const parent = findStatement(statements, parentId);
  if (!parent) return null;
  return childrenOf(parent, slot);
}

/** Finds an else-if arm by its own id, anywhere in the tree. */
function findElseIfArm(statements: Statement[], id: NodeId): ElseIfBranch | null {
  for (const statement of statements) {
    if (!isBlockStatement(statement)) continue;
    if (statement.kind === 'if') {
      const arm = statement.elseIfs?.find((candidate) => candidate.id === id);
      if (arm) return arm;
      const nested =
        findElseIfArm(statement.then, id) ??
        (statement.otherwise ? findElseIfArm(statement.otherwise, id) : null) ??
        (statement.elseIfs ?? []).reduce<ElseIfBranch | null>(
          (found, candidate) => found ?? findElseIfArm(candidate.body, id),
          null,
        );
      if (nested) return nested;
      continue;
    }
    const hit = findElseIfArm((statement as { body: Statement[] }).body, id);
    if (hit) return hit;
  }
  return null;
}

/**
 * Brings every call to `name` back in line with what the function now takes.
 *
 * A signature is not only a declaration: it is a promise the call sites are
 * holding. Changing a parameter's type or removing one used to leave them
 * holding the old shape — a text field under a number parameter, an argument
 * for an input that no longer exists — with no way to fix it short of
 * deleting the block and adding it again.
 *
 * Literals are re-read into the new kind, so what the student typed survives
 * wherever it can. Anything built is kept as it is: it has no kind of its own
 * to rewrite, and the static checks are what report a mismatch there.
 */
export function syncCallsTo(
  statements: Statement[],
  name: string,
  params: Param[],
): Statement[] {
  if (name === '') return statements;

  const fit = (args: Expression[]): Expression[] =>
    params.map((param, index) => {
      const current = args[index];
      if (param.type === 'list') {
        return current && current.kind !== 'literal' ? current : { kind: 'list', items: [] };
      }
      const want = param.type;
      if (!current) return emptyValue(want);
      if (current.kind !== 'literal') return current;
      return current.valueKind === want ? current : castExpression(current, want);
    });

  const inExpression = (expression: Expression): Expression => {
    switch (expression.kind) {
      case 'call':
        return {
          ...expression,
          args:
            expression.name === name
              ? fit(expression.args.map(inExpression))
              : expression.args.map(inExpression),
        };
      case 'binary':
        return {
          ...expression,
          left: inExpression(expression.left),
          right: inExpression(expression.right),
        };
      case 'unary':
        return { ...expression, operand: inExpression(expression.operand) };
      case 'group':
        return { ...expression, inner: inExpression(expression.inner) };
      case 'list':
        return { ...expression, items: expression.items.map(inExpression) };
      case 'index':
        return {
          ...expression,
          list: inExpression(expression.list),
          index: inExpression(expression.index),
        };
      case 'length':
        return { ...expression, list: inExpression(expression.list) };
      default:
        return expression;
    }
  };

  const walk = (list: Statement[]): Statement[] =>
    list.map((statement) => {
      switch (statement.kind) {
        case 'call':
          return statement.name === name
            ? { ...statement, args: fit(statement.args.map(inExpression)) }
            : { ...statement, args: statement.args.map(inExpression) };
        case 'declare':
        case 'assign':
          return { ...statement, value: inExpression(statement.value) };
        case 'say':
          return { ...statement, value: inExpression(statement.value) };
        case 'return':
          return statement.value ? { ...statement, value: inExpression(statement.value) } : statement;
        case 'ask':
          return { ...statement, prompt: inExpression(statement.prompt) };
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
          return { ...statement, condition: inExpression(statement.condition), body: walk(statement.body) };
        case 'repeat':
          return { ...statement, times: inExpression(statement.times), body: walk(statement.body) };
        case 'forEach':
          return {
            ...statement,
            from: inExpression(statement.from),
            to: inExpression(statement.to),
            step: inExpression(statement.step),
            body: walk(statement.body),
          };
        case 'forEachItem':
          return { ...statement, list: inExpression(statement.list), body: walk(statement.body) };
        case 'function':
          return { ...statement, body: walk(statement.body) };
        case 'listOp':
          return {
            ...statement,
            value: statement.value ? inExpression(statement.value) : statement.value,
            index: statement.index ? inExpression(statement.index) : statement.index,
          };
        default:
          return statement;
      }
    });

  return walk(statements);
}
