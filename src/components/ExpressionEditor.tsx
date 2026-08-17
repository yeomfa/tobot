import { memo, useState } from 'react';

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
export const ExpressionEditor = memo(function ExpressionEditor({
  value,
  onChange,
  variables,
  expect = 'any',
  mode = 'value',
  placeholder,
}: ExpressionEditorProps) {
  const { d } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);

  const operators =
    mode === 'condition' ? [...COMPARISON, ...LOGICAL, ...ARITHMETIC] : [...ARITHMETIC, ...COMPARISON];

  const changeToLiteral = (): void => {
    const kind: LiteralKind = expect === 'any' ? 'text' : expect;
    onChange(literal(kind === 'number' ? 0 : kind === 'boolean' ? true : '', kind));
    setMenuOpen(false);
  };

  const changeToVariable = (): void => {
    onChange({ kind: 'variable', name: variables[0] ?? '' });
    setMenuOpen(false);
  };

  const changeToBinary = (): void => {
    onChange({
      kind: 'binary',
      operator: mode === 'condition' ? '==' : '+',
      left: value,
      right: literal(expect === 'number' || mode === 'value' ? 0 : '', 'number'),
    });
    setMenuOpen(false);
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

      {value.kind === 'binary' && (
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

      <span className="expr__menu-wrap">
        <button
          type="button"
          className="expr__menu-trigger"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={d.actions.addStatement}
          aria-expanded={menuOpen}
        >
          ⋯
        </button>
        {menuOpen && (
          <>
            <span className="expr__backdrop" onClick={() => setMenuOpen(false)} />
            <span className="expr__menu" role="menu">
              <button type="button" role="menuitem" onClick={changeToLiteral}>
                {d.fields.value}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={changeToVariable}
                disabled={variables.length === 0}
              >
                {d.palette.groups.variables}
              </button>
              <button type="button" role="menuitem" onClick={changeToBinary}>
                {OPERATOR_GLYPH['+']} / {OPERATOR_GLYPH['==']}
              </button>
              {value.kind === 'binary' && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    // Collapsing keeps the left operand, the usual intent.
                    onChange(value.left);
                    setMenuOpen(false);
                  }}
                >
                  {d.actions.delete}
                </button>
              )}
            </span>
          </>
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
