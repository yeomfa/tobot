import type { Statement } from '../ast/types';
import type { Dictionary } from '../../i18n/es';
import type { Language } from '../../i18n/types';
import { expressionToPseudocode, pseudocodeKeywords } from '../emitters/pseudocode';
import type { FlowLabels, ShapeKind } from './layout';

/** Keeps long expressions from overflowing a flowchart shape. */
function truncate(text: string, max = 30): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/**
 * Flowchart shapes carry short, symbolic labels rather than prose: the diagram
 * is meant to be scanned, and the full sentence already lives in the natural
 * language tab. Input/output statements get the parallelogram, per the usual
 * flowcharting convention taught alongside this material.
 */
export function createFlowLabels(dictionary: Dictionary, locale: Language): FlowLabels {
  const kw = pseudocodeKeywords[locale];
  const expr = (expression: Parameters<typeof expressionToPseudocode>[0]): string =>
    expressionToPseudocode(expression, kw);

  const describe = (statement: Statement): { text: string; shape: ShapeKind } => {
    switch (statement.kind) {
      case 'comment':
        // Only the first line: a diagram node has room for a label, not prose.
        return { text: truncate(statement.text.split('\n')[0] || '…'), shape: 'note' };
      case 'declare':
        return { text: truncate(`${statement.name} ← ${expr(statement.value)}`), shape: 'process' };
      case 'assign': {
        const target = statement.index
          ? `${statement.name}[${expr(statement.index)}]`
          : statement.name;
        return { text: truncate(`${target} ← ${expr(statement.value)}`), shape: 'process' };
      }
      case 'listOp': {
        /* A list operation changes something the program holds, so it takes
           the process shape like any other assignment — it is not a decision
           and not input or output. */
        const value = statement.value ? expr(statement.value) : '';
        const at = statement.index ? expr(statement.index) : '';
        const text =
          statement.operation === 'append'
            ? `${kw.append} ${value} ${kw.to} ${statement.name}`
            : statement.operation === 'insert'
              ? `${kw.insert} ${value} ${kw.at} ${at}`
              : statement.operation === 'removeAt'
                ? `${kw.removeAt} ${statement.name} ${kw.at} ${at}`
                : statement.operation === 'reverse'
                  ? `${kw.reverse} ${statement.name}`
                  : `${kw.sort} ${statement.name}`;
        return { text: truncate(text), shape: 'process' };
      }
      case 'forEachItem':
        return {
          text: truncate(`${statement.variable} ${kw.in} ${expr(statement.list)}`, 26),
          shape: 'decision',
        };
      case 'say':
        return { text: truncate(`${kw.say} ${expr(statement.value)}`), shape: 'io' };
      case 'ask':
        return { text: truncate(`${kw.ask} ${statement.target}`), shape: 'io' };
      case 'if':
        return { text: truncate(expr(statement.condition), 26), shape: 'decision' };
      case 'while':
        return { text: truncate(expr(statement.condition), 26), shape: 'decision' };
      case 'repeat':
        return {
          text: truncate(`${expr(statement.times)} ${kw.times}`, 26),
          shape: 'decision',
        };
      case 'forEach':
        return {
          text: truncate(
            `${statement.variable}: ${expr(statement.from)}..${expr(statement.to)}`,
            26,
          ),
          shape: 'decision',
        };
    }
  };

  return {
    start: dictionary.flowchart.start,
    end: dictionary.flowchart.end,
    yes: dictionary.flowchart.yes,
    no: dictionary.flowchart.no,
    describe,
  };
}
