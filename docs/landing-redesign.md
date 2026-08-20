# Rediseño de la landing — plan completo

Diseño, estilos, componentes y contenido. Escrito para poder implementarse por
partes: cada sección dice qué se construye, con qué tokens y qué texto lleva.

---

## 0 · Punto de partida (medido)

| | Escritorio | Móvil |
| --- | --- | --- |
| Altura total | 2 544px (2.8 pantallas) | 4 248px (5.0 pantallas) |
| Altura del hero | 749px | 976px |
| Secciones | 6 | 6 |
| Imágenes del producto | **0** | **0** |
| Desborde horizontal | no | no |

Cinco carencias, en orden de peso:

1. **No enseña el producto.** Cero imágenes de una herramienta visual.
2. **Todo pesa igual.** Seis secciones con el mismo patrón; sin jerarquía.
3. **Nada se mueve.** El producto no se demuestra, se describe.
4. **Móvil = 5 pantallas de texto**, y ahí es donde llega el enlace.
5. **Sin prueba** de que alguien lo use.

---

## 1 · Dirección de diseño

**El principio:** la landing debe *ser* una demostración, no un folleto sobre
una demostración. Tobot convierte una idea en cuatro representaciones a la vez;
la página tiene que hacer sentir eso antes de explicarlo.

**Tres decisiones que la separan de una landing genérica de SaaS:**

- **El índigo profundo como protagonista, no como acento.** El sistema ya tiene
  `--slate-900` / `--slate-950` como "mesa de trabajo". Una sección oscura a
  pantalla completa en el centro de la página rompe el blanco continuo y da a
  la marca un momento propio. La mayoría de landings son blancas de arriba
  abajo; ésta no tiene por qué serlo.
- **Los colores de categoría como lenguaje visual.** Variable índigo, E/S cian,
  condicional ámbar, ciclo violeta. Ya significan algo dentro del editor; en la
  landing hacen que la página y el producto se reconozcan como lo mismo.
- **El robot como personaje.** Hoy no aparece en la landing. Es el rostro de la
  marca y debería recibir al visitante.

### Escala tipográfica

La landing necesita más rango que la app. Se añaden tres tokens de página:

```css
--text-display: clamp(2.5rem, 6.5vw, 4.25rem);  /* h1 del hero */
--text-headline: clamp(1.75rem, 3.5vw, 2.5rem); /* h2 de sección */
--text-body-lg: clamp(1rem, 1.4vw, 1.125rem);   /* párrafos guía */
```

El h1 actual es `clamp(2rem, 5vw, 3rem)`: tímido para un hero. El salto entre
título y cuerpo es lo que hace que una página se lea como diseñada.

### Ritmo vertical

Se alterna fondo y ancho para que ninguna sección se parezca a la anterior:

| Sección | Fondo | Ancho |
| --- | --- | --- |
| Hero | degradado cálido sobre `--bg-base` | 780px |
| Para quién | `--bg-surface` | 1080px |
| Cómo funciona | `--bg-base` | 1080px |
| **Las cuatro vistas** | `--slate-950` (oscuro) | **pantalla completa** |
| Qué encuentras | `--bg-surface` | 1080px |
| Temas | `--bg-base` | 880px |
| Preguntas | `--bg-surface` | 720px |
| Cierre | degradado cálido | 640px |

---

## 2 · Contenido del hero

El hero es la única parte que casi todo visitante lee entera. Tres propuestas,
para elegir tono.

### Opción A — El dolor (recomendada)

> **Eyebrow:** Programación desde cero
>
> **Título:** Aprende a programar sin pelear con la sintaxis
>
> **Bajada:** Arma tu algoritmo con bloques y velo al instante en español, en
> pseudocódigo, en código real y como diagrama de flujo. Ejecútalo paso a paso
> y entiende qué hace cada instrucción.
>
> **Acciones:** `Empezar ahora →` · `Entrar`
>
> **Nota:** Gratis, sin instalar nada y sin crear cuenta.

Nombra el problema que el estudiante ya siente. Es la que recomiendo: el punto
y coma olvidado es una experiencia universal en un primer curso.

### Opción B — La promesa

> **Título:** Una idea. Cuatro formas de verla.
>
> **Bajada:** Español, pseudocódigo, código y diagrama de flujo — siempre de
> acuerdo entre sí. Cambia un bloque y las cuatro cambian contigo.

Más memorable y más corta, pero exige que la demo cargue rápido para que se
entienda.

### Opción C — El robot habla

> **Título:** Hola, soy Tobot. Enséñame un algoritmo.
>
> **Bajada:** Ármalo con bloques y lo ejecuto paso a paso, mientras lo ves
> escrito en español, en pseudocódigo, en código y como diagrama.

La más cálida y distintiva. Riesgo: puede leerse como infantil para
universitarios, aunque el resto del texto lo compense.

**Recomendación:** A para el título, con el robot de la opción C presente
visualmente al lado. Se obtiene la seriedad del mensaje y la calidez del
personaje.

### Lo que va al lado del texto

En vez de la demo dibujada actual, **el editor real**. Dos niveles:

1. **Captura enmarcada** — imagen de alta resolución del editor con un
   algoritmo real, en un marco de ventana, con sombra y ligera perspectiva.
   Versión clara y oscura según el tema del visitante.
2. **`<iframe>` en vivo** (recomendado) — el editor de verdad en una ruta
   `/embed` sin cabecera ni paneles laterales. El visitante *toca* el producto
   antes de decidir nada. Es el argumento más fuerte que tiene la página.

---

## 3 · Componentes a construir

Todos nuevos y en `src/components/landing/`, para no cargar el árbol principal.

### `<BrowserFrame>`

Marco de ventana que envuelve captura o iframe.

```tsx
<BrowserFrame url="tobot.app/app" theme="auto">
  <img src={editorLight} alt="…" />
</BrowserFrame>
```

- Barra superior con tres puntos y una URL falsa.
- `border-radius: var(--radius-lg)`, `box-shadow: var(--shadow-lg)`.
- Opcional `tilt` para una perspectiva sutil (`rotateX(2deg)`).

### `<ViewSwitcher>` — la pieza central

La sección protagonista, a pantalla completa sobre fondo oscuro.

- Un bloque de sentencia arriba, editándose solo en bucle.
- Debajo, las cuatro vistas en pestañas que se recorren automáticamente.
- Cada cambio anima el contenido, no lo corta.
- Se detiene al pasar el ratón, para poder leerlo.
- `IntersectionObserver`: solo anima cuando está en pantalla.
- Respeta `prefers-reduced-motion` — sin bucle, muestra las cuatro a la vez.

Es la pieza que más trabajo lleva y la que más diferencia hace.

### `<Reveal>`

Envoltorio que revela a sus hijos al entrar en pantalla.

```tsx
<Reveal delay={80}><Card … /></Reveal>
```

`opacity: 0; translateY(12px)` → visible. Inerte bajo
`prefers-reduced-motion`. Unas 30 líneas.

### `<FeatureCard>`

Reemplaza las tarjetas actuales: añade una micro-captura sobre el icono, para
que cada función se vea además de leerse.

### `<AudienceCard>`, `<StepCard>`, `<FaqItem>`

Variantes de tarjeta ya definidas visualmente; se extraen para que la landing
deje de ser un único archivo largo.

### `<RobotGreeting>`

El robot de la app, en el hero, con la mirada siguiendo al cursor. Reutiliza
`Robot.tsx`; solo añade el seguimiento.

---

## 4 · Estilos

### Tokens nuevos (en `Landing.css`, no globales)

```css
.landing {
  --landing-max: 1080px;
  --landing-narrow: 720px;
  --section-gap: clamp(4rem, 9vw, 7rem);
}
```

### Fondo del hero

Ya hay un degradado radial cálido. Se le añade una malla sutil que evoque el
lienzo del editor:

```css
background-image:
  radial-gradient(ellipse at 50% 0%, color-mix(in srgb, var(--accent) 14%, transparent), transparent 62%),
  linear-gradient(var(--border-subtle) 1px, transparent 1px),
  linear-gradient(90deg, var(--border-subtle) 1px, transparent 1px);
background-size: 100% 100%, 32px 32px, 32px 32px;
```

### Sección oscura

```css
.landing__showcase {
  background: var(--slate-950);
  color: var(--slate-100);
  /* Aísla el tema: la sección es oscura en ambos temas de la app. */
  --bg-surface: var(--slate-900);
  --border-subtle: var(--slate-800);
  --text-primary: var(--slate-50);
  --text-secondary: var(--slate-300);
}
```

Redefinir los tokens dentro de la sección, en vez de escribir colores a mano,
mantiene los componentes de dentro sin cambios.

### Móvil

- Hero: bajar a `padding: var(--space-5)` y ocultar la malla.
- Tarjetas: carrusel horizontal con `scroll-snap` donde hay más de tres.
- Objetivos táctiles: mínimo 44px, verificado.
- La sección oscura se acorta: bucle más rápido, sin las cuatro vistas a la vez.

---

## 5 · Estructura final

Reordenada para acompañar la decisión del visitante, no el inventario de
funciones:

1. **Hero** — qué es + producto real a la vista
2. **Para quién es** — que se reconozca antes de leer detalles
3. **Cómo funciona** — tres pasos
4. **Las cuatro vistas** ← protagonista, oscura, animada
5. **Qué encuentras** — seis tarjetas con micro-capturas
6. **Los temas del curso**
7. **Preguntas frecuentes** ← nueva
8. **Cierre** — llamada final
9. **Pie** — Tobot · v1.0.0 · By mocta

### Preguntas frecuentes (contenido)

- **¿Es gratis?** Sí, y lo seguirá siendo para estudiantes. No pide tarjeta.
- **¿Necesito instalar algo?** No. Funciona en el navegador, también en el
  teléfono.
- **¿Sirve para mi curso?** Cubre variables, entrada y salida, condicionales y
  ciclos — el temario de un primer curso. Funciones vienen en camino.
- **¿Qué lenguajes genera?** Pseudocódigo y JavaScript hoy; la arquitectura
  admite añadir uno con un solo archivo.
- **¿Mis algoritmos están seguros?** Sin cuenta, se quedan en tu navegador. Con
  cuenta, solo tú puedes leerlos: lo garantiza la base de datos, no el código
  del navegador.

---

## 6 · Metadatos para compartir

Hoy el enlace se comparte sin previsualización, y va a repartirse por WhatsApp
y Classroom. En `index.html`:

```html
<meta property="og:title" content="Tobot — Aprende a programar sin pelear con la sintaxis" />
<meta property="og:description" content="Arma algoritmos con bloques y velos en español, pseudocódigo, código y diagrama de flujo." />
<meta property="og:image" content="/og-image.png" />   <!-- 1200×630 -->
<meta property="og:type" content="website" />
<meta name="twitter:card" content="summary_large_image" />
```

La imagen: el editor real con la marca y el título, generada una vez.

---

## 7 · Orden de implementación

| Fase | Qué entra | Impacto | Esfuerzo |
| --- | --- | --- | --- |
| **1** | `BrowserFrame` + hero con producto real | Muy alto | Bajo |
| **2** | Ritmo: fondos alternos, escala tipográfica, reorden | Alto | Bajo |
| **3** | `ViewSwitcher` (sección oscura animada) | Muy alto | Alto |
| **4** | `Reveal` + micro-capturas en tarjetas | Medio | Medio |
| **5** | FAQ + Open Graph + robot en el hero | Medio | Bajo |
| **6** | Pulido móvil y accesibilidad AA | Alto | Medio |

**Si solo se hace una:** fase 1. Una landing de herramienta visual sin imagen
de la herramienta es la carencia mayor.

**Si se hacen tres:** 1 + 2 + 5. Producto visible, ritmo, y que el enlace se
vea bien al repartirlo.

**El techo:** con la fase 3 hecha, la página compite de verdad con la de
cualquier empresa grande, porque enseña algo que las demás no tienen.
