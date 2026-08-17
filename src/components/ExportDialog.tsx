import { memo, useState } from 'react';

import type { Algorithm } from '../core/ast/types';
import { emitters, renderLines } from '../core/emitters';
import type { TargetId } from '../core/emitters';
import { useTranslation } from '../i18n/context';
import { serializeFlowchartSvg } from './Flowchart';
import './ExportDialog.css';

interface ExportDialogProps {
  algorithm: Algorithm;
  onClose: () => void;
}

function download(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeFilename(name: string): string {
  const cleaned = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúñü\s-]/gi, '')
    .replace(/\s+/g, '-');
  return cleaned || 'algoritmo';
}

/** Rasterises the on-screen flowchart via an offscreen canvas. */
async function exportFlowchartPng(filename: string): Promise<boolean> {
  const svg = document.querySelector<SVGSVGElement>('[data-flowchart-svg]');
  if (!svg) return false;

  const source = serializeFlowchartSvg(svg);
  const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('svg load failed'));
      element.src = url;
    });

    const scale = 2; // Retina-quality output for slides and reports.
    const canvas = document.createElement('canvas');
    canvas.width = svg.viewBox.baseVal.width * scale;
    canvas.height = svg.viewBox.baseVal.height * scale;

    const context = canvas.getContext('2d');
    if (!context) return false;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.scale(scale, scale);
    context.drawImage(image, 0, 0);

    await new Promise<void>((resolve) => {
      canvas.toBlob((result) => {
        if (result) {
          const pngUrl = URL.createObjectURL(result);
          const anchor = document.createElement('a');
          anchor.href = pngUrl;
          anchor.download = filename;
          anchor.click();
          setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
        }
        resolve();
      }, 'image/png');
    });
    return true;
  } catch {
    return false;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const ExportDialog = memo(function ExportDialog({ algorithm, onClose }: ExportDialogProps) {
  const { d, language } = useTranslation();
  const [target, setTarget] = useState<TargetId>('javascript');
  const [note, setNote] = useState<string | null>(null);

  const base = safeFilename(algorithm.name);
  const emitter = emitters[target];
  const source = renderLines(emitter.emit(algorithm, { locale: language }));

  const exportCode = (): void => {
    download(`${base}.${emitter.extension}`, source, 'text/plain;charset=utf-8');
  };

  const exportJson = (): void => {
    download(`${base}.json`, JSON.stringify(algorithm, null, 2), 'application/json');
  };

  const exportSvg = (): void => {
    const svg = document.querySelector<SVGSVGElement>('[data-flowchart-svg]');
    if (!svg) {
      // The flowchart tab has to be open for its SVG to exist in the DOM.
      setNote(d.flowchart.empty);
      return;
    }
    download(`${base}.svg`, serializeFlowchartSvg(svg), 'image/svg+xml;charset=utf-8');
  };

  const exportPng = async (): Promise<void> => {
    const ok = await exportFlowchartPng(`${base}.png`);
    if (!ok) setNote(d.flowchart.empty);
  };

  return (
    <div className="dialog-backdrop" onClick={onClose} role="presentation">
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={d.export.title}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="dialog__header">
          <div>
            <h2 className="dialog__title">{d.export.title}</h2>
            <p className="dialog__subtitle">{d.export.subtitle}</p>
          </div>
          <button
            type="button"
            className="dialog__close"
            onClick={onClose}
            aria-label={d.actions.close}
          >
            ×
          </button>
        </header>

        <div className="dialog__body">
          <section className="export-section">
            <div className="export-section__head">
              <h3>{d.export.code}</h3>
              <select
                value={target}
                onChange={(event) => setTarget(event.target.value as TargetId)}
                aria-label={d.panel.languageSelect}
              >
                {(Object.keys(emitters) as TargetId[]).map((id) => (
                  <option key={id} value={id}>
                    {emitters[id].label}
                  </option>
                ))}
              </select>
            </div>

            <pre className="export-preview">
              <code>{source || '—'}</code>
            </pre>

            <div className="export-actions">
              <button type="button" className="export-button" onClick={exportCode}>
                {d.export.download} .{emitter.extension}
              </button>
              <button
                type="button"
                className="export-button"
                onClick={() => void navigator.clipboard.writeText(source)}
              >
                {d.export.copyToClipboard}
              </button>
            </div>
          </section>

          <section className="export-section">
            <div className="export-section__head">
              <h3>{d.flowchart.title}</h3>
            </div>
            <div className="export-actions">
              <button type="button" className="export-button" onClick={exportSvg}>
                {d.export.flowchartSvg}
              </button>
              <button type="button" className="export-button" onClick={() => void exportPng()}>
                {d.export.flowchartPng}
              </button>
            </div>
          </section>

          <section className="export-section">
            <div className="export-section__head">
              <h3>{d.export.algorithmJson}</h3>
            </div>
            <div className="export-actions">
              <button type="button" className="export-button" onClick={exportJson}>
                {d.export.download} .json
              </button>
            </div>
          </section>

          {note && <p className="export-note">{note}</p>}
        </div>
      </div>
    </div>
  );
});
