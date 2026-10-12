"""Builds estilos-tobot.html (the style comparison page) from template.html.

    python3 build.py

Each style shows real examples from referencias/<id>/ and the Flow tests saved
as pruebas/<id>-v1.png, -v2… Run it again after saving a test, then republish.
"""
import html
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
IMAGE = re.compile(r"\.(png|jpe?g|webp|gif)$", re.I)

# ── Where each reference came from, by file name prefix ──────────────────────────
SOURCES = [
    ("duolingo-", "Duolingo · Shape language", "https://blog.duolingo.com/shape-language-duolingos-art-style/"),
    ("notion-buck-", "BUCK · Notion Faces", "https://buck.co/work/notion-faces"),
    ("notion-", "notion.com", "https://www.notion.com/"),
    ("dribbble-isometrico-", "Dribbble · colección isométrica (varios autores)", "https://dribbble.com/tomsouverain/collections/628510-Isometric"),
    ("krea-ia-", "Krea · moodboard (imágenes generadas por IA)", "https://www.krea.ai/moodboard-feed/textured-corporate-memphis-24d71726-6dd9-52c5-b0e9-d192e5d0cd88"),
    ("fluent-", "Microsoft Fluent Emoji (MIT)", "https://github.com/microsoft/fluentui-emoji"),
    ("dribbble-pixel-", "Dribbble · 8-bit pixel art inspiration", "https://dribbble.com/stories/2022/07/22/8-bit-pixel-art-inspiration"),
    ("excalidraw-producto", "Excalidraw", "https://github.com/excalidraw/excalidraw"),
    ("excalidraw-", "Excalidraw · bibliotecas de la comunidad", "https://libraries.excalidraw.com/"),
    ("kurzgesagt-", "Kurzgesagt · tienda oficial", "https://shop-us.kurzgesagt.org/collections/posters"),
    ("dribbble-anupreeta-", "Dribbble · Anupreeta", "https://dribbble.com/anupreeta"),
    ("dribbble-madebyjulene-", "Dribbble · Julene Harrison", "https://dribbble.com/madebyjulene"),
    ("dribbble-lee-ann-", "Dribbble · Lee-Ann", "https://dribbble.com/Lee-AnnD"),
    ("dribbble-studio-collective-", "Dribbble · Studio Collective", "https://dribbble.com/studio_collective/collections/5488358-INSPIRE"),
    ("dribbble-raydaklam-", "Dribbble · Raydak Lam", "https://dribbble.com/raydaklam"),
]

# ── The test scene, the same for every style so only the style changes ─────────
SCENE = "Scene: a small friendly robot on the left — a white rounded head and body, a dark navy rounded visor with two short cyan vertical pill-shaped eyes, a short antenna with an orange ball on top, and a round orange light on its chest — and, to its right, a neat stack of three rounded rectangular blocks that look like code blocks: violet at the bottom, teal in the middle, amber on top, the amber one marked with a small white rounded play triangle."
COMPOSITION = "Composition: place the robot and the blocks in the right 55% of the image, standing on an invisible ground at the bottom; keep the left 45% completely empty."
COLORS = "Colors, only these: white #FFFFFF, navy slate #171D2E, orange #E8873A, violet #7C3AED, teal #0891B2, amber #D97706, cyan #22D3EE (only the eyes), and a pale grey-blue #E8EBF2 for shadows."
END = "Background plain solid white #FFFFFF. No text, no letters, no logos, no people, no extra objects."


def prompt(style):
    return "\n\n".join([style, SCENE, COMPOSITION, COLORS, END])


STYLES = [
    {
        "id": "redondeado",
        "name": "Geometría redondeada",
        "sub": "Formas básicas con esquinas suaves, como las guías de Duolingo",
        "about": "Todo se arma con tres formas: rectángulo redondeado, círculo y triángulo redondeado. Colores planos, sin contornos y con sombras en forma de píldora.",
        "yes": "Las formas son las mismas que las de los bloques del editor. Se vectoriza casi sola y se recolorea para el modo oscuro.",
        "watch": "Si se parece demasiado a Duolingo pierde identidad; el naranja y los colores de categoría la hacen de Tobot.",
        "prompt": prompt("Create an original flat vector illustration built only from three basic shapes — rounded rectangles, circles and rounded triangles — with every corner softly rounded and no pointed shapes. Solid flat fills, no outlines, no gradients, no texture. Shadows are flat pill-shaped bars under objects, never ovals. Use as few shapes as possible, with clear variety in their sizes. Calm, friendly and playful, with generous empty space."),
    },
    {
        "id": "linea",
        "name": "Línea editorial",
        "sub": "Trazo a mano, casi sin rellenos, como Notion",
        "about": "Dibujo de línea negra o pizarra sobre blanco, con uno o dos colores de acento en rellenos planos. Se siente como un cuaderno de clase.",
        "yes": "La más sobria; convive bien con el código y en oscuro basta invertir el trazo.",
        "watch": "Puede sentirse fría para principiantes. El trazo a mano genera muchos nodos al vectorizar y su grosor varía entre imágenes.",
        "prompt": prompt("Create an original minimalist line illustration: one dark navy line (#171D2E) of even thickness with a slightly hand-drawn feel, on white. Almost no fills: only the antenna ball, the chest light and the play triangle are solid orange; everything else is outline only. No shading, no gradients, no texture. Editorial and quiet, with lots of white space."),
    },
    {
        "id": "isometrico",
        "name": "Isométrico",
        "sub": "Pequeñas maquetas en perspectiva de 30°",
        "about": "Cada objeto es un volumen con cara superior clara y laterales más oscuros del mismo tono. Se lee como construir algo pieza a pieza.",
        "yes": "Encaja con la idea de armar un programa. Son polígonos: se vectoriza fácil y se recolorea.",
        "watch": "Flow suele torcer la perspectiva y el ángulo cambia de una imagen a otra. Es muy de producto SaaS y puede verse corporativo.",
        "prompt": prompt("Create an original isometric flat vector illustration in true 30-degree isometric projection, with no vanishing point. Every object is a simple extruded box with softly rounded edges, with a light top face, a medium left face and a darker right face in the same hue. Solid fills, no outlines, no gradients, no texture, no small details. Calm and tidy, like a small diorama."),
    },
    {
        "id": "grano",
        "name": "Plano con grano",
        "sub": "Formas planas con textura de impresión",
        "about": "Formas simples con una textura fina de grano dentro de cada color, como un cartel impreso. Cálido y táctil.",
        "yes": "Muy cálido y distinto de las apps de programación. Flow lo reproduce con bastante consistencia.",
        "watch": "El grano no se vectoriza: hay que rehacerlo con un filtro en la app. Sobre fondo oscuro se ensucia y pierde contraste.",
        "prompt": prompt("Create an original flat illustration in a risograph print style: simple rounded flat shapes with solid fills, a fine grainy noise texture inside every shape, and a very slight misregistration between colour layers. No outlines, no gradients, no photographic detail. Warm, tactile and calm, with generous empty space."),
    },
    {
        "id": "3d",
        "name": "3D suave",
        "sub": "Volúmenes redondeados e iluminados, como los emoji 3D de Microsoft",
        "about": "Formas infladas, materiales satinados, luz de estudio y sombra de contacto suave. Es el estilo más llamativo de los cinco.",
        "yes": "Muy amable y actual; atrae a estudiantes jóvenes.",
        "watch": "No se puede vectorizar sin perder el volumen: queda como imagen, más pesada y sin recolorear para el modo oscuro. Flow cambia el personaje de una imagen a otra.",
        "prompt": prompt("Create an original soft 3D render in a glossy toy style: rounded, smooth, slightly inflated forms, soft studio lighting from the upper left, gentle ambient occlusion and a soft contact shadow under each object. Matte-to-satin materials, no hard reflections, no texture noise. Cute and friendly, like a premium 3D emoji, with plenty of empty white space."),
    },
    {
        "id": "pixel",
        "name": "Pixel art",
        "sub": "Escenas en cuadrícula de píxeles, como los videojuegos de 8 y 16 bits",
        "about": "Cada forma se arma con píxeles cuadrados del mismo tamaño y una paleta corta. Remite a los videojuegos y a la cultura de programar.",
        "yes": "Conecta con lo que muchos estudiantes ya conocen de los videojuegos y es muy distinto de cualquier otra app educativa.",
        "watch": "Flow suele hacer un falso pixel art con píxeles de tamaños irregulares. Vectorizarlo da miles de cuadrados: conviene dejarlo como imagen escalada sin suavizar, y no se recolorea para el modo oscuro.",
        "prompt": prompt("Create an original pixel art illustration on a strict pixel grid, like a 16-bit game scene: every pixel is the same size, crisp square edges, no anti-aliasing, no blur, a limited palette with flat shading in two or three tones per colour. Simple and readable at a small size, with generous empty space."),
    },
    {
        "id": "boceto",
        "name": "Boceto a mano",
        "sub": "Trazo de pizarra con rellenos rayados, como Excalidraw",
        "about": "Contornos ligeramente temblorosos y rellenos a rayas que no respetan del todo el borde. Así se dibuja un diagrama para pensar un programa.",
        "yes": "Cercano y sin pretensiones: invita a intentarlo. Las formas son simples y en oscuro basta invertir el trazo.",
        "watch": "Puede parecer inacabado en una pantalla de bienvenida. Flow tiende a cargarlo de detalle, y el rayado genera muchos trazos al vectorizar.",
        "prompt": prompt("Create an original hand-drawn sketch illustration in the style of a whiteboard diagram drawn with a marker: slightly wobbly dark navy outlines of uneven pressure, simple shapes, and loose hatched fills in a few colours that do not perfectly stay inside the lines. Informal, friendly and clear, like a quick drawing that explains an idea, with lots of white space."),
    },
    {
        "id": "educativo",
        "name": "Vectorial educativo",
        "sub": "Formas redondas, color vibrante y degradados suaves, como Kurzgesagt",
        "about": "Personajes expresivos de formas simples, colores saturados, degradados leves para dar volumen y algún brillo. Es el lenguaje visual de la divulgación científica.",
        "yes": "Muy atractivo y pensado para enseñar; su mascota (el pájaro) muestra cómo un personaje puede repetirse escena tras escena, como Tobot.",
        "watch": "Los degradados y brillos dan muchas capas al vectorizar. Es denso y puede competir con el contenido; si se acerca demasiado, parecerá una copia de Kurzgesagt.",
        "prompt": prompt("Create an original flat vector illustration in the style of an educational science animation: bold rounded shapes, vibrant saturated colours, smooth subtle gradients for volume, soft glows and a few small sparkles; the robot is cute and expressive. Clean edges, no outlines, no texture."),
    },
    {
        "id": "papel",
        "name": "Papel recortado",
        "sub": "Capas de cartulina cortada con sombras reales",
        "about": "Cada forma es un trozo de papel mate cortado a cuchilla, apilado en capas con sombras suaves entre ellas. Táctil y artesanal.",
        "yes": "Cálido y hecho a mano; nadie en educación de programación lo usa.",
        "watch": "Las sombras y la fibra del papel no se vectorizan: queda como imagen y no se recolorea para el modo oscuro. Cada imagen de Flow sale con una profundidad distinta.",
        "prompt": prompt("Create an original layered paper-cut illustration: every shape is cut from coloured matte cardstock with clean knife-cut edges, stacked in several layers with soft realistic drop shadows between them, so the scene has gentle physical depth. Subtle paper fibre texture, no outlines, no gradients other than the shadows. Calm and crafted, with generous empty space."),
    },
    {
        "id": "bauhaus",
        "name": "Geométrico Bauhaus",
        "sub": "Composiciones de círculos, cuadrados y cuartos de círculo",
        "about": "Todo se construye con figuras geométricas puras en colores planos, en una composición equilibrada y asimétrica, con algún acento de línea fina.",
        "yes": "Formas puras: se vectoriza perfecto y se recolorea. Al ser abstracto, no depende de que Flow repita el mismo personaje.",
        "watch": "Lo abstracto no cuenta historias concretas, así que sirve más para banners que para estados vacíos. Los colores primarios del estilo chocan con los de las categorías.",
        "prompt": prompt("Create an original geometric illustration in a Bauhaus, mid-century modernist style: the robot and the blocks are built only from pure geometric primitives — circles, half circles, squares and quarter circles — in flat solid colours, in a balanced asymmetric composition, with one or two thin-line accents such as a starburst or concentric circles. No outlines on the shapes, no gradients, no texture."),
    },
]


def images(folder):
    path = os.path.join(HERE, folder)
    if not os.path.isdir(path):
        return []
    return sorted(f for f in os.listdir(path) if IMAGE.search(f))


def source_of(name):
    for prefix, label, url in SOURCES:
        if name.startswith(prefix):
            return label, url
    return "Referencia", ""


def figure(src, caption, url=""):
    link = f'<a href="{html.escape(url)}" target="_blank" rel="noopener">{html.escape(caption)}</a>' if url else html.escape(caption)
    return (
        f'<figure><button type="button" class="zoom" data-src="{html.escape(src)}" aria-label="Ampliar">'
        f'<img src="{html.escape(src)}" alt="{html.escape(caption)}" loading="lazy"></button>'
        f'<figcaption>{link}</figcaption></figure>'
    )


def render():
    tests_all = images("pruebas")
    blocks, files = [], []
    for i, style in enumerate(STYLES):
        refs = images(os.path.join("referencias", style["id"]))
        tests = [t for t in tests_all if t.startswith(style["id"] + "-")]
        files += [f"referencias/{style['id']}/{r}" for r in refs] + [f"pruebas/{t}" for t in tests]

        seen = []
        gallery = []
        for r in refs:
            label, url = source_of(r)
            gallery.append(figure(f"referencias/{style['id']}/{r}", label, url))
            if (label, url) not in seen:
                seen.append((label, url))

        if tests:
            trials = '<div class="gallery tests">' + "".join(
                figure(f"pruebas/{t}", t) for t in tests
            ) + "</div>"
        else:
            trials = (
                f'<div class="empty"><b>Aún no hay pruebas.</b> Genera la escena con el prompt de abajo y guárdala como '
                f'<code>identity/estilos/pruebas/{style["id"]}-v1.png</code>.</div>'
            )

        blocks.append(f'''<article class="style" id="{style["id"]}">
  <header class="style-head">
    <div>
      <h2>{html.escape(style["name"])}</h2>
      <p class="sub">{html.escape(style["sub"])}</p>
    </div>
    <span class="count">{len(tests)} {"prueba" if len(tests) == 1 else "pruebas"}</span>
  </header>
  <p class="about">{html.escape(style["about"])}</p>
  <h3>Ejemplos reales</h3>
  <div class="gallery">{"".join(gallery)}</div>
  <h3>Tus pruebas en Flow</h3>
  {trials}
  <dl class="pros">
    <dt class="yes">A favor</dt><dd>{html.escape(style["yes"])}</dd>
    <dt class="watch">Ojo</dt><dd>{html.escape(style["watch"])}</dd>
  </dl>
  <details>
    <summary>Prompt de prueba para Flow</summary>
    <div class="pwrap"><pre id="p{i}">{html.escape(style["prompt"])}</pre><button type="button" class="copy" data-target="p{i}">Copiar</button></div>
  </details>
</article>''')

    nav = "".join(f'<a href="#{s["id"]}">{html.escape(s["name"])}</a>' for s in STYLES)
    page = (
        open(os.path.join(HERE, "template.html"))
        .read()
        .replace("__NAV__", nav)
        .replace("__STYLES__", "\n".join(blocks))
    )
    open(os.path.join(HERE, "estilos-tobot.html"), "w").write(page)
    open(os.path.join(HERE, "files.txt"), "w").write("\n".join(files) + "\n")
    print(f"{len(STYLES)} estilos, {len(files)} imágenes ({len(tests_all)} pruebas) → estilos-tobot.html")


if __name__ == "__main__":
    render()
