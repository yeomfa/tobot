import type { WorldComponent, WorldDefinition } from '../../core/world/types';

/**
 * Where each component sits on the panel.
 *
 * The scenario's controls on the left and what the program drives on the
 * right, which is how a control panel is read and how a wiring diagram is
 * drawn: inputs in, outputs out, the program in between. Order within each
 * column is the author's, so a teacher decides that "arranque" sits above
 * "paro" the way it would on the real board.
 */
export interface SceneLayout {
  inputs: WorldComponent[];
  outputs: WorldComponent[];
}

export function layoutScene(definition: WorldDefinition): SceneLayout {
  return {
    inputs: definition.components.filter((one) => one.role === 'input'),
    outputs: definition.components.filter((one) => one.role === 'output'),
  };
}
