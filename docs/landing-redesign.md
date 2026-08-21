# Landing v2 — plan de trabajo

Rediseño completo: nada de capturas, componentes reales, el robot como
anfitrión, y un mensaje sobre aprender conceptos en vez de un temario cerrado.

---

## 0 · Qué cambia respecto a lo que hay

| Hoy | v2 |
| --- | --- |
| Captura PNG del editor en el hero | **Bloques reales**, vivos, animándose |
| El robot no aparece | **El robot es el anfitrión**, en 3 momentos |
| "Los temas del curso": 4 chips cerrados | **Lo que puedes aprender**, abierto y creciendo |
| Ilustración estática | Los mismos componentes de la app |
| Tono correcto pero plano | Cálido, con personalidad |

Dos razones de fondo para dejar la captura:

- **Una imagen envejece.** Cada cambio en el editor la deja mentirosa, y ya
  ocurrió: la leyenda seguía describiendo una demo que había sustituido.
- **Los componentes reales son la prueba.** Si la landing dibuja un bloque con
  el mismo `StatementBlock` del editor, entonces la página *es* el producto,
  no una foto suya. Ese es un argumento que una captura nunca da.

---

## 1 · El mensaje: de temario a capacidad

Ahora mismo la sección de temas enumera cuatro cosas y añade "funciones, en
camino". Eso **pone techo** donde no lo hay: dice al lector que Tobot son esas
cuatro cosas.

**Antes:**
> Los temas del curso — Variables · Entrada y salida · Condicionales · Ciclos ·
> *Funciones y más, en camino*

**Después:**
> ### Aprende conceptos, no sintaxis
>
> Cada instrucción trae su explicación, ejemplos y enlaces a fuentes confiables.
> Empiezas por lo esencial y sigues subiendo: la plataforma crece contigo.
>
> **Explora un concepto** →

Y en lugar de chips cerrados, una muestra viva de la tarjeta de concepto real
(`ConceptDrawer` ya tiene el contenido), con un enlace a explorar los demás. La
diferencia: no promete una lista, promete un lugar donde aprender.

---

## 2 · El robot como anfitrión

Aparece tres veces, cada una con un `mood` distinto, contando algo:

| Momento | mood | Qué dice |
| --- | --- | --- |
| **Hero** | `idle` → `speaking` | «¡Hola! Soy Tobot. ¿Armamos un algoritmo?» |
| **Cómo funciona**, paso 3 | `thinking` | Sigue la ejecución paso a paso |
| **Cierre** | `done` | «¿Empezamos?» con una sonrisa |

El componente `Robot` ya acepta `mood` y `message`, así que es reutilizarlo, no
reescribirlo. En el hero, además, la mirada sigue al cursor: un detalle
pequeño que hace la página memorable.

---

## 3 · Componentes a construir

Todos en `src/components/landing/`, y todos apoyados en los del editor.

### `<LiveBlocks>` — el corazón del hero

Un mini-editor **real**, no una imagen: los mismos `StatementBlock` que usa la
app, sobre un AST fijo.

- Los bloques se escriben solos, uno tras otro, como si alguien los estuviera
  armando. Al terminar, espera y vuelve a empezar.
- Es de verdad: usa el `StatementBlock` real con callbacks inertes.
- `IntersectionObserver` para animar solo en pantalla.
- Con `prefers-reduced-motion`, muestra el algoritmo completo sin animar.

Reutiliza: `StatementBlock`, `Editor.css`, tokens de categoría.

### `<FourViews>` — la sección protagonista

Fondo oscuro, a pantalla completa. Un algoritmo, cuatro representaciones
generadas por **los emisores reales**.

- Pestañas que se recorren solas: Español → Pseudocódigo → Código → Diagrama.
- El texto de cada vista sale de `emitters[id].emit(algorithm)`, así que es
  literalmente lo que produce el producto.
- El diagrama usa el `Flowchart` real.
- Se detiene al pasar el ratón.

Reutiliza: `emitters`, `Flowchart`, `highlight.ts`.

Es la pieza que más trabajo lleva y la que más diferencia hace: demuestra la
idea central de Tobot sin una sola palabra de explicación.

### `<RobotGreeting>`

Envoltorio sobre `Robot` con el saludo y el seguimiento de la mirada.

### `<ConceptPeek>`

Una tarjeta de concepto real, tomada de `content/concepts`, con su explicación
y sus enlaces. Sustituye a los chips de temario.

### `<StepCard>`, `<AudienceCard>`, `<FaqItem>`

Extracciones de lo que ya existe, para que `Landing.tsx` deje de crecer.

---

## 4 · Estilos: qué hace que sea "cute"

Sin caer en infantil, que sería el riesgo con universitarios.

- **Formas redondeadas y generosas.** `--radius-lg` en tarjetas, `--radius-full`
  en chips. Ya está en el sistema; se usa más.
- **Los colores de categoría como confeti.** Índigo, cian, ámbar y violeta
  aparecen en iconos, números de paso y detalles. La página se ve como el
  editor.
- **Micro-interacciones.** Tarjetas que se elevan al pasar el ratón, el número
  de paso que rebota al entrar, el robot que parpadea.
- **Formas orgánicas de fondo.** Manchas suaves en los colores de categoría,
  muy tenues, detrás de las secciones. Rompen la rejilla sin ruido.
- **Espacio.** El "cute" sale más del aire que de los adornos.

Riesgo consciente: la línea entre *cálido* e *infantil*. La mantenemos con
tipografía seria (ya la tenemos), texto adulto, y color contenido.

---

## 5 · Estructura final

1. **Hero** — saludo del robot + `<LiveBlocks>` armándose solo
2. **Para quién es** — estudiante / docente
3. **Cómo funciona** — 3 pasos, con el robot en el tercero
4. **Las cuatro vistas** ← protagonista, oscura, `<FourViews>`
5. **Aprende conceptos** ← reemplaza el temario, con `<ConceptPeek>`
6. **Qué encuentras** — 6 tarjetas
7. **Preguntas frecuentes**
8. **Cierre** — el robot despidiéndose
9. **Pie** — Tobot · v1.0.0 · By mocta

---

## 6 · Orden de trabajo

| # | Tarea | Impacto | Esfuerzo |
| --- | --- | --- | --- |
| 1 | `<LiveBlocks>` en el hero (quita la captura) | Muy alto | Medio |
| 2 | `<RobotGreeting>` en hero y cierre | Alto | Bajo |
| 3 | Reescribir temas → **aprender conceptos** | Alto | Bajo |
| 4 | `<FourViews>` (sección oscura) | Muy alto | Alto |
| 5 | `<ConceptPeek>` | Medio | Bajo |
| 6 | Micro-interacciones y fondos orgánicos | Medio | Medio |
| 7 | FAQ | Medio | Bajo |
| 8 | Móvil y accesibilidad AA | Alto | Medio |

Propongo ejecutar **1 → 2 → 3** primero: quitan la captura, meten al robot y
arreglan el mensaje del techo. Es el salto más grande por el menor esfuerzo, y
deja la página coherente aunque paremos ahí.

Luego **4**, que es la que la pone a otro nivel.

---

## 7 · Riesgos

- **Peso.** Montar `StatementBlock` y `Flowchart` en la landing carga parte del
  editor en la primera visita. Mitigación: `React.lazy` para `<FourViews>`, que
  está bajo el pliegue.
- **Acoplamiento.** Si la landing usa componentes del editor, un cambio ahí la
  afecta. Es intencional — esa es la garantía de que nunca miente — pero hay
  que asumirlo conscientemente.
- **Movimiento.** Tres animaciones en bucle pueden distraer. Todas se detienen
  al pasar el ratón y respetan `prefers-reduced-motion`.
