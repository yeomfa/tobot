import { useCallback, useMemo, useState } from 'react';

import { rangeBetween } from '../core/ast/operations';
import type { NodeId, Statement } from '../core/ast/types';

/**
 * Which statements are selected, and how clicking changes that.
 *
 * A plain click selects one and becomes the anchor; shift-clicking extends
 * from that anchor to whatever was clicked. The anchor is what makes a second
 * shift-click *replace* the range rather than grow it further, which is how
 * selection behaves in every list a student has used.
 *
 * Ranges only span siblings — `rangeBetween` decides that — so shift-clicking
 * across a loop boundary quietly selects just the one clicked instead of
 * inventing a selection that could not be copied or deleted as a unit.
 */
export interface Selection {
  /** Ids currently selected, in document order. */
  ids: NodeId[];
  has: (id: NodeId) => boolean;
  /** Handles a click on a statement, extending when shift is held. */
  select: (id: NodeId, extend: boolean) => void;
  clear: () => void;
  /** Replaces the selection outright, for after a paste. */
  set: (ids: NodeId[]) => void;
}

export function useSelection(body: Statement[]): Selection {
  const [ids, setIds] = useState<NodeId[]>([]);
  /* Where a shift-click measures from. Kept apart from the selection itself:
     after extending, the anchor stays put so the range can be resized. */
  const [anchor, setAnchor] = useState<NodeId | null>(null);

  const select = useCallback(
    (id: NodeId, extend: boolean) => {
      if (extend && anchor) {
        setIds(rangeBetween(body, anchor, id));
        return;
      }
      setIds([id]);
      setAnchor(id);
    },
    [body, anchor],
  );

  const clear = useCallback(() => {
    setIds([]);
    setAnchor(null);
  }, []);

  const set = useCallback((next: NodeId[]) => {
    setIds(next);
    setAnchor(next[next.length - 1] ?? null);
  }, []);

  /*
    Selected ids that no longer exist are dropped.

    Deleting a selected block, or undoing the edit that made it, would
    otherwise leave the selection pointing at nothing — and a later copy would
    quietly produce less than the student could see was highlighted.
  */
  const live = useMemo(() => {
    if (ids.length === 0) return ids;
    const present = new Set<NodeId>();
    const walk = (list: Statement[]): void => {
      for (const statement of list) {
        present.add(statement.id);
        if (statement.kind === 'if') {
          walk(statement.then);
          for (const arm of statement.elseIfs ?? []) walk(arm.body);
          if (statement.otherwise) walk(statement.otherwise);
          continue;
        }
        const nested = (statement as { body?: Statement[] }).body;
        if (nested) walk(nested);
      }
    };
    walk(body);
    const kept = ids.filter((id) => present.has(id));
    return kept.length === ids.length ? ids : kept;
  }, [ids, body]);

  const has = useCallback((id: NodeId) => live.includes(id), [live]);

  return { ids: live, has, select, clear, set };
}
