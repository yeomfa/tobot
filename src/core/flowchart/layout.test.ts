import { describe, expect, it } from 'vitest';

import { createId, literal, variable } from '../ast/factory';
import type { Statement } from '../ast/types';
import { es } from '../../i18n/es';
import type { Dictionary } from '../../i18n/es';
import { createFlowLabels } from './labels';
import { layoutFlowchart } from './layout';

const labels = createFlowLabels(es as Dictionary, 'es');

const layoutOf = (program: Statement[]) => layoutFlowchart(program, labels);

/** Walks the edge graph from Start to find every reachable node. */
function reachableFrom(
  layout: ReturnType<typeof layoutOf>,
  startText: string,
): Set<string> {
  const start = layout.nodes.find((node) => node.text === startText);
  if (!start) throw new Error('no start node');

  const seen = new Set<string>([start.id]);
  const queue = [start.id];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const edge of layout.edges) {
      if (edge.from === current && !seen.has(edge.to)) {
        seen.add(edge.to);
        queue.push(edge.to);
      }
    }
  }
  return seen;
}

describe('flowchart layout', () => {
  it('brackets an empty program with Start and End', () => {
    const layout = layoutOf([]);
    expect(layout.nodes.map((node) => node.text)).toEqual([
      es.flowchart.start,
      es.flowchart.end,
    ]);
    expect(layout.edges).toHaveLength(1);
  });

  it('gives every statement its own node', () => {
    const ids = [createId(), createId(), createId()];
    const layout = layoutOf([
      { id: ids[0], kind: 'declare', name: 'x', valueKind: 'number', value: literal(1, 'number') },
      { id: ids[1], kind: 'say', value: variable('x') },
      {
        id: ids[2],
        kind: 'ask',
        prompt: literal('?', 'text'),
        target: 'y',
        expect: 'text',
      },
    ]);
    for (const id of ids) {
      expect(layout.nodes.some((node) => node.nodeId === id)).toBe(true);
    }
  });

  it('uses the parallelogram for input and output', () => {
    const layout = layoutOf([
      { id: createId(), kind: 'say', value: literal('hola', 'text') },
      { id: createId(), kind: 'ask', prompt: literal('?', 'text'), target: 'y', expect: 'text' },
    ]);
    const shapes = layout.nodes.filter((node) => node.nodeId !== null).map((node) => node.shape);
    expect(shapes).toEqual(['io', 'io']);
  });

  it('renders a conditional as a diamond with both branches reachable', () => {
    const thenId = createId();
    const elseId = createId();
    const layout = layoutOf([
      {
        id: createId(),
        kind: 'if',
        condition: literal(true, 'boolean'),
        then: [{ id: thenId, kind: 'say', value: literal('a', 'text') }],
        otherwise: [{ id: elseId, kind: 'say', value: literal('b', 'text') }],
      },
    ]);

    expect(layout.nodes.filter((node) => node.shape === 'decision')).toHaveLength(1);

    const reachable = reachableFrom(layout, es.flowchart.start);
    const thenNode = layout.nodes.find((node) => node.nodeId === thenId);
    const elseNode = layout.nodes.find((node) => node.nodeId === elseId);
    expect(reachable.has(thenNode!.id)).toBe(true);
    expect(reachable.has(elseNode!.id)).toBe(true);

    // Branches must be labelled so the reader knows which way is which.
    const branchLabels = layout.edges.map((edge) => edge.label).filter(Boolean);
    expect(branchLabels).toContain(es.flowchart.yes);
    expect(branchLabels).toContain(es.flowchart.no);
  });

  it('places branches side by side rather than overlapping', () => {
    const thenId = createId();
    const elseId = createId();
    const layout = layoutOf([
      {
        id: createId(),
        kind: 'if',
        condition: literal(true, 'boolean'),
        then: [{ id: thenId, kind: 'say', value: literal('a', 'text') }],
        otherwise: [{ id: elseId, kind: 'say', value: literal('b', 'text') }],
      },
    ]);
    const thenNode = layout.nodes.find((node) => node.nodeId === thenId)!;
    const elseNode = layout.nodes.find((node) => node.nodeId === elseId)!;
    const separated =
      thenNode.x + thenNode.width <= elseNode.x || elseNode.x + elseNode.width <= thenNode.x;
    expect(separated).toBe(true);
  });

  it('loops the body back to the condition', () => {
    const bodyId = createId();
    const loopId = createId();
    const layout = layoutOf([
      {
        id: loopId,
        kind: 'while',
        condition: literal(true, 'boolean'),
        body: [{ id: bodyId, kind: 'say', value: literal('x', 'text') }],
      },
    ]);

    const diamond = layout.nodes.find((node) => node.nodeId === loopId)!;
    const bodyNode = layout.nodes.find((node) => node.nodeId === bodyId)!;
    const returnEdge = layout.edges.find(
      (edge) => edge.from === bodyNode.id && edge.to === diamond.id,
    );
    expect(returnEdge).toBeDefined();
    // The return path is routed with waypoints so it does not cross the body.
    expect(returnEdge!.points.length).toBeGreaterThan(0);
  });

  it('keeps every statement reachable in a nested program', () => {
    const innerId = createId();
    const layout = layoutOf([
      { id: createId(), kind: 'declare', name: 'n', valueKind: 'number', value: literal(3, 'number') },
      {
        id: createId(),
        kind: 'while',
        condition: variable('n'),
        body: [
          {
            id: createId(),
            kind: 'if',
            condition: literal(true, 'boolean'),
            then: [{ id: innerId, kind: 'say', value: literal('deep', 'text') }],
          },
        ],
      },
    ]);

    const reachable = reachableFrom(layout, es.flowchart.start);
    const innerNode = layout.nodes.find((node) => node.nodeId === innerId)!;
    expect(reachable.has(innerNode.id)).toBe(true);
    expect(reachable.has(layout.nodes.find((node) => node.text === es.flowchart.end)!.id)).toBe(
      true,
    );
  });

  it('reports a canvas large enough to hold every node', () => {
    const layout = layoutOf([
      {
        id: createId(),
        kind: 'if',
        condition: literal(true, 'boolean'),
        then: [{ id: createId(), kind: 'say', value: literal('a', 'text') }],
        otherwise: [{ id: createId(), kind: 'say', value: literal('b', 'text') }],
      },
    ]);
    for (const node of layout.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.x + node.width).toBeLessThanOrEqual(layout.width);
      expect(node.y + node.height).toBeLessThanOrEqual(layout.height);
    }
  });
});
