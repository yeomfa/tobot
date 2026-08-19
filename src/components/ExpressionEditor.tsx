import { Minus, Plus } from '@phosphor-icons/react';
import { memo } from 'react';

import { emptyValue, literal } from '../core/ast/factory';
import type { BinaryOperator, Expression, LiteralKind } from '../core/ast/types';
import { useTranslation } from '../i18n/context';
import { Picker } from './Picker';
import type { PickerGroup } from './Picker';
import './ExpressionEditor.css';

interface ExpressionEditorProps {
  value: Expression;
  onChange: (next: Expression) => void;
  /** Variables in scope, offered in the reference dropdown. */
  variables: string[];
  /** Restricts literal entry when the slot has a known type. */
  expect?: LiteralKind | 'any';
  /** Conditions get comparison operators; values get arithmetic. */
  mode?: 'value' | 'condition';
  placeholder?: string;
  /**
   * Set on operands drawn inside a larger expression. They render their value
   * without the editing bar, which belongs to the expression as a whole.
   */
  nested?: boolean;
}

/**
 * Operators that chain without changing meaning, so `a + b + c` can be drawn
 * as one flat row instead of nested boxes. Subtraction and division are absent
 * on purpose: their grouping is significant.
 */
const ASSOCIATIVE = new Set<BinaryOperator>(['+', '*', '&&', '||']);

const ARITHMETIC: BinaryOperator[] = ['+', '-', '*', '/', '%'];
const COMPARISON: BinaryOperator[] = ['==', '!=', '<', '<=', '>', '>='];
const LOGICAL: BinaryOperator[] = ['&&', '||'];

/** Symbols students recognise from maths, rather than programming spellings. */
const OPERATOR_GLYPH: Record<BinaryOperator, string> = {
  '+': '+',
  '-': '−',
  '*': '×',
  '/': '÷',
  '%': 'mod',
  '==': '=',
  '!=': '≠',
  '<': '<',
  '<=': '≤',
  '>': '>',
  '>=': '≥',
  '&&': '∧',
  '||': '∨',
};

/**
 * Inline, structural expression editor.
 *
 * Values are edited as a small tree rather than free text: a student picks
 * "literal", "variable" or "operation" and fills the slots. This makes an
 * invalid expression unrepresentable, which is the whole reason the app can
 * guarantee the three language views always agree.
 */
/**
 * Collects the operands of a left-leaning chain of one associative operator,
 * along with the setter that rebuilds the tree when one of them changes.
 *
 * The AST stays a binary tree — the emitters and interpreter rely on that —
 * but a student reading `"x " + i + " = " + total` should see four values in a
 * row, not four boxes inside each other.
 */
interface ChainPart {
  node: Expression;
  replace: (next: Expression) => Expression;
}

function flattenChain(expression: Expression, operator: BinaryOperator): ChainPart[] {
  if (expression.kind !== 'binary' || expression.operator !== operator) {
    return [{ node: expression, replace: (next) => next }];
  }

  const left = flattenChain(expression.left, operator).map((part) => ({
    node: part.node,
    replace: (next: Expression): Expression => ({
      ...expression,
      left: part.replace(next),
    }),
  }));

  return [
    ...left,
    {
      node: expression.right,
      replace: (next: Expression): Expression => ({ ...expression, right: next }),
    },
  ];
}

/**
 * Retargets every node of a chain to a new operator. Changing one connector in
 * a flat row changes the whole chain, which is the only reading that keeps the
 * row honest: `a + b × c` cannot be drawn as one flat row without implying the
 * wrong precedence.
 */
function rewriteOperator(expression: Expression, operator: BinaryOperator): Expression {
  if (expression.kind !== 'binary') return expression;
  const from = expression.operator;
  const rewrite = (node: Expression): Expression =>
    // Only nodes belonging to this chain are retargeted; a nested expression
    // using a different operator keeps its own.
    node.kind === 'binary' && node.operator === from
      ? { ...node, operator, left: rewrite(node.left) }
      : node;
  return rewrite(expression);
}

export const ExpressionEditor = memo(function ExpressionEditor({
  value,
  onChange,
  variables,
  expect = 'any',
  mode = 'value',
  placeholder,
  nested = false,
}: ExpressionEditorProps) {
  const { d } = useTranslation();

  /**
   * Grouped rather than flat. Thirteen operators in one column was a list
   * taller than the block, with `≠` sitting next to `×` as though they were
   * the same kind of thing. The order still follows the slot: a condition
   * leads with comparison, a value with arithmetic.
   */
  const operatorGroups: PickerGroup<BinaryOperator>[] = (
    mode === 'condition'
      ? [
          [d.operators.groupComparison, COMPARISON] as const,
          [d.operators.groupLogical, LOGICAL] as const,
          [d.operators.groupArithmetic, ARITHMETIC] as const,
        ]
      : [
          [d.operators.groupArithmetic, ARITHMETIC] as const,
          [d.operators.groupComparison, COMPARISON] as const,
        ]
  ).map(([label, list]) => ({
    label,
    dense: true,
    options: list.map((operator) => ({
      value: operator,
      label: OPERATOR_GLYPH[operator],
      hint: d.operators[operator],
    })),
  }));

  // Chains of one associative operator render as a flat row of values.
  const isChain = value.kind === 'binary' && ASSOCIATIVE.has(value.operator);
  const chain = isChain ? flattenChain(value, value.operator) : [];

  /**
   * Switches between typing a value and using a variable.
   *
   * This used to be one button that cycled blindly: you pressed it and found
   * out afterwards what it had turned into. A select says up front what the
   * choices are, which matters most for the students who do not yet know that
   * "a value" and "a variable" are different things.
   */
  const source: 'literal' | 'variable' = value.kind === 'variable' ? 'variable' : 'literal';
  const setSource = (next: 'literal' | 'variable'): void => {
    if (next === source) return;
    if (next === 'variable') {
      onChange({ kind: 'variable', name: variables[0] ?? '' });
    } else {
      onChange(expect === 'any' ? literal('', 'text') : emptyValue(expect));
    }
  };

  /** Appends another operand, continuing the current chain where there is one. */
  const extend = (): void => {
    const operator: BinaryOperator =
      value.kind === 'binary' && ASSOCIATIVE.has(value.operator)
        ? value.operator
        : mode === 'condition'
          ? '=='
          : '+';
    const seed: LiteralKind = expect === 'number' ? 'number' : 'text';
    onChange({
      kind: 'binary',
      operator,
      left: value,
      right: literal(seed === 'number' ? 0 : '', seed),
    });
  };

  return (
    <span className="expr" data-kind={value.kind}>
      {value.kind === 'literal' && (
        <LiteralInput value={value} onChange={onChange} placeholder={placeholder} />
      )}

      {value.kind === 'variable' && (
        <Picker
          value={value.name}
          groups={[
            {
              options: [
                // A dangling reference stays listed so it can be fixed rather
                // than silently swapped for something else.
                ...(variables.includes(value.name)
                  ? []
                  : [{ value: value.name, label: value.name || '···' }]),
                ...variables.map((name) => ({ value: name, label: name })),
              ],
            },
          ]}
          onChange={(name) => onChange({ kind: 'variable', name })}
          label={d.fields.name}
          variant="reference"
        />
      )}

      {value.kind === 'unary' && (
        <>
          <span className="expr__op">{value.operator === '!' ? '¬' : '−'}</span>
          <ExpressionEditor
            value={value.operand}
            onChange={(operand) => onChange({ ...value, operand })}
            variables={variables}
            expect={expect}
            mode={mode}
            nested
          />
        </>
      )}

      {value.kind === 'binary' && isChain && (
        <>
          {chain.map((part, index) => (
            <span key={index} className="expr__chain-item">
              {index > 0 && (
                <Picker
                  value={value.operator}
                  groups={operatorGroups}
                  onChange={(operator) => onChange(rewriteOperator(value, operator))}
                  label={d.fields.operator}
                  variant="operator"
                />
              )}
              <ExpressionEditor
                value={part.node}
                onChange={(next) => onChange(part.replace(next))}
                variables={variables}
                mode={mode === 'condition' ? 'value' : mode}
                nested
              />
            </span>
          ))}
        </>
      )}

      {value.kind === 'binary' && !isChain && (
        <>
          <ExpressionEditor
            value={value.left}
            onChange={(left) => onChange({ ...value, left })}
            variables={variables}
            mode={mode === 'condition' ? 'value' : mode}
            nested
          />
          <Picker
            value={value.operator}
            groups={operatorGroups}
            onChange={(operator) => onChange({ ...value, operator })}
            label={d.fields.operator}
            variant="operator"
          />
          <ExpressionEditor
            value={value.right}
            onChange={(right) => onChange({ ...value, right })}
            variables={variables}
            mode={mode === 'condition' ? 'value' : mode}
            nested
          />
        </>
      )}

      {/*
        The controls sit on the whole expression, never on each operand: a
        nested editor renders its own value and nothing else. Repeating this
        bar inside every part turned "a + b" into six buttons, most of which
        acted on something other than what the student had clicked.
      */}
      {!nested && (
        <span className="expr__tools">
          {/* Only worth showing once a variable exists to point at. */}
          {variables.length > 0 && value.kind !== 'binary' && value.kind !== 'unary' && (
            <Picker
              value={source}
              groups={[
                {
                  options: [
                    { value: 'literal', label: d.fields.aValue },
                    { value: 'variable', label: d.fields.aVariable },
                  ],
                },
              ]}
              onChange={setSource}
              label={d.fields.value}
            />
          )}
          <button
            type="button"
            className="expr__tool expr__tool--add"
            onClick={extend}
            title={d.actions.addValue}
          >
            <Plus weight="bold" />
            <span className="expr__tool-label">{d.actions.addOperand}</span>
          </button>
          {(value.kind === 'binary' || value.kind === 'unary') && (
            <button
              type="button"
              className="expr__tool expr__tool--remove"
              onClick={() => onChange(value.kind === 'binary' ? value.left : value.operand)}
              title={d.actions.removeOperand}
              aria-label={d.actions.removeOperand}
            >
              <Minus weight="bold" />
            </button>
          )}
        </span>
      )}
    </span>
  );
});

interface LiteralInputProps {
  value: Extract<Expression, { kind: 'literal' }>;
  onChange: (next: Expression) => void;
  placeholder?: string;
}

function LiteralInput({ value, onChange, placeholder }: LiteralInputProps) {
  const { d } = useTranslation();

  if (value.valueKind === 'boolean') {
    return (
      <select
        className="expr__literal expr__literal--bool"
        value={String(value.value)}
        onChange={(event) => onChange(literal(event.target.value === 'true', 'boolean'))}
      >
        <option value="true">{d.booleans.true}</option>
        <option value="false">{d.booleans.false}</option>
      </select>
    );
  }

  if (value.valueKind === 'number') {
    return (
      <input
        className="expr__literal expr__literal--number"
        type="number"
        value={String(value.value)}
        placeholder={placeholder}
        onChange={(event) => {
          // Keep the raw text while the field is mid-edit (e.g. "-" or "1.").
          const parsed = Number(event.target.value);
          onChange(literal(Number.isNaN(parsed) ? 0 : parsed, 'number'));
        }}
        // Sized to content, with room for the 6px side padding on each side.
        style={{ width: `${Math.max(String(value.value).length, 2) + 2.5}ch` }}
      />
    );
  }

  return (
    <input
      className="expr__literal expr__literal--text"
      type="text"
      value={String(value.value)}
      placeholder={placeholder}
      onChange={(event) => onChange(literal(event.target.value, 'text'))}
      // The leading quote glyph and padding both consume room, so the width
      // allows for them; without the slack the last characters get clipped.
      style={{ width: `${Math.max(String(value.value).length, 6) + 3}ch` }}
    />
  );
}
