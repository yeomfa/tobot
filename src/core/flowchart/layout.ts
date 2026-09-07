import { isBlockStatement } from '../ast/types';
import type { NodeId, Statement } from '../ast/types';

/**
 * Flowchart layout.
 *
 * Produces absolute geometry for a classic flowchart from the same AST the
 * emitters read. The algorithm is a two-pass recursive walk: `measure` computes
 * the bounding width and height of every construct bottom-up, then `place`
 * assigns absolute coordinates top-down. This keeps branches centred under
 * their decision diamond without any iterative force simulation.
 */

export type ShapeKind = 'terminal' | 'process' | 'decision' | 'io' | 'note';

export interface FlowNode {
  id: string;
  /** Statement this node came from; `null` for Start/End and merge points. */
  nodeId: NodeId | null;
  shape: ShapeKind;
  /** Pre-translated label text. */
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FlowEdge {
  id: string;
  from: string;
  to: string;
  /** Branch label such as "sí" / "no", drawn near the source. */
  label?: string;
  /** Waypoints for orthogonal routing, excluding the endpoints. */
  points: Array<{ x: number; y: number }>;
}

export interface FlowLayout {
  nodes: FlowNode[];
  edges: FlowEdge[];
  width: number;
  height: number;
}

/** Tuned so a decision with two short branches fits without crowding. */
const NODE_WIDTH = 190;
const NODE_HEIGHT = 52;
const DECISION_WIDTH = 210;
const DECISION_HEIGHT = 84;

/**
 * Labels are drawn in the monospace UI font at 12.5px, where each glyph is
 * almost exactly 0.6em wide. Estimating from the character count keeps layout
 * a pure function — no DOM measurement — while still guaranteeing the text
 * fits inside its shape.
 */
const CHAR_WIDTH = 7.6;

function widthForLabel(text: string, minimum: number, padding: number): number {
  return Math.max(minimum, Math.ceil(text.length * CHAR_WIDTH) + padding);
}
const TERMINAL_WIDTH = 120;
const TERMINAL_HEIGHT = 44;
const VERTICAL_GAP = 42;
const HORIZONTAL_GAP = 40;
/** Room for the loop's return edge to run beside the body. */
const LOOP_MARGIN = 46;

export interface FlowLabels {
  start: string;
  end: string;
  yes: string;
  no: string;
  /** Renders a statement into the short label shown inside its shape. */
  describe: (statement: Statement) => { text: string; shape: ShapeKind };
}

/** Bounding box of a laid-out fragment, with the connection points. */
interface Measured {
  width: number;
  height: number;
  /** X offset of the vertical spine within the fragment. */
  spine: number;
  build: (originX: number, originY: number, sink: Sink) => Ports;
}

interface Ports {
  /** Node id the incoming edge should attach to. */
  entry: string | null;
  /** Nodes leaving the fragment, to be joined to whatever follows. */
  exits: Array<{ id: string; label?: string; x: number; y: number }>;
}

interface Sink {
  nodes: FlowNode[];
  edges: FlowEdge[];
  nextId: () => string;
}

function measureStatement(statement: Statement, labels: FlowLabels): Measured {
  switch (statement.kind) {
    case 'if':
      return measureIf(statement, labels);
    case 'while':
    case 'repeat':
    case 'forEach':
    case 'forEachItem':
      return measureLoop(statement, labels);
    /* A loop missing from this list is not a compile error — it falls to
       `measureSimple` and is drawn as a plain box with its body invisible,
       which looks like a diagram that is merely wrong rather than broken. */
    default:
      return measureSimple(statement, labels);
  }
}

function measureSimple(statement: Statement, labels: FlowLabels): Measured {
  const { text, shape } = labels.describe(statement);
  // Parallelograms lose horizontal room to their slant, so they pad more.
  const width = widthForLabel(text, NODE_WIDTH, shape === 'io' ? 56 : 32);
  const height = NODE_HEIGHT;

  return {
    width,
    height,
    spine: width / 2,
    build: (originX, originY, sink) => {
      const id = sink.nextId();
      sink.nodes.push({
        id,
        nodeId: statement.id,
        shape,
        text,
        x: originX,
        y: originY,
        width,
        height,
      });
      return {
        entry: id,
        exits: [{ id, x: originX + width / 2, y: originY + height }],
      };
    },
  };
}

/** Lays out a list of statements as a vertical chain. */
function measureSequence(statements: Statement[], labels: FlowLabels): Measured {
  if (statements.length === 0) {
    return { width: 0, height: 0, spine: 0, build: () => ({ entry: null, exits: [] }) };
  }

  const parts = statements.map((statement) => measureStatement(statement, labels));
  const spine = Math.max(...parts.map((part) => part.spine));
  const width = Math.max(...parts.map((part) => part.width - part.spine)) + spine;
  const height =
    parts.reduce((total, part) => total + part.height, 0) + VERTICAL_GAP * (parts.length - 1);

  return {
    width,
    height,
    spine,
    build: (originX, originY, sink) => {
      let cursorY = originY;
      let entry: string | null = null;
      let pending: Ports['exits'] = [];

      parts.forEach((part) => {
        const ports = part.build(originX + spine - part.spine, cursorY, sink);
        if (ports.entry) {
          if (entry === null) entry = ports.entry;
          // Join the previous fragment's open exits into this fragment.
          pending.forEach((exit) => {
            connect(sink, exit, ports.entry as string);
          });
          pending = ports.exits;
        }
        cursorY += part.height + VERTICAL_GAP;
      });

      return { entry, exits: pending };
    },
  };
}

function connect(sink: Sink, exit: { id: string; label?: string }, to: string): void {
  sink.edges.push({
    id: `e_${sink.edges.length}`,
    from: exit.id,
    to,
    label: exit.label,
    points: [],
  });
}

function measureIf(
  statement: Extract<Statement, { kind: 'if' }>,
  labels: FlowLabels,
): Measured {
  const { text } = labels.describe(statement);
  // A diamond's usable interior is about half its box, so text needs ~2x padding.
  const diamondWidth = widthForLabel(text, DECISION_WIDTH, 120);
  const thenPart = measureSequence(statement.then, labels);
  const elsePart = measureSequence(statement.otherwise ?? [], labels);

  // Branches sit side by side beneath the diamond.
  const leftWidth = Math.max(thenPart.width, NODE_WIDTH / 2);
  const rightWidth = Math.max(elsePart.width, NODE_WIDTH / 2);
  const width = Math.max(leftWidth + HORIZONTAL_GAP + rightWidth, diamondWidth);
  const spine = width / 2;
  const branchHeight = Math.max(thenPart.height, elsePart.height);
  const height = DECISION_HEIGHT + VERTICAL_GAP + branchHeight + VERTICAL_GAP;

  return {
    width,
    height,
    spine,
    build: (originX, originY, sink) => {
      const decisionId = sink.nextId();
      sink.nodes.push({
        id: decisionId,
        nodeId: statement.id,
        shape: 'decision',
        text,
        x: originX + spine - diamondWidth / 2,
        y: originY,
        width: diamondWidth,
        height: DECISION_HEIGHT,
      });

      const branchY = originY + DECISION_HEIGHT + VERTICAL_GAP;
      const exits: Ports['exits'] = [];

      // "Yes" branch on the left, "no" on the right — the conventional reading.
      const leftCenterX = originX + leftWidth / 2;
      const rightCenterX = originX + leftWidth + HORIZONTAL_GAP + rightWidth / 2;

      const placeBranch = (
        part: Measured,
        centerX: number,
        label: string,
        hasStatements: boolean,
      ): void => {
        if (!hasStatements) {
          // Empty branch: the diamond itself flows onward under this label.
          exits.push({
            id: decisionId,
            label,
            x: centerX,
            y: originY + DECISION_HEIGHT,
          });
          return;
        }
        const ports = part.build(centerX - part.spine, branchY, sink);
        if (ports.entry) {
          sink.edges.push({
            id: `e_${sink.edges.length}`,
            from: decisionId,
            to: ports.entry,
            label,
            points: [],
          });
        }
        exits.push(...ports.exits);
      };

      placeBranch(thenPart, leftCenterX, labels.yes, statement.then.length > 0);
      placeBranch(
        elsePart,
        rightCenterX,
        labels.no,
        (statement.otherwise?.length ?? 0) > 0,
      );

      return { entry: decisionId, exits };
    },
  };
}

/**
 * Shared geometry for every looping construct: a decision diamond whose "yes"
 * edge enters the body and whose body loops back up to it. `repeat` and
 * `forEach` reuse this shape with their own diamond text.
 */
function measureLoop(
  statement: Extract<Statement, { kind: 'while' | 'repeat' | 'forEach' | 'forEachItem' }>,
  labels: FlowLabels,
): Measured {
  const { text } = labels.describe(statement);
  const diamondWidth = widthForLabel(text, DECISION_WIDTH, 120);
  const bodyPart = measureSequence(statement.body, labels);

  const width = Math.max(bodyPart.width, diamondWidth) + LOOP_MARGIN;
  const spine = Math.max(bodyPart.spine, diamondWidth / 2);
  const height = DECISION_HEIGHT + VERTICAL_GAP + bodyPart.height + VERTICAL_GAP;

  return {
    width,
    height,
    spine,
    build: (originX, originY, sink) => {
      const decisionId = sink.nextId();
      sink.nodes.push({
        id: decisionId,
        nodeId: statement.id,
        shape: 'decision',
        text,
        x: originX + spine - diamondWidth / 2,
        y: originY,
        width: diamondWidth,
        height: DECISION_HEIGHT,
      });

      if (statement.body.length > 0) {
        const bodyY = originY + DECISION_HEIGHT + VERTICAL_GAP;
        const ports = bodyPart.build(originX + spine - bodyPart.spine, bodyY, sink);
        if (ports.entry) {
          sink.edges.push({
            id: `e_${sink.edges.length}`,
            from: decisionId,
            to: ports.entry,
            label: labels.yes,
            points: [],
          });
        }
        // The body's exits loop back up to the condition, routed around the
        // right-hand side so the return path never crosses the body.
        const returnX = originX + width - LOOP_MARGIN / 2;
        ports.exits.forEach((exit) => {
          sink.edges.push({
            id: `e_${sink.edges.length}`,
            from: exit.id,
            to: decisionId,
            points: [
              { x: returnX, y: exit.y + VERTICAL_GAP / 2 },
              { x: returnX, y: originY + DECISION_HEIGHT / 2 },
            ],
          });
        });
      }

      // Falling out of the loop is the "no" edge.
      return {
        entry: decisionId,
        exits: [
          {
            id: decisionId,
            label: labels.no,
            x: originX + spine,
            y: originY + DECISION_HEIGHT,
          },
        ],
      };
    },
  };
}

/**
 * Rewrites `si no, si` arms as nested `si` statements inside the else branch.
 *
 * A flowchart is a binary diagram: a diamond has a true side and a false side,
 * and that is exactly what an else-if arm means — try the next condition on
 * the false path. Expanding here keeps the layout untouched, and produces the
 * chain of diamonds a student would draw by hand.
 *
 * Ids are preserved, so highlighting the running statement still finds its
 * shape while the interpreter walks the arms.
 */
function expandElseIfs(statements: Statement[]): Statement[] {
  return statements.map((statement) => {
    if (statement.kind !== 'if') {
      if (isBlockStatement(statement)) {
        const block = statement as Statement & { body: Statement[] };
        return { ...block, body: expandElseIfs(block.body) };
      }
      return statement;
    }

    const arms = statement.elseIfs ?? [];
    const tail = statement.otherwise ? expandElseIfs(statement.otherwise) : undefined;

    // Built from the last arm backwards, so each one nests inside the previous
    // one's else — which is the order the interpreter tries them in.
    const otherwise = arms.reduceRight<Statement[] | undefined>((rest, arm) => {
      const nested: Statement = {
        id: arm.id,
        kind: 'if',
        condition: arm.condition,
        then: expandElseIfs(arm.body),
        ...(rest ? { otherwise: rest } : {}),
      };
      return [nested];
    }, tail);

    return {
      id: statement.id,
      kind: 'if',
      condition: statement.condition,
      then: expandElseIfs(statement.then),
      ...(otherwise ? { otherwise } : {}),
    };
  });
}

export function layoutFlowchart(input: Statement[], labels: FlowLabels): FlowLayout {
  // Else-if arms become nested decisions before anything is measured, so the
  // rest of the layout keeps its two-branch assumption.
  const program = expandElseIfs(input);

  const sink: Sink = {
    nodes: [],
    edges: [],
    nextId: (() => {
      let counter = 0;
      return () => `f_${(counter += 1)}`;
    })(),
  };

  const bodyPart = measureSequence(program, labels);
  const contentWidth = Math.max(bodyPart.width, TERMINAL_WIDTH);
  const spine = Math.max(bodyPart.spine, TERMINAL_WIDTH / 2);
  const padding = 24;

  let cursorY = padding;

  const startId = sink.nextId();
  sink.nodes.push({
    id: startId,
    nodeId: null,
    shape: 'terminal',
    text: labels.start,
    x: padding + spine - TERMINAL_WIDTH / 2,
    y: cursorY,
    width: TERMINAL_WIDTH,
    height: TERMINAL_HEIGHT,
  });
  cursorY += TERMINAL_HEIGHT + VERTICAL_GAP;

  const ports = bodyPart.build(padding + spine - bodyPart.spine, cursorY, sink);
  if (ports.entry) connect(sink, { id: startId }, ports.entry);
  cursorY += bodyPart.height + (program.length > 0 ? VERTICAL_GAP : 0);

  const endId = sink.nextId();
  sink.nodes.push({
    id: endId,
    nodeId: null,
    shape: 'terminal',
    text: labels.end,
    x: padding + spine - TERMINAL_WIDTH / 2,
    y: cursorY,
    width: TERMINAL_WIDTH,
    height: TERMINAL_HEIGHT,
  });

  const openExits = ports.entry ? ports.exits : [{ id: startId, x: 0, y: 0 }];
  openExits.forEach((exit) => connect(sink, exit, endId));

  return {
    nodes: sink.nodes,
    edges: sink.edges,
    width: contentWidth + padding * 2,
    height: cursorY + TERMINAL_HEIGHT + padding,
  };
}
