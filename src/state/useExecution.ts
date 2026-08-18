import { useCallback, useEffect, useRef, useState } from 'react';

import type { Statement } from '../core/ast/types';
import { Interpreter } from '../core/runtime/interpreter';
import type { ExecutionState } from '../core/runtime/types';

export type Speed = 'slow' | 'normal' | 'fast';

/**
 * Milliseconds between steps in continuous playback.
 *
 * These are pitched for watching, not for finishing: at "normal" a student has
 * time to follow the highlight move through the blocks, the code and the
 * diagram at once. The previous 420ms was faster than that reading takes.
 */
const SPEED_DELAY: Record<Speed, number> = {
  slow: 1600,
  normal: 800,
  fast: 250,
};

const IDLE_STATE: ExecutionState = {
  status: 'idle',
  currentNodeId: null,
  variables: [],
  output: [],
  error: null,
  stepCount: 0,
  pendingPrompt: null,
};

export interface ExecutionController {
  state: ExecutionState;
  isPlaying: boolean;
  speed: Speed;
  setSpeed: (speed: Speed) => void;
  /** Runs continuously until the program finishes or asks for input. */
  play: () => void;
  pause: () => void;
  /** Executes exactly one statement. */
  stepOnce: () => void;
  stop: () => void;
  answer: (value: string) => void;
}

/**
 * Drives the interpreter on a timer.
 *
 * The machine itself is synchronous and pausable; this hook only decides *when*
 * to advance it, which is what lets the same interpreter serve both "run" and
 * "step through" without duplicating execution logic.
 */
export function useExecution(program: Statement[]): ExecutionController {
  const [state, setState] = useState<ExecutionState>(IDLE_STATE);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>('normal');

  const machine = useRef<Interpreter | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * Whether the student pressed "Run" rather than "Step". An `ask` pauses both
   * modes identically, so this records which one to return to once they answer.
   */
  const wasPlaying = useRef(false);

  const clearTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  /** Creates the machine on first use, or after the program was edited. */
  const ensureMachine = useCallback((): Interpreter => {
    if (!machine.current) machine.current = new Interpreter(program);
    return machine.current;
  }, [program]);

  // Editing the algorithm invalidates any run in progress.
  useEffect(() => {
    clearTimer();
    machine.current = null;
    setIsPlaying(false);
    setState(IDLE_STATE);
  }, [program, clearTimer]);

  useEffect(() => clearTimer, [clearTimer]);

  const stepOnce = useCallback(() => {
    wasPlaying.current = false;
    const machineRef = ensureMachine();
    // Stepping past the end restarts, matching what "Run" does.
    if (state.status === 'finished' || state.status === 'error') {
      machineRef.reset();
    }
    const next = machineRef.step();
    setState(next);
    // Input and termination both end continuous playback.
    if (next.status !== 'running') setIsPlaying(false);
  }, [ensureMachine, state.status]);

  // Continuous playback: schedule the next step after each render of state.
  useEffect(() => {
    if (!isPlaying) return;
    const current = machine.current;
    if (!current) return;

    if (state.status === 'finished' || state.status === 'error' || state.status === 'awaitingInput') {
      setIsPlaying(false);
      return;
    }

    timer.current = setTimeout(() => {
      const next = current.step();
      setState(next);
      if (next.status !== 'running') setIsPlaying(false);
    }, SPEED_DELAY[speed]);

    return clearTimer;
  }, [isPlaying, state, speed, clearTimer]);

  const play = useCallback(() => {
    const current = ensureMachine();
    // Re-running a finished program starts it over rather than doing nothing.
    if (state.status === 'finished' || state.status === 'error') {
      current.reset();
      setState(current.getState());
    }
    wasPlaying.current = true;
    setIsPlaying(true);
  }, [ensureMachine, state.status]);

  const pause = useCallback(() => {
    clearTimer();
    wasPlaying.current = false;
    setIsPlaying(false);
  }, [clearTimer]);

  const stop = useCallback(() => {
    clearTimer();
    wasPlaying.current = false;
    setIsPlaying(false);
    machine.current = null;
    setState(IDLE_STATE);
  }, [clearTimer]);

  const answer = useCallback((value: string) => {
    const current = machine.current;
    if (!current) return;
    const next = current.provideInput(value);
    setState(next);
    // Only resume automatically if they were running; a student who was
    // stepping expects to stay in control after answering.
    if (next.status === 'running' && wasPlaying.current) setIsPlaying(true);
  }, []);

  return { state, isPlaying, speed, setSpeed, play, pause, stepOnce, stop, answer };
}
