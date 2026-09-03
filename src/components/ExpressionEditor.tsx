import {
  ArrowsOutSimpleIcon as ArrowsOutSimple,
  BracketsRoundIcon as BracketsRound,
  CheckCircleIcon as CheckCircle,
  KeyboardIcon as Keyboard,
  PlusIcon as Plus,
  TagIcon as Tag,
  TrashIcon as Trash,
  XCircleIcon as XCircle,
} from '@phosphor-icons/react';
import { memo } from 'react';

import { castExpression, emptyValue, literal } from '../core/ast/factory';
import type { BinaryOperator, Expression, LiteralKind } from '../core/ast/types';
import { useTranslation } from '../i18n/context';
import { precedenceOf } from '../core/emitters/precedence';
import { flattenChain, groupParts, removeAt, ungroup } from './chain';
import { typeIcon } from './statementMeta';
import { Picker } from './Picker';
import { VariablePicker } from './VariablePicker';
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
   * without the bar that extends the expression, which belongs to the whole.
   */
  nested?: boolean;
  /**
   * Binding strength of the expression this one sits inside.
   *
   * Only used to mark what resolves first: an operand that binds tighter than
   * its parent runs before it, which is the part of the order a flat row does
   * not show.
   */
  parentPrecedence?: number;
  /**
   * Groups this part with the one after it, when there is one to group with.
   *
   * Passed down rather than decided here: only the chain knows how many parts
   * there are and which of them this is.
   */
  groupWithNext?: () => void;
  /**
   * Drops this operand from the expression containing it. Absent when there is
   * nothing to drop back to, which is what hides the option on a lone value.
   */
  onRemove?: () => void;
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

/** The three types a written value can have, in the order the palette uses. */
const KINDS: LiteralKind[] = ['number', 'text', 'boolean'];

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
  nested = false,
  parentPrecedence,
  groupWithNext,
  onRemove,
}: ExpressionEditorProps) {
  const { d } = useTranslation();

  /**
   * Grouped rather than flat, and narrowed to what the slot is for.
   *
   * Thirteen operators in one column was a list taller than the block, with
   * `≠` sitting next to `×` as though they were the same kind of thing. A
   * condition leads with comparison; a slot declared as text offers neither
   * arithmetic nor ordering, since neither means anything there.
   */
  const operatorGroups: PickerGroup<BinaryOperator>[] = (
    mode === 'condition'
      ? [
          [d.operators.groupComparison, COMPARISON] as const,
          [d.operators.groupLogical, LOGICAL] as const,
          [d.operators.groupArithmetic, ARITHMETIC] as const,
        ]
      : expect === 'text'
        ? // Joining text is the one arithmetic operator that applies.
          [[d.operators.groupArithmetic, ['+'] as BinaryOperator[]] as const]
        : expect === 'boolean'
          ? [[d.operators.groupLogical, LOGICAL] as const]
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

  /*
    Parts picked for grouping, as indices into the flattened chain.

    A range rather than a pair: grouping three parts two at a time produces
    `((a + b) + c)`, which is not the single bracket the student asked for, and
    left them deleting the inner group by hand.
  */
  // Chains of one associative operator render as a flat row of values.
  const isChain = value.kind === 'binary' && ASSOCIATIVE.has(value.operator);
  const chain = isChain ? flattenChain(value, value.operator) : [];

  /*
    Whether this expression is resolved before the one containing it.

    Nothing here changes the algorithm — the order was already decided when the
    student built the tree, and the emitters have always written the right
    parentheses. It was simply invisible: `a + b * c` looks like a row read
    left to right, and nothing said the multiplication happens first.

    Marked, not grouped. Grouping is the student's own action, and a mark that
    rearranged things on its own would be the editor deciding an order the
    student did not ask for.
  */
  const boundTighter =
    nested &&
    value.kind === 'binary' &&
    parentPrecedence !== undefined &&
    precedenceOf(value) > parentPrecedence;

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

  /**
   * A single value, rather than something built out of other values. Only
   * these can be swapped for a variable or dropped, so only these carry the
   * options caret.
   */
  const isOperand = value.kind === 'literal' || value.kind === 'variable';

  /**
   * What the parts *inside* this expression hold, which is not what the
   * expression itself produces. `edad >= 18` yields a boolean, but its two
   * operands are numbers — so a condition must not pass its own boolean
   * expectation down, or every side of a comparison would offer only
   * "verdadero / falso".
   */
  const operandExpect: LiteralKind | 'any' = mode === 'condition' ? 'any' : expect;
  /** Pointless to offer a variable when none is in scope yet. */
  const canReference = variables.length > 0;

  /** Appends another operand, continuing the current chain where there is one. */
  const extend = (): void => {
    const operator: BinaryOperator =
      value.kind === 'binary' && ASSOCIATIVE.has(value.operator)
        ? value.operator
        : mode === 'condition'
          ? '=='
          : '+';
    /*
      The new operand matches what it is being joined to, rather than always
      starting as text: comparing a number against an empty string is never
      what was meant, and made the student fix the type of every part they
      added. The slot's own expectation wins when it has one.
    */
    const seed: LiteralKind =
      expect !== 'any'
        ? expect
        : value.kind === 'literal'
          ? value.valueKind
          : // Nothing to copy a type from — a variable carries none, and a
            // sum of them says only what the operator says. Joining with `+`
            // in a slot that takes anything is far more often building a
            // message than adding, so text is the better guess than number.
            mode === 'condition'
            ? 'number'
            : 'text';
    onChange({
      kind: 'binary',
      operator,
      left: value,
      right: emptyValue(seed),
    });
  };

  return (
    <span className="expr" data-kind={value.kind} data-first={boundTighter || undefined}>
      {value.kind === 'literal' && (
        <LiteralInput value={value} onChange={onChange} placeholder={placeholder} />
      )}

      {value.kind === 'variable' && (
        <VariablePicker
          value={value.name}
          variables={variables}
          onChange={(name) => onChange({ kind: 'variable', name })}
        />
      )}

      {value.kind === 'group' && (
        <span className="expr__grouped">
          <span className="expr__bracket" aria-hidden="true">
            (
          </span>
          <ExpressionEditor
            value={value.inner}
            onChange={(inner) => onChange({ ...value, inner })}
            variables={variables}
            expect={expect}
            mode={mode}
            nested
          />
          <span className="expr__bracket" aria-hidden="true">
            )
          </span>
          {/* Undoing a grouping has to be as reachable as making one, or the
              student is stuck with a decision they were experimenting with. */}
          <button
            type="button"
            className="expr__ungroup"
            onClick={() => onChange(ungroup(value))}
            title={d.actions.ungroup}
            aria-label={d.actions.ungroup}
          >
            {/* Opening outward, not brackets again: sharing the grouping icon
                made undoing look like doing it once more. */}
            <ArrowsOutSimple weight="bold" aria-hidden="true" />
          </button>
        </span>
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
          {/*
            The part itself is the selection target. Nothing appears between
            the operands — a button there pushed the row when it showed, or
            covered the operator when it did not, and the fix for one was the
            other. Clicking a part selects it; clicking a second extends the
            range between them, the way selecting works in every list.
          */}
          {chain.map((part, index) => (
            <span
              key={index}
              className="expr__chain-item"
              /* Marks a part that can be selected, so the cursor never
                 promises what a two-part chain cannot do. */
              data-selectable={chain.length > 2 || undefined}
            >
              {index > 0 && part.setOperator && (
                <>
                  <Picker
                    value={value.operator}
                    groups={operatorGroups}
                    onChange={(operator) => onChange(part.setOperator?.(operator) ?? value)}
                    label={d.fields.operator}
                    variant="operator"
                  />

                </>
              )}
              <ExpressionEditor
                value={part.node}
                onChange={(next) => onChange(part.replace(next))}
                variables={variables}
                expect={operandExpect}
                mode={mode === 'condition' ? 'value' : mode}
                nested
                /* `a + b * c` flattens to a row of `+` parts, one of which is
                   the multiplication — the row is exactly where the tighter
                   binding stops being visible, so the mark matters most here. */
                parentPrecedence={precedenceOf(value)}
                /* Every part but the last can join the one after it. */
                groupWithNext={
                  chain.length > 2 && index < chain.length - 1
                    ? () => {
                        const grouped = groupParts(chain, index, index + 1, value.operator);
                        if (grouped) onChange(grouped);
                      }
                    : undefined
                }
                onRemove={
                  chain.length > 1
                    ? () => onChange(removeAt(chain, index, value.operator))
                    : undefined
                }
              />
            </span>
          ))}

          {/* Confirming the selection. Only once two parts are picked: one
              part is already a unit, so there is nothing to bracket. */}


        </>
      )}

      {value.kind === 'binary' && !isChain && (
        <>
          {/*
            A comparison is the common case here — `edad >= 18` — and it never
            flattens, since `a > b > c` has no meaning. Both sides still need
            their own remove: dropping one collapses the expression to the
            other, which is how a student backs out of a comparison they did
            not mean to start.
          */}
          <ExpressionEditor
            value={value.left}
            onChange={(left) => onChange({ ...value, left })}
            variables={variables}
            expect={operandExpect}
            mode={mode === 'condition' ? 'value' : mode}
            nested
            parentPrecedence={precedenceOf(value)}
            onRemove={() => onChange(value.right)}
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
            expect={operandExpect}
            mode={mode === 'condition' ? 'value' : mode}
            nested
            parentPrecedence={precedenceOf(value)}
            onRemove={() => onChange(value.left)}
          />
        </>
      )}

      {/*
        Options for *this* value, reached by clicking the caret beside it.
        Each operand owns its own, so in "a + b + c" the middle part can be
        turned into a variable or dropped. One bar for the whole expression
        meant only the last operand could be touched at all.
      */}
      {isOperand && (
        <Picker
          value={value.kind === 'variable' ? 'variable' : `kind:${value.valueKind}`}
          groups={[
            /*
              The type of the value itself. Only `declare` used to offer this,
              via its own chip, so a number typed into a condition or a
              `decir` was stuck as whatever it started as. Hidden when the
              slot dictates the type — a `repetir N veces` is always a number,
              and offering to make it text would be offering a mistake.
            */
            ...(expect === 'any'
              ? [
                  {
                    label: d.fields.expect,
                    options: KINDS.map((kind) => ({
                      value: `kind:${kind}` as const,
                      label: d.kinds[kind],
                      // The same icon the declaration chip uses, so a type is
                      // recognisable wherever it appears.
                      icon: typeIcon[kind],
                    })),
                  },
                ]
              : []),
            ...(canReference
              ? [
                  {
                    label: expect === 'any' ? d.fields.value : undefined,
                    options: [
                      { value: 'literal' as const, label: d.fields.aValue, icon: Keyboard },
                      { value: 'variable' as const, label: d.fields.aVariable, icon: Tag },
                    ],
                  },
                ]
              : []),
            /*
              Grouping lives in this menu rather than on a click.

              A click on a part could mean three things — type in the field,
              swap the value for a variable, or pick it for grouping — and
              nothing told the student which. The menu already answers "what do
              I do with this part", so the third answer belongs beside the
              other two, where it is named instead of guessed.
            */
            ...(groupWithNext
              ? [
                  {
                    options: [
                      {
                        value: 'group' as const,
                        label: d.actions.group,
                        icon: BracketsRound,
                      },
                    ],
                  },
                ]
              : []),
            ...(onRemove
              ? [
                  {
                    options: [
                      {
                        value: 'remove' as const,
                        label: d.actions.removeOperand,
                        icon: Trash,
                        danger: true,
                      },
                    ],
                  },
                ]
              : []),
          ]}
          onChange={(choice) => {
            if (choice === 'group') groupWithNext?.();
            else if (choice === 'remove') onRemove?.();
            else if (choice === 'literal' || choice === 'variable') setSource(choice);
            else onChange(castExpression(value, choice.slice('kind:'.length) as LiteralKind));
          }}
          label={d.fields.value}
          variant="options"
        />
      )}

      {/* Extending belongs to the expression as a whole, so it appears once. */}
      {!nested && (
        <span className="expr__tools">
          <button
            type="button"
            className="expr__tool expr__tool--add"
            onClick={extend}
            title={d.actions.addValue}
          >
            <Plus weight="bold" />
            <span className="expr__tool-label">{d.actions.addOperand}</span>
          </button>
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
    // A native select here drew the operating system's own arrow, which sat
    // beside the options caret as a second, differently-shaped one.
    return (
      <Picker
        value={String(value.value) as 'true' | 'false'}
        groups={[
          {
            options: [
              { value: 'true', label: d.booleans.true, icon: CheckCircle },
              { value: 'false', label: d.booleans.false, icon: XCircle },
            ],
          },
        ]}
        onChange={(next) => onChange(literal(next === 'true', 'boolean'))}
        label={d.fields.value}
        variant="boolean"
      />
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
      // allows for them; without the slack the last characters get clipped. An
      // empty field is sized to its placeholder, which is text the student
      // still has to read rather than a value that happens to be absent.
      style={{
        width: `${Math.max(String(value.value).length, placeholder?.length ?? 0, 6) + 3}ch`,
      }}
    />
  );
}
