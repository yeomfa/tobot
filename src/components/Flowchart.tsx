import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { NodeId, Statement } from '../core/ast/types';
import { createFlowLabels } from '../core/flowchart/labels';
import { layoutFlowchart } from '../core/flowchart/layout';
import type { FlowEdge, FlowNode } from '../core/flowchart/layout';
import { useTranslation } from '../i18n/context';
import './Flowchart.css';

interface FlowchartProps {
  program: Statement[];
  activeNodeId: NodeId | null;
  erroredNodeId: NodeId | null;
  onSelectNode: (id: NodeId) => void;
}

/** Exposed so the export dialog can serialise exactly what is on screen. */
export function serializeFlowchartSvg(element: SVGSVGElement): string {
  const clone = element.cloneNode(true) as SVGSVGElement;
  clone.removeAttribute('style');
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  // Inline the computed colours so the file renders outside the app.
  const computed = getComputedStyle(element);
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = `
    .fc-shape { fill: ${computed.getPropertyValue('--fc-surface') || '#ffffff'}; stroke-width: 2; }
    .fc-shape--terminal { fill: ${computed.getPropertyValue('--fc-terminal') || '#e8eaf2'}; stroke: #656e8c; }
    .fc-shape--process { stroke: #6366f1; }
    .fc-shape--decision { stroke: #d97706; }
    .fc-shape--io { stroke: #0891b2; }
    .fc-label { font-family: ui-sans-serif, system-ui, sans-serif; font-size: 13px; fill: #171d2e; }
    .fc-edge { stroke: #8a93af; stroke-width: 1.6; fill: none; }
    .fc-edge-label { font-family: ui-sans-serif, system-ui, sans-serif; font-size: 11px; fill: #656e8c; }
  `;
  clone.insertBefore(style, clone.firstChild);
  return new XMLSerializer().serializeToString(clone);
}

export const Flowchart = memo(function Flowchart({
  program,
  activeNodeId,
  erroredNodeId,
  onSelectNode,
}: FlowchartProps) {
  const { d, language } = useTranslation();
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  /** `true` while the zoom is being kept in sync with the canvas size. */
  const [autoFit, setAutoFit] = useState(true);

  const layout = useMemo(
    () => layoutFlowchart(program, createFlowLabels(d, language)),
    [program, d, language],
  );

  /**
   * A 40-statement program lays out over 7000px tall, of which a docked panel
   * shows about 3%. Fitting to the canvas by default makes the diagram usable
   * at any size; an explicit zoom click opts out until the next Fit.
   */
  const fitToCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || layout.width === 0 || layout.height === 0) return;
    const padding = 32;
    const scale = Math.min(
      (canvas.clientWidth - padding) / layout.width,
      (canvas.clientHeight - padding) / layout.height,
    );
    // Never magnify past 1: a two-node diagram should not fill the panel.
    setZoom(Math.max(0.12, Math.min(1, scale)));
  }, [layout.width, layout.height]);

  useEffect(() => {
    if (!autoFit) return;
    fitToCanvas();
  }, [autoFit, fitToCanvas]);

  // Re-fit when the panel itself is resized.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !autoFit) return;
    const observer = new ResizeObserver(() => fitToCanvas());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [autoFit, fitToCanvas]);

  const zoomBy = (delta: number): void => {
    setAutoFit(false);
    setZoom((current) => Math.max(0.12, Math.min(2, current + delta)));
  };

  if (program.length === 0) {
    return (
      <div className="flowchart flowchart--empty">
        <p>{d.flowchart.empty}</p>
      </div>
    );
  }

  return (
    <div className="flowchart">
      <div className="flowchart__toolbar">
        <div className="flowchart__legend">
          <LegendItem shape="terminal" label={d.flowchart.legendTerminal} />
          <LegendItem shape="process" label={d.flowchart.legendProcess} />
          <LegendItem shape="decision" label={d.flowchart.legendDecision} />
          <LegendItem shape="io" label={d.flowchart.legendIo} />
        </div>
        <div className="flowchart__zoom">
          <button type="button" onClick={() => zoomBy(-0.15)} aria-label={d.flowchart.zoomOut}>
            −
          </button>
          <button
            type="button"
            data-active={autoFit || undefined}
            onClick={() => setAutoFit(true)}
            aria-label={d.flowchart.fit}
            title={d.flowchart.fit}
          >
            {autoFit ? d.flowchart.fit : `${Math.round(zoom * 100)}%`}
          </button>
          <button type="button" onClick={() => zoomBy(0.15)} aria-label={d.flowchart.zoomIn}>
            +
          </button>
        </div>
      </div>

      <div className="flowchart__canvas" ref={canvasRef}>
        <svg
          ref={svgRef}
          className="flowchart__svg"
          data-flowchart-svg
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          width={layout.width * zoom}
          height={layout.height * zoom}
          role="img"
          aria-label={d.flowchart.title}
        >
          <defs>
            <marker
              id="fc-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" className="fc-arrow-head" />
            </marker>
          </defs>

          <g className="fc-edges">
            {layout.edges.map((edge) => (
              <EdgePath key={edge.id} edge={edge} nodes={layout.nodes} />
            ))}
          </g>

          <g className="fc-nodes">
            {layout.nodes.map((node) => (
              <NodeShape
                key={node.id}
                node={node}
                isActive={node.nodeId !== null && node.nodeId === activeNodeId}
                isErrored={node.nodeId !== null && node.nodeId === erroredNodeId}
                onSelect={onSelectNode}
              />
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
});

function LegendItem({ shape, label }: { shape: string; label: string }) {
  return (
    <span className="flowchart__legend-item" data-shape={shape}>
      <svg viewBox="0 0 24 14" aria-hidden="true">
        {shape === 'terminal' && <rect x="1" y="1" width="22" height="12" rx="6" />}
        {shape === 'process' && <rect x="1" y="1" width="22" height="12" rx="2" />}
        {shape === 'decision' && <path d="M12 1 L23 7 L12 13 L1 7 Z" />}
        {shape === 'io' && <path d="M4 1 H23 L20 13 H1 Z" />}
      </svg>
      {label}
    </span>
  );
}

interface NodeShapeProps {
  node: FlowNode;
  isActive: boolean;
  isErrored: boolean;
  onSelect: (id: NodeId) => void;
}

function NodeShape({ node, isActive, isErrored, onSelect }: NodeShapeProps) {
  const { x, y, width, height, shape, text } = node;
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  const shapeElement = (() => {
    switch (shape) {
      case 'terminal':
        return <rect x={x} y={y} width={width} height={height} rx={height / 2} />;
      case 'decision':
        return (
          <path
            d={`M ${centerX} ${y} L ${x + width} ${centerY} L ${centerX} ${y + height} L ${x} ${centerY} Z`}
          />
        );
      case 'io':
        // Parallelogram, the standard input/output symbol.
        return (
          <path
            d={`M ${x + 14} ${y} H ${x + width} L ${x + width - 14} ${y + height} H ${x} Z`}
          />
        );
      default:
        return <rect x={x} y={y} width={width} height={height} rx={6} />;
    }
  })();

  return (
    <g
      className="fc-node"
      data-active={isActive || undefined}
      data-errored={isErrored || undefined}
      data-clickable={node.nodeId !== null || undefined}
      onClick={() => node.nodeId && onSelect(node.nodeId)}
    >
      <g className={`fc-shape fc-shape--${shape}`}>{shapeElement}</g>
      <text className="fc-label" x={centerX} y={centerY} textAnchor="middle" dominantBaseline="central">
        {text}
      </text>
    </g>
  );
}

/** Routes an edge orthogonally between two node borders. */
function EdgePath({ edge, nodes }: { edge: FlowEdge; nodes: FlowNode[] }) {
  const from = nodes.find((node) => node.id === edge.from);
  const to = nodes.find((node) => node.id === edge.to);
  if (!from || !to) return null;

  const startX = from.x + from.width / 2;
  const startY = from.y + from.height;
  const endX = to.x + to.width / 2;
  const endY = to.y;

  let path: string;
  if (edge.points.length > 0) {
    // Explicit waypoints, used by loop return edges.
    const [first, second] = edge.points;
    path = `M ${startX} ${startY} V ${first.y} H ${first.x} V ${second.y} H ${to.x + to.width}`;
  } else if (Math.abs(startX - endX) < 1) {
    path = `M ${startX} ${startY} V ${endY}`;
  } else {
    // Step down, across, then into the target.
    const midY = startY + (endY - startY) / 2;
    path = `M ${startX} ${startY} V ${midY} H ${endX} V ${endY}`;
  }

  const labelX = edge.points.length > 0 ? startX + 12 : (startX + endX) / 2;
  const labelY = startY + 14;

  return (
    <g className="fc-edge-group">
      <path className="fc-edge" d={path} markerEnd="url(#fc-arrow)" />
      {edge.label && (
        <text className="fc-edge-label" x={labelX} y={labelY} textAnchor="middle">
          {edge.label}
        </text>
      )}
    </g>
  );
}
