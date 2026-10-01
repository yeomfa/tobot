import type { Language } from '../../i18n/types';

/**
 * A world a program can act on: a panel of lamps and motors, a conveyor, a
 * safety scenario.
 *
 * Everything here is data, and pure. The world does not know about blocks,
 * code, React or the DOM; the interpreter hosts it on the main thread and the
 * code runner hosts it inside its worker, and both call the same functions, so
 * one program produces one world whichever editor it was written in.
 */

/**
 * Who owns a component's value.
 *
 * Two kinds are enough to start, and they are domain-free on purpose. An
 * `input` belongs to the scenario — a pushbutton, a limit switch, a gas
 * detector — and the program can only read it. An `output` belongs to the
 * program — a lamp, a motor, an alarm — and the program sets it. A presence
 * sensor and a conveyor are these same two in other skins, which is how one
 * engine serves electromechanics, production and safety alike.
 */
export type ComponentRole = 'input' | 'output';

/** How a component is drawn. Purely visual: behaviour comes from its role. */
export type Skin = 'pushbutton' | 'switch' | 'sensor' | 'lamp' | 'motor' | 'siren';

export interface WorldComponent {
  /** The name a program uses for it: `encender("motor")`. */
  id: string;
  role: ComponentRole;
  skin: Skin;
  /** What the scene shows under it. */
  label: string;
  /** Its value before anything happens. Off unless said otherwise. */
  initial?: boolean;
}

/** Something the scenario does on its own at a known moment: press a button. */
export interface TimelineEvent {
  /** Seconds of world time. */
  at: number;
  id: string;
  value: boolean;
}

export interface WorldDefinition {
  /** Which template it came from, so an author's picker can show it. */
  template: string;
  components: WorldComponent[];
  /**
   * How long the scenario lasts, in seconds of world time.
   *
   * A control program is an endless loop by nature — read the buttons, set the
   * motor, wait, again — and the scenario ending is what lets that loop end,
   * normally and at a known moment, so it can be watched and marked.
   */
  duration: number;
}

/** One value changing, and when, which is what a scene plays back. */
export interface WorldChange {
  time: number;
  id: string;
  value: boolean;
}

/**
 * The world at one moment.
 *
 * Immutable: every function returns a new one. That is what makes stepping
 * back free — the interpreter keeps the old one in its snapshot — and what
 * keeps two hosts from disagreeing about who changed what.
 */
export interface WorldState {
  definition: WorldDefinition;
  /** Seconds of world time. Only `esperar` moves it. */
  time: number;
  values: Readonly<Record<string, boolean>>;
  /** What every component started as, so a past moment can be rebuilt. */
  initial: Readonly<Record<string, boolean>>;
  /** Scenario events not yet reached, soonest first. */
  pending: readonly TimelineEvent[];
  log: readonly WorldChange[];
  /** The scenario's time is up; the program stops here, normally. */
  ended: boolean;
}

/**
 * A world function: one thing a program can do to a world.
 *
 * Described once and hosted by both runtimes, so its name, its arguments, its
 * effect and its explanation cannot drift between them.
 */
export interface WorldFunction {
  /** Stable, stored in the tree: `turnOn`. */
  id: string;
  /** What a student writes, in the interface's language. Both are accepted. */
  names: Record<Language, string>;
  params: { name: Record<Language, string>; kind: 'text' | 'number' }[];
  returns: 'boolean' | null;
  /** Whether it reads the world, changes it, or moves its time. */
  effect: 'read' | 'write' | 'time';
  /** The same idea on a microcontroller, shown when the student hovers it. */
  arduino: string;
  summary: Record<Language, string>;
  /**
   * The call read aloud, for the natural-language view: "enciende «motor»"
   * rather than "haz la tarea «encender» con «motor»". Lower case, no full
   * stop, so it serves as an order and as part of a condition alike.
   */
  phrase: Record<Language, (args: string[]) => string>;
  apply: (state: WorldState, args: unknown[]) => { state: WorldState; value?: boolean };
}

/** A mistake made against the world: a name that is not in it, for one. */
export class WorldFault extends Error {
  readonly messageKey: string;
  readonly vars?: Record<string, string | number>;

  constructor(messageKey: string, vars?: Record<string, string | number>) {
    super(messageKey);
    this.name = 'WorldFault';
    this.messageKey = messageKey;
    this.vars = vars;
  }
}
