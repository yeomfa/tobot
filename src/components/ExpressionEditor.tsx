import { Minus, Plus, Textbox } from '@phosphor-icons/react';
import { memo } from 'react';

import { literal } from '../core/ast/factory';
import type { BinaryOperator, Expression, LiteralKind } from '../core/ast/types';
import { useTranslation } from '../i18n/context';
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
}: ExpressionEditorProps) {
  const { d } = useTranslation();

  const operators =
    mode === 'condition' ? [...COMPARISON, ...LOGICAL, ...ARITHMETIC] : [...ARITHMETIC, ...COMPARISON];

  // Chains of one associative operator render as a flat row of values.
  const isChain = value.kind === 'binary' && ASSOCIATIVE.has(value.operator);
  const chain = isChain ? flattenChain(value, value.operator) : [];

  /**
   * Steps a value between text, number and variable. One control covers the
   * whole choice, and it only offers variables when some exist.
   */
  const cycleKind = (): void => {
    if (value.kind === 'literal') {
      // Variables come first in the cycle: using one is the far more common
      // next step than switching a literal's own type.
      if (variables.length > 0) {
        onChange({ kind: 'variable', name: variables[0] });
      } else {
        onChange(literal(value.valueKind === 'text' ? 0 : '', value.valueKind === 'text' ? 'number' : 'text'));
      }
      return;
    }
    if (value.kind === 'variable') {
      onChange(literal('', 'text'));
      return;
    }
    // A binary node collapses to its left operand, which is the usual intent.
    if (value.kind === 'binary') onChange(value.left);
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
        <select
          className="expr__var"
          value={value.name}
          onChange={(event) => onChange({ kind: 'variable', name: event.target.value })}
          aria-label={d.fields.name}
        >
          {/* A dangling reference stays selectable so it can be fixed. */}
          {!variables.includes(value.name) && <option value={value.name}>{value.name || '—'}</option>}
          {variables.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
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
          />
        </>
      )}

      {value.kind === 'binary' && isChain && (
        <>
          {chain.map((part, index) => (
            <span key={index} className="expr__chain-item">
              {index > 0 && (
                <select
                  className="expr__op expr__op--select"
                  value={value.operator}
                  onChange={(event) =>
                    onChange(rewriteOperator(value, event.target.value as BinaryOperator))
                  }
                  aria-label={d.fields.condition}
                >
                  {operators.map((operator) => (
                    <option key={operator} value={operator}>
                      {OPERATOR_GLYPH[operator]}
                    </option>
                  ))}
                </select>
              )}
              <ExpressionEditor
                value={part.node}
                onChange={(next) => onChange(part.replace(next))}
                variables={variables}
                mode={mode === 'condition' ? 'value' : mode}
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
          />
          <select
            className="expr__op expr__op--select"
            value={value.operator}
            onChange={(event) =>
              onChange({ ...value, operator: event.target.value as BinaryOperator })
            }
            aria-label={d.fields.condition}
          >
            {operators.map((operator) => (
              <option key={operator} value={operator}>
                {OPERATOR_GLYPH[operator]}
              </option>
            ))}
          </select>
          <ExpressionEditor
            value={value.right}
            onChange={(right) => onChange({ ...value, right })}
            variables={variables}
            mode={mode === 'condition' ? 'value' : mode}
          />
        </>
      )}

      {/* Two direct affordances instead of a menu: a type switch on the value
          itself, and a "+" that extends the expression. Reaching a
          concatenation used to take a menu round-trip per operand. */}
      <span className="expr__tools">
        <button
          type="button"
          className="expr__tool"
          onClick={cycleKind}
          title={d.fields.value}
          aria-label={d.fields.value}
        >
          <Textbox weight="bold" />
        </button>
        <button
          type="button"
          className="expr__tool"
          onClick={extend}
          title={d.actions.addValue}
          aria-label={d.actions.addValue}
        >
          <Plus weight="bold" />
        </button>
        {(value.kind === 'binary' || value.kind === 'unary') && (
          <button
            type="button"
            className="expr__tool expr__tool--remove"
            onClick={() => onChange(value.kind === 'binary' ? value.left : value.operand)}
            title={d.actions.delete}
            aria-label={d.actions.delete}
          >
            <Minus weight="bold" />
          </button>
        )}
      </span>
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
        // Sized to content so blocks stay compact.
        style={{ width: `${Math.max(String(value.value).length, 2) + 1.5}ch` }}
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
