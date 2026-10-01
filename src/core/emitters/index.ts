import { javascriptEmitter } from './javascript';
import { naturalEmitter } from './natural';
import { pseudocodeEmitter } from './pseudocode';
import { pythonEmitter } from './python';
import { localizeWorldCalls } from '../world/localize';
import type { Emitter, TargetId } from './types';

/** Every emitter sees world calls by the names the student reads them by. */
function localized(emitter: Emitter): Emitter {
  return {
    ...emitter,
    emit: (algorithm, context) => emitter.emit(localizeWorldCalls(algorithm, context.locale), context),
  };
}

/**
 * Single registry of output languages. To add one (Java, C, …) write an emitter
 * and list it here — the tabs, the language select and the export dialog all
 * read from this map.
 */
export const emitters: Record<TargetId, Emitter> = {
  natural: localized(naturalEmitter),
  pseudocode: localized(pseudocodeEmitter),
  javascript: localized(javascriptEmitter),
  python: localized(pythonEmitter),
};

/** Targets offered in the "Code" tab's language select. */
export const codeTargets: TargetId[] = ['javascript', 'python'];

export { renderLines } from './types';
export type { EmittedLine, Emitter, EmitterContext, TargetId } from './types';
