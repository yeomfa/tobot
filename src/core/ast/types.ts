/**
 * The algorithm AST. Every view in the app (natural language, pseudocode,
 * JavaScript, flowchart, interpreter) is a projection of this tree, so adding a
 * new target language means writing one emitter and nothing else.
 *
 * Nodes are intentionally coarse: they mirror the teaching topics (variables,
 * output, input, conditionals, loops) rather than a general-purpose language.
 */

export type NodeId = string;

/** Values a student can write literally. */
export type LiteralKind = 'number' | 'text' | 'boolean';

/**
 * What a variable can hold, which is a literal kind or a list of them.
 *
 * Kept separate from `LiteralKind` on purpose: a list is not something the
 * student types into a field, it is something they build. Every place that
 * asks "what can I write here" still takes `LiteralKind`, and only the places
 * that ask "what does this hold" widen to this.
 */
export type ValueKind = LiteralKind | 'list';

export type Expression =
  | LiteralExpression
  | VariableExpression
  | BinaryExpression
  | UnaryExpression
  | GroupExpression
  | ListExpression
  | IndexExpression
  | LengthExpression;

export interface LiteralExpression {
  kind: 'literal';
  valueKind: LiteralKind;
  value: string | number | boolean;
}

export interface VariableExpression {
  kind: 'variable';
  name: string;
}

/**
 * A grouping the student made on purpose: "work these out first".
 *
 * The shape of the tree already decides evaluation order, and the emitters
 * derive parentheses from it — so for *running* a program this node changes
 * nothing. It exists because the editor cannot otherwise tell the difference
 * between an order the student chose and one that fell out of how a chain was
 * built: `a + b + c` is stored as `(a + b) + c` either way, and the editor
 * flattens same-operator chains into a row, which silently undid any grouping
 * made inside one.
 *
 * So this marks intent, not arithmetic. Flattening stops here, the brackets
 * stay visible in every view, and removing the node leaves the same result.
 */
export interface GroupExpression {
  kind: 'group';
  inner: Expression;
}

/**
 * A list written out: `[1, 2, 3]`.
 *
 * The items are expressions rather than literals so a list can be built from
 * what the program already knows — `[nota1, nota2, promedio]` is the first
 * thing a student reaches for, and requiring literals would make lists a place
 * to type constants rather than a way to hold their work.
 */
export interface ListExpression {
  kind: 'list';
  items: Expression[];
}

/**
 * One element, by position: `notas[i]`.
 *
 * Reading and writing share this node — an index on the left of `cambiar` is
 * the same idea as one on the right, and splitting them would make "the third
 * element" two concepts instead of one.
 */
export interface IndexExpression {
  kind: 'index';
  list: Expression;
  index: Expression;
}

/** How many elements a list holds. Its own node rather than a function call,
    since there are no function calls yet and this is the one students need. */
export interface LengthExpression {
  kind: 'length';
  list: Expression;
}

/**
 * Arithmetic, comparison and logical operators share one node because students
 * meet them as a single idea: "combine two values".
 */
export type BinaryOperator =
  | '+'
  | '-'
  | '*'
  | '/'
  | '%'
  | '=='
  | '!='
  | '<'
  | '<='
  | '>'
  | '>='
  | '&&'
  | '||';

export interface BinaryExpression {
  kind: 'binary';
  operator: BinaryOperator;
  left: Expression;
  right: Expression;
}

export type UnaryOperator = '!' | '-';

export interface UnaryExpression {
  kind: 'unary';
  operator: UnaryOperator;
  operand: Expression;
}

export type Statement =
  | CommentStatement
  | DeclareStatement
  | AssignStatement
  | SayStatement
  | AskStatement
  | IfStatement
  | WhileStatement
  | RepeatStatement
  | ForEachStatement
  | ListOpStatement
  | ForEachItemStatement;

interface StatementBase {
  id: NodeId;
}

/**
 * A note to the reader. It executes as a no-op, which is what makes it useful
 * for handing out exercises: an instructor can ship an algorithm whose
 * comments say what each missing part should do.
 */
export interface CommentStatement extends StatementBase {
  kind: 'comment';
  text: string;
}

/** `variable` topic: introduce a named box with a starting value. */
export interface DeclareStatement extends StatementBase {
  kind: 'declare';
  name: string;
  /* `ValueKind`, not `LiteralKind`: declaring a variable that holds a list is
     the most natural way to make one, and gating it on the three scalars made
     lists reachable only by switching an existing value. */
  valueKind: ValueKind;
  value: Expression;
}

/**
 * `variable` topic: change what an existing box holds.
 *
 * With `index` set it writes one element instead of the whole variable:
 * `cambiar notas[2] = 5`. A field on the statement rather than a separate kind
 * of block, because a student meets it as the same act — changing something
 * they already have — and two nearly identical blocks would teach otherwise.
 */
export interface AssignStatement extends StatementBase {
  kind: 'assign';
  name: string;
  /** Position to write, when the target is one element of a list. */
  index?: Expression;
  value: Expression;
}

/** `output` topic: the robot speaks. */
export interface SayStatement extends StatementBase {
  kind: 'say';
  value: Expression;
}

/** `input` topic: the robot asks and stores the answer. */
export interface AskStatement extends StatementBase {
  kind: 'ask';
  prompt: Expression;
  /** Variable that receives the answer. */
  target: string;
  /** Answers arrive as text; this coerces them for the student. */
  expect: LiteralKind;
}

/**
 * One `si no, si` arm: a condition and the statements it guards.
 *
 * Carries an id of its own so the editor can address an arm — a flowchart
 * highlight, a drop target, a remove button all need to name one.
 */
export interface ElseIfBranch {
  id: NodeId;
  condition: Expression;
  body: Statement[];
}

export interface IfStatement extends StatementBase {
  kind: 'if';
  condition: Expression;
  then: Statement[];
  /**
   * Further conditions, tried in order after the first fails.
   *
   * A list rather than a nested `if` inside `otherwise`: three alternatives
   * are three arms of one decision, and nesting them buries the third under
   * two levels of indentation that say nothing about the problem. Absent on
   * statements written before this existed, so it is optional.
   */
  elseIfs?: ElseIfBranch[];
  /** `undefined` means the student never opened an "otherwise" branch. */
  otherwise?: Statement[];
}

export interface WhileStatement extends StatementBase {
  kind: 'while';
  condition: Expression;
  body: Statement[];
}

/** Counted loop, kept separate from `while` because it reads very differently. */
export interface RepeatStatement extends StatementBase {
  kind: 'repeat';
  times: Expression;
  body: Statement[];
}

/**
 * What a list operation does. One statement with an operation rather than five
 * blocks, because they are all the same sentence — "do this to that list" —
 * and five near-identical blocks in the palette would say they are five ideas.
 */
export type ListOperation = 'append' | 'insert' | 'removeAt' | 'sort' | 'reverse';

/**
 * `list` topic: change a list in place.
 *
 * `value` and `index` are used or ignored depending on the operation, which is
 * checked by the validator rather than encoded in the type. A union of five
 * shapes would be more precise and would make every walk over statements five
 * cases longer for no gain to the student.
 */
export interface ListOpStatement extends StatementBase {
  kind: 'listOp';
  operation: ListOperation;
  /** The list being changed, by name. */
  name: string;
  /** What to add, for `append` and `insert`. */
  value?: Expression;
  /** Where, for `insert` and `removeAt`. */
  index?: Expression;
  /** Largest first, for `sort`. */
  descending?: boolean;
}

/**
 * `list` topic: visit every element in turn.
 *
 * Separate from `forEach`, which counts through numbers. A student reading
 * "para cada nota en notas" is not thinking about positions at all, and making
 * them write `notas[i]` to see an element is the step that loses people.
 */
export interface ForEachItemStatement extends StatementBase {
  kind: 'forEachItem';
  /** Name bound to each element in turn. */
  variable: string;
  list: Expression;
  body: Statement[];
}

/** Numeric range loop: the classic `for i = from to to`. */
export interface ForEachStatement extends StatementBase {
  kind: 'forEach';
  variable: string;
  from: Expression;
  to: Expression;
  step: Expression;
  body: Statement[];
}

export interface Algorithm {
  id: string;
  name: string;
  body: Statement[];
  createdAt: string;
  updatedAt: string;
}

/** Statement kinds that own child statement lists. */
export type BlockStatement =
  | IfStatement
  | WhileStatement
  | RepeatStatement
  | ForEachStatement
  | ForEachItemStatement;

export function isBlockStatement(statement: Statement): statement is BlockStatement {
  return (
    statement.kind === 'if' ||
    statement.kind === 'while' ||
    statement.kind === 'repeat' ||
    statement.kind === 'forEach' ||
    statement.kind === 'forEachItem'
  );
}
