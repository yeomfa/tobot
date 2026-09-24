import type { RunnerEvent, RunnerRequest } from '../code/runner.worker';
import type { Case, CaseResult, Mark } from './grade';
import { linesMatch, markFrom } from './grade';

/** Long enough for any exercise at this level, short enough to mark a class. */
const PATIENCE_MS = 5000;

/**
 * Runs one program against one case in a worker, and says what it printed.
 *
 * A fresh worker per case, and terminated either way. Marking thirty
 * submissions is thirty programs written by people who are still learning what
 * a loop does — reusing one worker would mean the first runaway loop poisons
 * everything after it, and terminating is the only reliable way to stop code
 * this app never looked at.
 */
function runCase(source: string, trial: Case): Promise<CaseResult> {
  return new Promise((resolve) => {
    const worker = new Worker(new URL('../code/runner.worker.ts', import.meta.url), {
      type: 'module',
    });

    const said: string[] = [];
    const answers = [...trial.answers];
    let settled = false;

    const finish = (passed: boolean): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      resolve({ passed, got: said });
    };

    const timer = setTimeout(() => finish(false), PATIENCE_MS);

    worker.onmessage = (event: MessageEvent<RunnerEvent>) => {
      const message = event.data;

      if (message.type === 'say') {
        said.push(message.text);
        return;
      }
      if (message.type === 'ask') {
        /* An empty string once the answers run out, which is what the app does
           when a student presses enter on nothing. A program that asks more
           than it was told about fails on its output, not by hanging. */
        const reply: RunnerRequest = { type: 'answer', value: answers.shift() ?? '' };
        worker.postMessage(reply);
        return;
      }
      if (message.type === 'error') {
        // It did not answer the question, whatever it printed on the way.
        finish(false);
        return;
      }
      if (message.type === 'done') {
        finish(linesMatch(said, trial.expect));
      }
    };

    worker.onerror = () => finish(false);

    const start: RunnerRequest = { type: 'run', source };
    worker.postMessage(start);
  });
}

/**
 * Marks a code submission.
 *
 * Cases run one after another rather than together: each is a whole worker,
 * and a class of thirty submissions with three cases each would otherwise ask
 * the browser for ninety threads at once.
 */
export async function gradeCode(source: string, cases: Case[], points: number): Promise<Mark> {
  const results: CaseResult[] = [];
  for (const trial of cases) {
    results.push(await runCase(source, trial));
  }
  return markFrom(points, results);
}
