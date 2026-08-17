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

export type Expression =
  | LiteralExpression
  | VariableExpression
  | BinaryExpression
  | UnaryExpression;

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
  | DeclareStatement
  | AssignStatement
  | SayStatement
  | AskStatement
  | IfStatement
  | WhileStatement
  | RepeatStatement
  | ForEachStatement;

interface StatementBase {
  id: NodeId;
}

/** `variable` topic: introduce a named box with a starting value. */
export interface DeclareStatement extends StatementBase {
  kind: 'declare';
  name: string;
  valueKind: LiteralKind;
  value: Expression;
}

/** `variable` topic: change what an existing box holds. */
export interface AssignStatement extends StatementBase {
  kind: 'assign';
  name: string;
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

export interface IfStatement extends StatementBase {
  kind: 'if';
  condition: Expression;
  then: Statement[];
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
export type BlockStatement = IfStatement | WhileStatement | RepeatStatement | ForEachStatement;

export function isBlockStatement(statement: Statement): statement is BlockStatement {
  return (
    statement.kind === 'if' ||
    statement.kind === 'while' ||
    statement.kind === 'repeat' ||
    statement.kind === 'forEach'
  );
}
