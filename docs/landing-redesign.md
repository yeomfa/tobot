# Plan de rediseño — Landing de Tobot

Estado actual medido, no estimado:

| | Escritorio | Móvil |
| --- | --- | --- |
| Altura total | 2 544px (2.8 pantallas) | 4 248px (5.0 pantallas) |
| Altura del hero | 749px | 976px |
| Secciones | 6 | 6 |
| Imágenes / capturas | **0** | **0** |
| Desborde horizontal | no | no |

## El diagnóstico

La landing actual está correcta: la estructura es sensata, el texto es claro y
nada está roto. Lo que le falta para verse como el sitio de una empresa grande
no es más contenido, son **cinco cosas concretas**.

**1. No muestra el producto.** Cero imágenes. Todo lo que un visitante ve son
tarjetas de texto describiendo una herramienta visual. La demo del hero es un
buen intento, pero es una recreación estática: no es Tobot, es un dibujo de
Tobot. Una landing profesional de una herramienta visual se apoya en enseñarla
funcionando.

**2. Todo pesa lo mismo.** Seis secciones, todas con el mismo patrón: título
centrado, subtítulo centrado, rejilla de tarjetas. No hay jerarquía — nada dice
"esto es lo importante". El ojo recorre sin encontrar dónde detenerse.

**3. No hay movimiento.** La página es completamente estática. No pido
animaciones decorativas: hablo de que el producto *se demuestre* al hacer
scroll, que es lo que separa una landing memorable de un folleto.

**4. El móvil son 5 pantallas de texto.** Sin imágenes que rompan el ritmo,
scrollear se hace largo. Y más de la mitad de tus estudiantes va a abrir el
enlace desde el teléfono.

**5. Falta la prueba.** No hay nada que diga que esto se usa de verdad: ni
contexto académico, ni un ejemplo real, ni quién lo respalda.

---

## El plan, en cuatro fases

Ordenadas por impacto sobre esfuerzo. Cada fase deja la landing mejor que
antes, así que se puede parar en cualquier punto.

### Fase 1 — Enseñar el producto (el mayor impacto)

**1.1 · Hero con Tobot de verdad**
Reemplazar la demo dibujada por la aplicación real, en un marco de navegador.
Dos opciones, de menos a más:

- Captura de alta resolución del editor con un algoritmo real, en claro y
  oscuro según el tema del visitante.
- **Recomendado:** un `<iframe>` con el editor en modo demo, corriendo de
  verdad. Es el argumento definitivo — el visitante toca el producto antes de
  decidir nada. Requiere una ruta `/embed` que monte el editor sin cabecera.

**1.2 · Demostración animada de "las cuatro vistas"**
La idea central de Tobot merece su propia sección a pantalla completa: un
bloque que se edita solo y las cuatro vistas cambiando en consecuencia, en
bucle. Es lo que ninguna captura estática puede contar.

**1.3 · Micro-capturas en las tarjetas**
Cada tarjeta de "Lo que encuentras adentro" con una miniatura de esa función
real, no solo un icono.

### Fase 2 — Jerarquía y ritmo

**2.1 · Alternar fondos y anchos**
Secciones alternando fondo (base / superficie), algunas a todo el ancho y otras
en columna estrecha. Rompe la monotonía de seis bloques idénticos.

**2.2 · Una sección protagonista**
Elegir "las cuatro vistas" como la sección grande: a pantalla completa, con
fondo oscuro y la demo animada. El resto se subordina a ella.

**2.3 · Tipografía con más rango**
El título del hero a `clamp(2.5rem, 7vw, 4.5rem)`. Ahora mismo es tímido:
un hero de empresa grande es notablemente grande.

**2.4 · Reordenar por decisión**
Hoy: qué es → cómo funciona → qué trae → temas → para quién → cierre.
Propuesto: qué es → **para quién** → cómo funciona → las cuatro vistas
(protagonista) → qué trae → temas → cierre. Que el visitante se reconozca
antes de leer detalles.

### Fase 3 — Movimiento con propósito

**3.1 · Aparición al hacer scroll**
Las secciones entran con un desplazamiento sutil vía `IntersectionObserver`.
Respetando `prefers-reduced-motion`, que ya honramos en el resto de la app.

**3.2 · Contadores y transiciones de estado**
En la sección de las cuatro vistas, que la transición entre ellas sea visible y
continua, no un corte.

**3.3 · Robot interactivo**
El robot de la app saludando en el hero, siguiendo el cursor con la mirada. Es
el personaje de la marca y hoy no aparece en la landing.

### Fase 4 — Credibilidad y alcance

**4.1 · Contexto de uso real**
Una franja discreta: "Usado en cursos de programación universitaria". Sin
inventar cifras ni logos que no existan.

**4.2 · Sección de preguntas frecuentes**
Cuatro o cinco: ¿es gratis?, ¿necesito instalar algo?, ¿sirve para mi curso?,
¿qué lenguajes genera?, ¿mis datos están seguros? Responde objeciones y además
aporta contenido indexable.

**4.3 · Metadatos para compartir**
Open Graph y Twitter Card con imagen propia. Hoy, si compartes el enlace por
WhatsApp o Classroom, sale sin previsualización. Esto importa mucho para cómo
se ve al repartirlo a una clase.

**4.4 · Móvil de primera clase**
Hero más compacto, tarjetas en carrusel horizontal donde tenga sentido, y
revisar que cada objetivo táctil llegue a 44px.

**4.5 · Accesibilidad verificada**
Contraste AA en toda la página, foco visible en cada elemento interactivo,
navegación completa por teclado.

---

## Lo que yo haría primero

Si solo se hace una cosa: **1.1, el hero con el producto real**. Una landing de
herramienta visual sin una imagen de la herramienta es la carencia más grande
que tiene, y las otras cuatro pesan menos que esa.

Si se hacen tres: **1.1 + 2.1 + 4.3**. Producto visible, ritmo visual, y que el
enlace se vea bien al compartirlo — que es como va a llegar a tus estudiantes.
