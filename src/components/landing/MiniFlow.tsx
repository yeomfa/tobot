import { useTranslation } from '../../i18n/context';
import './MiniFlow.css';

interface MiniFlowProps {
  /** Index of the node currently running, or `null` for none. */
  activeStep?: number | null;
}

/**
 * A flowchart, drawn for the page rather than by the app.
 *
 * The editor's real `Flowchart` lays out whatever program it is given, at
 * whatever size that takes — for the demo algorithm that is a tall column of
 * eleven nodes, which on a landing page becomes a thumbnail nobody can read.
 * It is the right component for a canvas you can pan and the wrong one for a
 * panel beside a paragraph.
 *
 * This draws four nodes at a size meant to be looked at, in the same shapes
 * the app uses — stadium for start and end, rectangle for a process, diamond
 * for a decision — so a student meets the same vocabulary in both places.
 */
export function MiniFlow({ activeStep = null }: MiniFlowProps) {
  const { d } = useTranslation();

  return (
    <svg
      className="mini-flow"
      viewBox="0 0 260 300"
      role="img"
      aria-label={d.landing.showcaseLabels.flowchart}
    >
      <defs>
        <marker
          id="mini-flow-arrow"
          viewBox="0 0 8 8"
          refX="6"
          refY="4"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M0 0 L8 4 L0 8 z" fill="currentColor" />
        </marker>
      </defs>

      <g className="mini-flow__edges">
        <line x1="130" y1="46" x2="130" y2="72" markerEnd="url(#mini-flow-arrow)" />
        <line x1="130" y1="112" x2="130" y2="138" markerEnd="url(#mini-flow-arrow)" />
        <line x1="130" y1="192" x2="130" y2="218" markerEnd="url(#mini-flow-arrow)" />
      </g>

      <g className="mini-flow__node" data-shape="terminal" data-on={activeStep === 0 || undefined}>
        <rect x="88" y="14" width="84" height="32" rx="16" />
        <text x="130" y="34">{d.landing.flow.start}</text>
      </g>

      <g className="mini-flow__node" data-shape="process" data-on={activeStep === 1 || undefined}>
        <rect x="58" y="72" width="144" height="40" rx="8" />
        <text x="130" y="96">{d.landing.flow.count}</text>
      </g>

      {/* A diamond, as a rotated square: the shape carries the meaning here. */}
      <g className="mini-flow__node" data-shape="decision" data-on={activeStep === 2 || undefined}>
        <path d="M130 132 L196 165 L130 198 L64 165 z" />
        <text x="130" y="170">{d.landing.flow.check}</text>
      </g>

      <g className="mini-flow__node" data-shape="terminal" data-on={activeStep === 3 || undefined}>
        <rect x="88" y="218" width="84" height="32" rx="16" />
        <text x="130" y="238">{d.landing.flow.end}</text>
      </g>
    </svg>
  );
}
