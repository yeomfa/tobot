/**
 * Parts of Tobot that are built but not shown, while the editors are the focus.
 *
 * Switched off here and nowhere else, so turning one back on is a single edit.
 * Off means hidden, not removed: the code stays, its tests keep running, and a
 * document that already carries a world is simply shown without it.
 */
export const FEATURES = {
  /** Classrooms: rooms, assignments, review and authoring. */
  classroom: false,
  /** Scenarios a program acts on, and the challenges played in them. */
  worlds: false,
} as const;
