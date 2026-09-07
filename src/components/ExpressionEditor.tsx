import {
  ArrowsOutSimpleIcon as ArrowsOutSimple,
  BracketsRoundIcon as BracketsRound,
  CheckCircleIcon as CheckCircle,
  HashIcon as Hash,
  KeyboardIcon as Keyboard,
  ListBulletsIcon as ListBullets,
  ListNumbersIcon as ListNumbers,
  PlusIcon as Plus,
  TagIcon as Tag,
  TrashIcon as Trash,
  XCircleIcon as XCircle,
} from '@phosphor-icons/react';
import { memo, useEffect, useState } from 'react';

import { castExpression, emptyValue, literal } from '../core/ast/factory';
import type { BinaryOperator, Expression, LiteralKind } from '../core/ast/types';
import { useTranslation } from '../i18n/context';
import { precedenceOf } from '../core/emitters/precedence';
import { ASSOCIATIVE, flattenChain, groupParts, removeAt, ungroup } from './chain';
import { onGroupingArmed } from './grouping';
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
  /**
   * How many parts follow this one in the chain, and how to group a run of
   * them starting here.
   *
   * A count rather than a single action, because grouping in pairs is
   * nesting: joining three parts two at a time gives `((a + b) + c)`, not the
   * `(a + b + c)` the student asked for. The menu offers each reachable run so
   * one choice produces one bracket.
   */
  groupRuns?: { available: number; group: (count: number) => void };
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
  groupRuns,
  onRemove,
}: ExpressionEditorProps) {
  const { d, fill } = useTranslation();

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
    Grouping mode: armed from the block's toolbar, then the student drags
    across the parts that belong together and lets go.

    A mode rather than a menu choice because the menu could say "three parts"
    but never show which three — you had to count. Dragging over them is the
    selection and the preview at once.

    It is deliberately modal: while it is on the block does not drag, which is
    what makes a drag across the parts unambiguous. Every earlier attempt at
    selecting parts failed on exactly that collision.
  */
  const [grouping, setGrouping] = useState(false);
  const [span, setSpan] = useState<[number, number] | null>(null);
  /*
    Whether the pointer is down, which is what separates the two ways to pick a
    run: dragging across the parts, or clicking the first and then the last.

    Without it the two collide — moving the pointer toward the second part
    extends the selection on the way, so by the time the click lands the range
    is already open and the click reads as the start of a third gesture rather
    than the end of this one.
  */
  const [dragging, setDragging] = useState(false);

  const inSpan = (index: number): boolean =>
    span !== null && index >= Math.min(...span) && index <= Math.max(...span);

  /*
    Letting go anywhere ends the gesture. On the window rather than the parts,
    so releasing past the end of the row still commits what was covered —
    otherwise a drag that overshoots leaves the mode armed and the selection
    hanging.
  */
  /*
    While grouping is armed the block must not drag, or a drag across the parts
    picks the whole statement up instead — the collision that defeated every
    previous attempt at selecting parts. Set on the body so the block can see
    it without the two components having to know about each other.
  */
  useEffect(() => {
    if (!grouping) return;
    document.body.setAttribute('data-grouping', 'true');
    return () => document.body.removeAttribute('data-grouping');
  }, [grouping]);

  /*
    Arming from outside the block.

    The canvas menu offers grouping as a tool, and a menu opened on empty
    canvas has no expression to point at — so it arms every chain that has
    something to group, and the student drags over whichever one they meant.
    Chains too short to group ignore it: there is nothing there to bracket.

    An event rather than a prop threaded down from the app: the alternative was
    passing a token through Editor, StatementBlock and every nesting level of
    this component to reach a piece of state that is otherwise entirely local.
  */
  /*
    Two parts is enough.

    The threshold was three, on the reasoning that bracketing a whole
    expression says nothing the row does not. True of what it computes, and
    beside the point: `(a + b) + c` is a step the student is building toward,
    and refusing the first bracket meant the tool was unavailable on most of
    the algorithms they actually write. If they want the brackets, they get the
    brackets.
  */
  useEffect(() => {
    if (!isChain || chain.length < 2) return;
    const arm = (): void => {
      setGrouping(true);
      setSpan(null);
    };
    return onGroupingArmed(arm);
  }, [isChain, chain.length]);

  useEffect(() => {
    if (!grouping) return;
    const commit = (): void => {
      /*
        Only a gesture that actually covered parts ends the mode.

        Releasing anywhere used to disarm, so a click on a field — or anywhere
        on the canvas — switched grouping off with nothing to show for it: the
        parts stopped glowing and nothing said why. Now a release that touched
        no part leaves the mode exactly as it was, and Escape is the way out.
      */
      setDragging(false);

      // Read straight from state rather than from inside a setter: the
      // updater runs during render, so a flag set in there is not readable
      // here, and the decisions below need it now.
      if (span === null) return;

      /*
        A release that covered only one part leaves the mode armed with that
        part still picked.

        Releasing used to end the mode whatever it had covered, so a click on a
        part — which is a press and a release on the same one — switched
        grouping off with nothing grouped and nothing said. One part is not a
        group; it is half a selection, and the student is mid-gesture. Clicking
        a second part extends the range, which is how selecting works in every
        list, and is what the span was built for.
      */
      if (Math.abs(span[0] - span[1]) === 0) return;

      if (value.kind === 'binary') {
        const grouped = groupParts(
          flattenChain(value, value.operator),
          span[0],
          span[1],
          value.operator,
        );
        if (grouped) onChange(grouped);
      }
      setSpan(null);
      // One grouping per arming: the mode is a deliberate state, not a
      // sticky one that keeps catching later drags.
      setGrouping(false);
    };
    /*
      Escape backs out without grouping anything.

      The block used to carry a "Cancelar" button, which was also the way in;
      both are gone, since grouping is offered by the canvas menu now and the
      pair of them took a permanent strip of every expression. Escape is the
      conventional way out of a mode and costs the block no space at all.
    */
    const cancel = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      setSpan(null);
      setDragging(false);
      setGrouping(false);
    };
    window.addEventListener('pointerup', commit);
    window.addEventListener('keydown', cancel);
    return () => {
      window.removeEventListener('pointerup', commit);
      window.removeEventListener('keydown', cancel);
    };
  }, [grouping, span, value, onChange]);

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
  type Source = 'literal' | 'variable' | 'list' | 'index' | 'length';
  const source: Source =
    value.kind === 'variable' ||
    value.kind === 'list' ||
    value.kind === 'index' ||
    value.kind === 'length'
      ? value.kind
      : 'literal';

  const setSource = (next: Source): void => {
    if (next === source) return;
    const firstName = variables[0] ?? '';
    switch (next) {
      case 'variable':
        onChange({ kind: 'variable', name: firstName });
        return;
      /* A new list starts with one item rather than none. An empty pair of
         brackets gives the student nothing to click on and nothing to turn
         into what they meant. */
      case 'list':
        onChange({ kind: 'list', items: [literal(0, 'number')] });
        return;
      /* Both of these need a list to point at, and the variable already in
         hand is the likeliest one — asking first would mean a menu inside a
         menu for the common case. */
      case 'index':
        onChange({
          kind: 'index',
          list: { kind: 'variable', name: firstName },
          index: literal(0, 'number'),
        });
        return;
      case 'length':
        onChange({ kind: 'length', list: { kind: 'variable', name: firstName } });
        return;
      case 'literal':
        onChange(expect === 'any' ? literal('', 'text') : emptyValue(expect));
    }
  };

  /**
   * A single value, rather than something built out of other values. Only
   * these can be swapped for a variable or dropped, so only these carry the
   * options caret.
   */
  /*
    A group counts as an operand for the options menu, which is what lets it be
    grouped again: `(1 + 2) + 3 + 4` could not become `((1 + 2) + 3) + 4`
    because the capsule offered no menu of its own, so grouping was a
    once-only move on any given pair.

    Its type options are hidden separately — a group has no literal kind to
    change — leaving the actions, which is all it needs.
  */
  const isOperand =
    value.kind === 'literal' || value.kind === 'variable' || value.kind === 'group';

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

      {value.kind === 'list' && (
        <span className="expr__list">
          <span className="expr__bracket" aria-hidden="true">
            [
          </span>
          {value.items.map((item, position) => (
            <span className="expr__list-item" key={position}>
              {position > 0 && (
                <span className="expr__comma" aria-hidden="true">
                  ,
                </span>
              )}
              <ExpressionEditor
                value={item}
                onChange={(next) =>
                  onChange({
                    ...value,
                    items: value.items.map((old, i) => (i === position ? next : old)),
                  })
                }
                variables={variables}
                mode={mode}
                nested
                /* The last item cannot be removed: an empty list is reachable
                   by switching the whole part back to a value, and a list with
                   no items and no controls is a dead end. */
                onRemove={
                  value.items.length > 1
                    ? () =>
                        onChange({
                          ...value,
                          items: value.items.filter((_, i) => i !== position),
                        })
                    : undefined
                }
              />
            </span>
          ))}
          <button
            type="button"
            className="expr__tool expr__tool--add expr__list-add"
            onClick={() => onChange({ ...value, items: [...value.items, literal(0, 'number')] })}
            title={d.actions.addValue}
          >
            <Plus weight="bold" />
          </button>
          <span className="expr__bracket" aria-hidden="true">
            ]
          </span>
        </span>
      )}

      {value.kind === 'index' && (
        <span className="expr__indexed">
          <ExpressionEditor
            value={value.list}
            onChange={(list) => onChange({ ...value, list })}
            variables={variables}
            mode={mode}
            nested
          />
          <span className="expr__bracket" aria-hidden="true">
            [
          </span>
          <ExpressionEditor
            value={value.index}
            onChange={(index) => onChange({ ...value, index })}
            variables={variables}
            expect="number"
            mode={mode}
            nested
          />
          <span className="expr__bracket" aria-hidden="true">
            ]
          </span>
        </span>
      )}

      {value.kind === 'length' && (
        <span className="expr__length">
          <span className="expr__op">{d.fields.howMany}</span>
          <ExpressionEditor
            value={value.list}
            onChange={(list) => onChange({ ...value, list })}
            variables={variables}
            mode={mode}
            nested
          />
        </span>
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
              data-grouping={grouping || undefined}
              /*
                Where in the run this part falls, so the highlight can close
                only at the ends and run straight through the middle — a row of
                separately outlined parts reads as several selections rather
                than the one group they are about to become.
              */
              data-in-span={
                inSpan(index)
                  ? span && index === Math.min(...span)
                    ? index === Math.max(...span)
                      ? 'only'
                      : 'start'
                    : span && index === Math.max(...span)
                      ? 'end'
                      : 'middle'
                  : undefined
              }
              onPointerDown={
                grouping
                  ? (event) => {
                      event.preventDefault();
                      /*
                        The press belongs to the innermost part under it.

                        A group is one part of the chain around it, so the two
                        overlap: pressing a part inside a bracket also lands on
                        the bracket as a whole. React dispatches from the
                        target outwards, so stopping here is what leaves the
                        inner selection to the expression the student is
                        actually pointing at, and is what makes grouping inside
                        an existing group possible.
                      */
                      event.stopPropagation();
                      /*
                        A press with one part already picked extends to here,
                        rather than starting over. That is what makes clicking
                        two parts work as well as dragging across them — the
                        comment above promised it, and restarting the span on
                        every press meant only the drag ever did.
                      */
                      setDragging(true);
                      setSpan((current) =>
                        current ? [current[0], index] : [index, index],
                      );
                    }
                  : undefined
              }
              /* Only while the button is down: hovering used to extend the
                 range, which made the preview follow the pointer around after
                 a click and swallowed the click that was meant to close it. */
              onPointerEnter={
                grouping && dragging && span
                  ? (event) => {
                      // Same reason as the press: the innermost part wins, or
                      // dragging inside a bracket extends the outer range.
                      event.stopPropagation();
                      setSpan([span[0], index]);
                    }
                  : undefined
              }
              /* Marks a part that can be selected, so the cursor never
                 promises what a two-part chain cannot do. */
              data-selectable
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
                groupRuns={{
                  /*
                    Every run that starts here and ends before the chain does.
                    From the first of four parts that is three choices — two,
                    three or all four — and each is one bracket rather than a
                    stack of nested ones.
                  */
                  available: chain.length - 1 - index,
                  group: (count) => {
                    const grouped = groupParts(chain, index, index + count - 1, value.operator);
                    if (grouped) onChange(grouped);
                  },
                }}
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
          value={
            value.kind === 'variable'
              ? 'variable'
              : value.kind === 'group'
                ? 'group'
                : `kind:${value.valueKind}`
          }
          groups={[
            /*
              The type of the value itself. Only `declare` used to offer this,
              via its own chip, so a number typed into a condition or a
              `decir` was stuck as whatever it started as. Hidden when the
              slot dictates the type — a `repetir N veces` is always a number,
              and offering to make it text would be offering a mistake.
            */
            /* A group has no literal kind of its own to change — its type is
               whatever the expression inside it produces. */
            ...(expect === 'any' && value.kind !== 'group'
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
            ...(canReference && value.kind !== 'group'
              ? [
                  {
                    label: expect === 'any' ? d.fields.value : undefined,
                    options: [
                      { value: 'literal' as const, label: d.fields.aValue, icon: Keyboard },
                      { value: 'variable' as const, label: d.fields.aVariable, icon: Tag },
                      /* Only where a list would make sense. A field that must
                         hold a number — a loop's step, a position — offers
                         `length` but not a whole list, since one can be
                         counted and the other cannot be counted with. */
                      ...(expect === 'any'
                        ? [{ value: 'list' as const, label: d.fields.aList, icon: ListBullets }]
                        : []),
                      { value: 'index' as const, label: d.fields.anItem, icon: ListNumbers },
                      { value: 'length' as const, label: d.fields.howMany, icon: Hash },
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
            /*
              Headed, because the menu holds two unlike things: what kind of
              value this is, and what to do with the part. Without a heading
              "Agrupar con la siguiente" sat in the same list as "número" and
              read like another type.
            */
            ...(groupRuns && groupRuns.available > 0
              ? [
                  {
                    label: d.actions.partActions,
                    /*
                      One option per run length, so "these three together" is a
                      single choice. Grouping repeatedly instead nests, which
                      is a different shape and not what was asked for.
                    */
                    options: Array.from({ length: groupRuns.available }, (_, step) => {
                      const count = step + 2;
                      return {
                        value: `group:${count}` as const,
                        label: fill(d.actions.groupCount, { count }),
                        icon: BracketsRound,
                      };
                    }),
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
            if (choice.startsWith('group:')) groupRuns?.group(Number(choice.slice(6)));
            else if (choice === 'remove') onRemove?.();
            else if (
              choice === 'literal' ||
              choice === 'variable' ||
              choice === 'list' ||
              choice === 'index' ||
              choice === 'length'
            ) {
              setSource(choice);
            }
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
