"""Builds identity/ilustraciones-tobot.html (the Flow prompts page) from template.html.

    python3 build.py

Second round, one prompt per piece. The first round's scenes sat on white with
pale backdrops the same tone as Tobot's shell, and no cutout could separate the
two, so:

- Scenes with Tobot are drawn on solid navy #171D2E, the library banner's own
  colour. They are used as they come, with no cutout: the banner is navy in
  both themes, and on the landing they sit as navy panels.
- Spots have no Tobot. They are plain objects in mid tones on pure white, which
  comes off cleanly and leaves something that reads on light and dark alike.

Versions saved in ilustraciones/originales/ as <file>-v1.png are shown in their
row. The first round lives in git history, before this file changed.
"""
import html
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
# The page sits in identity/, beside ilustraciones/ and referencias-flow/, so the
# same relative paths work opened from disk and published.
IDENTITY = os.path.normpath(os.path.join(HERE, "..", ".."))
ORIGINALS = os.path.join(IDENTITY, "ilustraciones", "originales")
FLOW_REFS = os.path.join(IDENTITY, "referencias-flow")


def reference(name):
    """The reference saved under this name, or its latest -vN, which is how Flow's
    downloads tend to arrive."""
    found = sorted(
        (f for f in os.listdir(FLOW_REFS) if re.fullmatch(re.escape(name) + r"(-v\d+)?\.png", f)),
        key=lambda f: int(m.group(1)) if (m := re.search(r"-v(\d+)\.png$", f)) else 0,
    ) if os.path.isdir(FLOW_REFS) else []
    return f"referencias-flow/{found[-1] if found else name + '.png'}"


REFERENCES = [reference("tobot-referencia"), reference("tobot-giro")]

# ── The style: vectorial educativo, chosen from identity/estilos ────────────────
STYLE = "Create an original flat vector illustration in the same style as the attached image: bold rounded shapes, vibrant saturated colours, volume shown with two flat tones per colour (a light side and a shadow side with a clean edge), a soft glow only on the robot's eyes and chest light, and a few small sparkles. Clean edges, no outlines, no gradients other than the glow, no texture."

LOOK = "a white rounded head and body with light grey-blue shading only on the shadow side, a dark navy rounded visor with two short cyan vertical pill-shaped eyes that glow softly, a short antenna centered on top of the head with an orange ball, a round orange light on its chest, and short rounded arms and legs"

CHARACTER = f"The robot is Tobot, the character in the attached images (the reference scene and the turnaround sheet with its front, three-quarter, side and back views). Keep its design exactly from every angle — same head, visor, eyes, antenna, chest light, body and proportions: {LOOK}. The camera may show it from another angle or crop it; the character never changes."

BLOCKS = "Code blocks look like the ones in the attached image: rounded rectangular blocks with a small notch on top and a matching tab below, so they snap together, each with a slightly darker bottom face."

COLORS = "Colors, only these: white #FFFFFF for Tobot, orange #E8873A (the antenna ball, the chest light and at most one more small accent), cyan #22D3EE (only the eyes), the block colours indigo #6366F1, teal #0891B2, amber #D97706, violet #7C3AED, pink #DB2777 and olive green #4D7C0F, each with its own darker shade, and pale blue #A5B4D4 for the few small sparkles."

# The banner is this navy in both themes, so a scene on it needs no cutout.
NAVY_END = "Background: one solid flat dark navy #171D2E filling the whole image edge to edge — perfectly uniform, no gradient, no vignette, no light spilling across it, no texture, no pattern, no floor, and no blobs, panels or shapes behind the scene. Shadows under things are a slightly darker navy. No text, no letters, no numbers, no logos, no people."

BANNER = "Composition: wide 16:9 image. The scene is centered and fills about 85% of the height; the outer 15% on the left and on the right stay plain navy, so the image can melt into a navy banner. Large simple shapes that still read when the image is small."
CARD = "Composition: 4:3 image. One scene, centered, about 75% of the width, with plain navy all around it."
WIDE = "Composition: wide 16:9 image. One scene, centered, about 60% of the width, with plain navy all around it."

# ── Spots: no Tobot, objects only ───────────────────────────────────────────────
SPOT_STYLE = "Create an original flat vector spot illustration of a single small object: bold rounded shapes, vibrant saturated colours, volume shown with two flat tones per colour (a light side and a shadow side with a clean edge). Clean edges, no outlines, no gradients, no glow, no texture."

SPOT_BLOCKS = "Code blocks are rounded rectangular blocks with a small notch on top and a matching tab below, like puzzle pieces that snap together, each with a slightly darker bottom face. A dashed block is only its outline, drawn as a thick dashed line in slate #64748B with nothing inside."

SPOT_COLORS = "Colors, only these: navy slate #171D2E, slate #64748B, orange #E8873A, indigo #6366F1, teal #0891B2, amber #D97706 and violet #7C3AED, each with its own darker shade. Nothing white or near-white inside the object: every part is a mid or strong tone, so it reads on a light page and on a dark one."

SPOT_END = "Composition: square image, the object centered, about 55% of the width. Background plain solid pure white #FFFFFF everywhere around the object, edge to edge — no floor, no ground shadow, no blobs, no pale shapes, no sparkles, no frame. No robot, no characters, no people, no text, no letters, no numbers, no logos."


def scene(text, composition, camera=None):
    parts = [STYLE, CHARACTER, BLOCKS]
    if camera:
        parts.append("Camera: " + camera)
    return "\n\n".join(parts + ["Scene: " + text, composition, COLORS, NAVY_END])


def spot(text):
    return "\n\n".join([SPOT_STYLE, SPOT_BLOCKS, "Object: " + text, SPOT_COLORS, SPOT_END])


GROUPS = {
    "banners": ("Biblioteca · banners", "Con Tobot, sobre azul marino: a la derecha de cada cabecera, que es de ese mismo azul en los dos temas."),
    "landing": ("Landing", "Con Tobot, sobre azul marino: en la landing van como paneles azules de esquinas redondeadas, en tema claro y oscuro."),
    "spots": ("Spots · estados vacíos", "Sin Tobot y sin adjuntar ninguna referencia: el adjunto trae al robot. Hoy ya hay spots dibujados a mano en la app; estos son para comparar."),
}

# (group, piece, file, format, note, prompt)
ROWS = [
    # ── Library banners ─────────────────────────────────────────────────────────
    ("banners", "Tus algoritmos", "banner-saved-navy", "16:9",
     "Sección Guardados.",
     scene("Tobot kneels beside a low open shelf, placing a small stack of three snapped-together code blocks (violet, teal, amber) on it; two more small stacks already rest on the shelf.",
           BANNER, "high three-quarter view, looking down at a slight angle")),
    ("banners", "Ponte a prueba", "banner-challenges-navy", "16:9",
     "Sección Retos.",
     scene("A tower of snapped-together code blocks in all six colours rises with one empty gap near the top; Tobot climbs it, one hand on a block, holding the missing amber block up towards the gap.",
           BANNER, "low angle from below, with a slight wide-angle perspective")),
    ("banners", "Aprende con ejemplos", "banner-examples-navy", "16:9",
     "Sección Ejemplos.",
     scene("Tobot holds a large round magnifying glass up to a finished program: a neat column of five snapped-together code blocks (indigo, teal, amber, violet, teal) standing beside it; one of its glowing eyes looks big through the lens.",
           BANNER)),
    ("banners", "Entiende las ideas", "banner-concepts-navy", "16:9",
     "Sección Conceptos.",
     scene("Tobot sits on a short stack of three closed books and holds an open book on its lap; above the open book float three simple rounded shapes that stand for ideas: a small indigo box, an amber diamond and a violet circular arrow.",
           BANNER)),

    # ── Landing ─────────────────────────────────────────────────────────────────
    ("landing", "Paso 1 · Arma tu algoritmo", "landing-step-build-navy", "4:3",
     "«Así funciona», primer paso.",
     scene("Tobot carries a violet code block towards a short column of two snapped-together blocks (teal and pink), about to snap it underneath.", CARD)),
    ("landing", "Paso 2 · Entiende qué hace", "landing-step-understand-navy", "4:3",
     "«Así funciona», segundo paso: lo mismo en bloques y en código.",
     scene("Tobot, seen from behind, looks at a large rounded screen in a slightly lighter navy, split into two halves: on the left a column of three code blocks, on the right three matching rows of short coloured bars standing for lines of code.",
           CARD, "over-the-shoulder view from behind Tobot, slightly to one side")),
    ("landing", "Paso 3 · Ejecútalo paso a paso", "landing-step-run-navy", "4:3",
     "«Así funciona», tercer paso.",
     scene("Tobot walks along a path of code blocks laid flat like stepping stones that recede into the distance; the block under its foot glows softly, the ones behind it glow dimmer and the ones ahead are unlit. The glow stays on the blocks and never spreads over the background.",
           CARD, "wide view with strong perspective, the path receding into the distance")),
    ("landing", "Para quien aprende", "landing-for-students-navy", "4:3",
     "Tarjeta «Si estás aprendiendo».",
     scene("Tobot sits at a small desk in front of an open laptop, its visor lit by the screen, one hand on the trackpad, a small stack of code blocks beside the laptop.",
           CARD, "medium shot from the side, at desk height")),
    ("landing", "Para quien enseña", "landing-for-teachers-navy", "4:3",
     "Tarjeta «Si enseñas».",
     scene("Tobot stands at a large white board and points with a long stick at a simple flowchart of rounded coloured boxes joined by arrows; the board recedes in perspective.",
           CARD, "three-quarter view along the board")),
    ("landing", "Cierre · ¿Empezamos?", "landing-closing-navy", "16:9",
     "Banda final oscura de la landing.",
     scene("Tobot rides a small rocket built from snapped-together code blocks, lifting off towards the upper right and waving at the camera, with a short trail of small square pixels in the block colours behind it.",
           WIDE, "low angle looking up, the rocket moving diagonally towards the upper right")),

    # ── Spots ───────────────────────────────────────────────────────────────────
    ("spots", "Biblioteca vacía", "spot-library", "1:1",
     "«Todavía no has guardado ningún algoritmo».",
     spot("An open indigo folder, seen at a slight angle, completely empty inside (its inner back a darker indigo); just above its opening floats one dashed block, waiting to be filed.")),
    ("spots", "Algoritmo vacío", "spot-editor", "1:1",
     "Lienzo de bloques: «Tu algoritmo está vacío».",
     spot("A teal code block hovers just above a dashed block of exactly the same shape, about to snap into it, with two short slate motion lines between them.")),
    ("spots", "Consola sin salida", "spot-console", "1:1",
     "«Aún no hay salida. Ejecuta tu algoritmo…».",
     spot("A small rounded terminal window in navy slate with a slate title bar holding three small dots; inside, only an orange prompt chevron followed by a short orange cursor bar.")),
    ("spots", "Diagrama vacío", "spot-flowchart", "1:1",
     "Pestaña Diagrama: «Agrega instrucciones para ver el diagrama».",
     spot("A tiny flowchart drawn top to bottom: a solid teal rounded start pill, then a dashed slate line down to a dashed rounded rectangle, then another dashed line to a dashed diamond, both still empty.")),
    ("spots", "Sin resultados", "spot-search", "1:1",
     "Filtros de retos y búsqueda de la paleta sin coincidencias.",
     spot("A large round magnifying glass with a navy slate rim and an orange handle, its lens a translucent teal tint, held over two dashed blocks; the lens shows nothing inside them.")),
]


# What each saved version came to, once reviewed: (state, note).
REVIEW = {}

# The version to use for each piece, where one has been chosen.
CHOSEN = {}


def versions(file):
    if not os.path.isdir(ORIGINALS):
        return []
    pattern = re.compile(re.escape(file) + r"-v\d+\.(png|jpe?g|webp)$", re.I)
    return sorted(f for f in os.listdir(ORIGINALS) if pattern.match(f))


def prompt_block(i, label, file, prompt, primary):
    # Every prompt opens with the same style paragraph; what tells one from
    # another is its camera and its scene, so those are shown above it.
    gist = "".join(
        f'<p class="gist"><b>{"Cámara" if line.startswith("Camera") else "Objeto" if line.startswith("Object") else "Escena"}</b> {html.escape(line.split(": ", 1)[1])}</p>'
        for line in prompt.split("\n\n")
        if line.startswith(("Camera: ", "Scene: ", "Object: "))
    )
    return (
        f'<div class="variant{" primary" if primary else ""}"><div class="variant-head"><b>{html.escape(label)}</b><code>{html.escape(file)}-v1.png</code></div>{gist}'
        f'<div class="pwrap"><pre id="p{i}">{html.escape(prompt)}</pre><button type="button" class="copy" data-target="p{i}">Copiar</button></div></div>'
    )


def render():
    out, files, last, n = [], [], None, 0
    for group, name, file, ar, note, prompt in ROWS:
        if group != last:
            title, hint = GROUPS[group]
            out.append(f'<tr class="group"><th colspan="3" scope="colgroup">{html.escape(title)}<span>{html.escape(hint)}</span></th></tr>')
            last = group
        found = versions(file)
        files += [f"ilustraciones/originales/{v}" for v in found]
        state = (
            f'<span class="done-tag">{len(found)} {"versión" if len(found) == 1 else "versiones"}</span>'
            if found
            else '<span class="todo-tag">Pendiente</span>'
        )
        def thumb(v):
            state, comment = REVIEW.get(v, (None, ""))
            badge = (
                '<span class="review chosen">Elegida</span>' if CHOSEN.get(file) == v
                else '<span class="review ok">Aprobada</span>' if state == "ok"
                else '<span class="review redo">Rehacer</span>' if state == "redo"
                else '<span class="review redo">Descartada</span>' if state == "no"
                else ""
            )
            return (
                f'<figure{" class=\"redo\"" if state in ("redo", "no") else " class=\"chosen\"" if CHOSEN.get(file) == v else ""}><button type="button" class="zoom" data-src="ilustraciones/originales/{html.escape(v)}" aria-label="Ampliar {html.escape(v)}">'
                f'<img src="ilustraciones/originales/{html.escape(v)}" alt="{html.escape(v)}" loading="lazy"></button>'
                f'<figcaption>{badge}{html.escape(v)}{("<span class=\"comment\">" + html.escape(comment) + "</span>") if comment else ""}</figcaption></figure>'
            )

        thumbs = "".join(thumb(v) for v in found)
        variants = [prompt_block(n, "Prompt", file, prompt, True)]
        n += 1
        out.append(f'''<tr{' class="todo"' if not found else ''}>
<td data-label="Pieza"><b>{html.escape(name)}</b>{('<span class="note">' + html.escape(note) + '</span>') if note else ''}{state}{('<div class="versions">' + thumbs + '</div>') if thumbs else ''}</td>
<td data-label="Formato"><span class="ar">{ar}</span><span class="q">1K</span>{'<span class="cam-tag">Con cámara</span>' if "Camera: " in prompt else ''}</td>
<td data-label="Prompts" class="pcell">{"".join(variants)}</td>
</tr>''')
    references = "".join(
        f'<figure><img src="{r}" alt="" loading="lazy" onerror="this.closest(\'figure\').classList.add(\'missing\')"><figcaption><code>identity/{r}</code></figcaption></figure>'
        for r in REFERENCES
    )
    page = (
        open(os.path.join(HERE, "template.html")).read()
        .replace("__ROWS__", "\n".join(out))
        .replace("__REFERENCES__", references)
    )
    open(os.path.join(IDENTITY, "ilustraciones-tobot.html"), "w").write(page)
    saved = len(files)
    files += [r for r in REFERENCES if os.path.exists(os.path.join(IDENTITY, r))]
    open(os.path.join(HERE, "files.txt"), "w").write("\n".join(files) + "\n")
    print(f"{len(ROWS)} piezas, {n} prompts, {saved} versiones guardadas → identity/ilustraciones-tobot.html")


if __name__ == "__main__":
    render()
