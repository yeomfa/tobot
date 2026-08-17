import type { Algorithm, NodeId } from '../ast/types';
import type { Language } from '../../i18n/types';

/** One rendered line, linked back to the AST node that produced it. */
export interface EmittedLine {
  /** Source statement, or `null` for scaffolding lines like a closing brace. */
  nodeId: NodeId | null;
  indent: number;
  text: string;
}

export interface EmitterContext {
  /** UI language, so natural language and pseudocode follow the student. */
  locale: Language;
}

export interface Emitter {
  id: TargetId;
  /** Language name shown on the tab; not translated, these are proper names. */
  label: string;
  /** Highlighter hint and file extension for export. */
  syntax: 'natural' | 'pseudocode' | 'javascript' | 'python';
  extension: string;
  emit: (algorithm: Algorithm, context: EmitterContext) => EmittedLine[];
}

export type TargetId = 'natural' | 'pseudocode' | 'javascript' | 'python';

export function renderLines(lines: EmittedLine[], indentUnit = '  '): string {
  return lines.map((line) => `${indentUnit.repeat(line.indent)}${line.text}`).join('\n');
}
