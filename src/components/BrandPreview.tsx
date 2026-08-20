import { BrandMark } from './BrandMark';
import type { BrandPalette, BrandShape } from './BrandMark';
import './BrandPreview.css';

interface Option {
  id: string;
  shape: BrandShape;
  palette: BrandPalette;
  title: string;
  note: string;
}

/**
 * The identity options, side by side in the places they will actually live.
 *
 * A mark judged on a blank card is a mark judged in the wrong conditions: what
 * matters is whether it holds up at 26px beside the product name in the
 * header, and whether it still reads at 16px in a browser tab. Each row here
 * is the real header and the real tab strip, so the comparison is the one that
 * decides the question.
 *
 * Temporary: this is a decision aid, not a feature. It comes out once a shape
 * and palette are chosen and set as the component's defaults.
 */
const OPTIONS: Option[] = [
  {
    id: 'A',
    shape: 'robot',
    palette: 'cool',
    title: 'A · Actual (morado + azul)',
    note: 'Los dos acentos son fríos y compiten con el naranja sin llegar a contrastar.',
  },
  {
    id: 'E',
    shape: 'robot',
    palette: 'warm',
    title: 'E · Cálido (naranja quemado + ámbar)',
    note: 'Una sola familia de color. El naranja manda y nada le disputa el sitio.',
  },
  {
    id: 'F',
    shape: 'robot',
    palette: 'teal',
    title: 'F · Teal (complementario)',
    note: 'El teal es el complementario real del naranja: el contraste más fuerte de los cuatro.',
  },
  {
    id: 'G',
    shape: 'robot',
    palette: 'neutral',
    title: 'G · Neutro (pizarra)',
    note: 'El naranja es el único color de la marca. Lo más sobrio para un contexto académico.',
  },
  {
    id: 'C',
    shape: 'letter',
    palette: 'warm',
    title: 'C · La T es el robot (cálido)',
    note: 'La barra de la T hace de cabeza y el tallo de cuerpo. Nombre y símbolo son el mismo dibujo.',
  },
  {
    id: 'C2',
    shape: 'letter',
    palette: 'teal',
    title: 'C · La T es el robot (teal)',
    note: 'La misma forma con el acento complementario, para comparar las dos decisiones por separado.',
  },
];

export function BrandPreview({ onClose }: { onClose: () => void }) {
  return (
    <div className="brand-preview">
      <header className="brand-preview__head">
        <div>
          <h1>Opciones de marca</h1>
          <p>
            Cada opción en el sitio donde va a vivir: la cabecera a tamaño real y la pestaña del
            navegador a 16px. Elige forma y color por separado.
          </p>
        </div>
        <button type="button" className="brand-preview__close" onClick={onClose}>
          Volver
        </button>
      </header>

      <div className="brand-preview__list">
        {OPTIONS.map((option) => (
          <section className="brand-preview__option" key={option.id}>
            <div className="brand-preview__meta">
              <h2>{option.title}</h2>
              <p>{option.note}</p>
            </div>

            <div className="brand-preview__stage">
              {/* The header, as the editor draws it. */}
              <div className="brand-preview__label">Cabecera</div>
              <div className="brand-preview__header">
                <BrandMark size={26} shape={option.shape} palette={option.palette} />
                <span className="brand-preview__name">Tobot</span>
                <span className="brand-preview__doc">Saludo y nota</span>
              </div>

              {/* The browser tab: the size that decides whether a mark works. */}
              <div className="brand-preview__label">Pestaña · 16px</div>
              <div className="brand-preview__tabs">
                <span className="brand-preview__tab">
                  <BrandMark size={16} shape={option.shape} palette={option.palette} />
                  Tobot — Aprende a…
                </span>
                <span className="brand-preview__tab brand-preview__tab--idle">Otra pestaña</span>
              </div>

              {/* On the landing page, and on a dark surface. */}
              <div className="brand-preview__label">Portada y fondo oscuro</div>
              <div className="brand-preview__row">
                <span className="brand-preview__hero">
                  <BrandMark size={30} shape={option.shape} palette={option.palette} />
                  <span className="brand-preview__hero-name">Tobot</span>
                </span>
                <span className="brand-preview__dark">
                  <BrandMark size={34} shape={option.shape} palette={option.palette} />
                </span>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
