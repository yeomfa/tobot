import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';

import { createId } from '../core/ast/factory';
import {
  insertStatement,
  moveStatement,
  removeStatement,
  updateStatement,
} from '../core/ast/operations';
import type { Location } from '../core/ast/operations';
import type { Algorithm, NodeId, Statement } from '../core/ast/types';
import { createAlgorithmStore } from './storage';

/** How many edits back the student can undo. */
const HISTORY_LIMIT = 60;
/** Debounce so typing in a field does not hit storage on every keystroke. */
const SAVE_DELAY_MS = 500;

/** How long "saved" stays up before the header goes quiet again. */
const SAVED_VISIBLE_MS = 2200;

export function createEmptyAlgorithm(name: string): Algorithm {
  const now = new Date().toISOString();
  return { id: `alg_${createId().slice(2)}`, name, body: [], createdAt: now, updatedAt: now };
}

/**
 * An untouched blank algorithm is scratch space, not work worth keeping.
 * Persisting it would add an empty row to the library on every visit.
 */
function isWorthSaving(algorithm: Algorithm, blankName: string): boolean {
  return algorithm.body.length > 0 || algorithm.name !== blankName;
}

/**
 * Algorithm and its undo history live in one reducer.
 *
 * Keeping them together is what makes undo correct: a single pure transition
 * moves the body and both stacks at once, so there is no window where history
 * and content disagree, and React is free to replay any action.
 */
interface EditorState {
  algorithm: Algorithm;
  past: Statement[][];
  future: Statement[][];
}

type Action =
  | { type: 'edit'; transform: (body: Statement[]) => Statement[] }
  | { type: 'rename'; name: string }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'load'; algorithm: Algorithm };

function touch(algorithm: Algorithm, body: Statement[]): Algorithm {
  return { ...algorithm, body, updatedAt: new Date().toISOString() };
}

function reducer(state: EditorState, action: Action): EditorState {
  switch (action.type) {
    case 'edit': {
      const body = action.transform(state.algorithm.body);
      // Operations return the original array when nothing changed; skipping
      // those keeps no-op drags out of the undo stack.
      if (body === state.algorithm.body) return state;
      return {
        algorithm: touch(state.algorithm, body),
        past: [...state.past, state.algorithm.body].slice(-HISTORY_LIMIT),
        future: [],
      };
    }

    case 'rename':
      return {
        ...state,
        algorithm: { ...state.algorithm, name: action.name, updatedAt: new Date().toISOString() },
      };

    case 'undo': {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        algorithm: touch(state.algorithm, previous),
        past: state.past.slice(0, -1),
        future: [state.algorithm.body, ...state.future],
      };
    }

    case 'redo': {
      if (state.future.length === 0) return state;
      return {
        algorithm: touch(state.algorithm, state.future[0]),
        past: [...state.past, state.algorithm.body].slice(-HISTORY_LIMIT),
        future: state.future.slice(1),
      };
    }

    case 'load':
      return { algorithm: action.algorithm, past: [], future: [] };
  }
}

export interface AlgorithmController {
  algorithm: Algorithm;
  canUndo: boolean;
  canRedo: boolean;
  setName: (name: string) => void;
  add: (statement: Statement, location: Location) => void;
  update: (id: NodeId, update: (statement: Statement) => Statement) => void;
  remove: (id: NodeId) => void;
  move: (id: NodeId, destination: Location) => void;
  replaceBody: (body: Statement[]) => void;
  undo: () => void;
  redo: () => void;
  load: (algorithm: Algorithm) => void;
  /** What the last save did, for anything that wants to show it. */
  saveState: SaveState;
}

/**
 * What the last save attempt did.
 *
 * `idle` covers both "nothing has changed" and "there is nowhere to save to":
 * working locally, the write is synchronous and cannot fail, so announcing it
 * would be noise about something that was never in doubt.
 */
export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function useAlgorithm(initial: Algorithm, blankName = ''): AlgorithmController {
  const [state, dispatch] = useReducer(reducer, {
    algorithm: initial,
    past: [],
    future: [],
  });

  const store = useMemo(() => createAlgorithmStore(), []);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(state.algorithm);
  latest.current = state.algorithm;

  const [saveState, setSaveState] = useState<SaveState>('idle');
  const clearSaved = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* Only a remote save is worth reporting: a local write is synchronous and
     cannot fail, so a "saved" badge would be telling the student something
     that was never in question. */
  const reports = useMemo(() => store.isRemote, [store]);

  // Debounced persistence, so typing does not hit storage on every keystroke.
  useEffect(() => {
    if (!isWorthSaving(state.algorithm, blankName)) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);

    if (clearSaved.current) clearTimeout(clearSaved.current);

    saveTimer.current = setTimeout(() => {
      if (!reports) {
        void store.save(state.algorithm);
        return;
      }

      setSaveState('saving');
      store.save(state.algorithm).then(
        () => {
          setSaveState('saved');
          /* "Saved" steps back after a moment. A badge that never leaves stops
             being read, and then it cannot report the one state that matters.
             A failure has no timer: the work really is only in this browser,
             and that does not stop being true because time passed. */
          clearSaved.current = setTimeout(() => setSaveState('idle'), SAVED_VISIBLE_MS);
        },
        (thrown: unknown) => {
          setSaveState('error');
          console.error('[tobot] could not save algorithm:', thrown);
        },
      );
    }, SAVE_DELAY_MS);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (clearSaved.current) clearTimeout(clearSaved.current);
    };
  }, [state.algorithm, store, blankName, reports]);

  // Flush on unmount so an edit mid-debounce is never lost. Nothing reports
  // the outcome here: the component showing it is already going away.
  useEffect(() => {
    return () => {
      if (isWorthSaving(latest.current, blankName)) {
        store.save(latest.current).catch((thrown: unknown) => {
          console.error('[tobot] could not save algorithm on exit:', thrown);
        });
      }
    };
  }, [store, blankName]);

  const edit = useCallback((transform: (body: Statement[]) => Statement[]) => {
    dispatch({ type: 'edit', transform });
  }, []);

  return {
    algorithm: state.algorithm,
    saveState,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    setName: useCallback((name: string) => dispatch({ type: 'rename', name }), []),
    add: useCallback(
      (statement: Statement, location: Location) =>
        edit((body) => insertStatement(body, statement, location)),
      [edit],
    ),
    update: useCallback(
      (id: NodeId, transform: (statement: Statement) => Statement) =>
        edit((body) => updateStatement(body, id, transform)),
      [edit],
    ),
    remove: useCallback((id: NodeId) => edit((body) => removeStatement(body, id)), [edit]),
    move: useCallback(
      (id: NodeId, destination: Location) =>
        edit((body) => moveStatement(body, id, destination)),
      [edit],
    ),
    replaceBody: useCallback((body: Statement[]) => edit(() => body), [edit]),
    undo: useCallback(() => dispatch({ type: 'undo' }), []),
    redo: useCallback(() => dispatch({ type: 'redo' }), []),
    load: useCallback((algorithm: Algorithm) => dispatch({ type: 'load', algorithm }), []),
  };
}
