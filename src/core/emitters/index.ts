import { javascriptEmitter } from './javascript';
import { naturalEmitter } from './natural';
import { pseudocodeEmitter } from './pseudocode';
import { pythonEmitter } from './python';
import type { Emitter, TargetId } from './types';

/**
 * Single registry of output languages. To add one (Java, C, …) write an emitter
 * and list it here — the tabs, the language select and the export dialog all
 * read from this map.
 */
export const emitters: Record<TargetId, Emitter> = {
  natural: naturalEmitter,
  pseudocode: pseudocodeEmitter,
  javascript: javascriptEmitter,
  python: pythonEmitter,
};

/** Targets offered in the "Code" tab's language select. */
export const codeTargets: TargetId[] = ['javascript', 'python'];

export { renderLines } from './types';
export type { EmittedLine, Emitter, EmitterContext, TargetId } from './types';
