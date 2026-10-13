"""Builds identity/ilustraciones-tobot.html (the Flow prompts page) from template.html.

    python3 build.py

Each row: (group, piece, file, format, note, prompt). The versions saved in
ilustraciones/originales/ as <file>-v1.png, -v2… are shown beside their row,
so the page is also where they are compared.
"""
import html
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
# The page sits in identity/, beside ilustraciones/ and referencias-flow/, so the
# same relative paths work opened from disk and published.
IDENTITY = os.path.normpath(os.path.join(HERE, "..", ".."))
ORIGINALS = os.path.join(IDENTITY, "ilustraciones", "originales")
REFERENCE = "referencias-flow/tobot-referencia.png"

# ── The style: vectorial educativo, chosen from identity/estilos ────────────────
STYLE = "Create an original flat vector illustration in the same style as the attached image: bold rounded shapes, vibrant saturated colours, volume shown with two flat tones per colour (a light side and a shadow side with a clean edge), a soft glow only on the robot's eyes and chest light, and a few small sparkles. Clean edges, no outlines, no gradients other than the glow, no texture."

# The attached image is Tobot itself, so here the character is copied on purpose:
# one robot, the same in every scene.
CHARACTER = "The robot is Tobot, the character in the attached image. Keep its design exactly — same head, visor, eyes, chest light, body and proportions — and change only its pose and expression: a white rounded head and body with light grey-blue shading only on the shadow side, a dark navy rounded visor with two short cyan vertical pill-shaped eyes that glow softly, a short antenna centered on top of the head with an orange ball, a round orange light on its chest, and short rounded arms and legs."

BLOCKS = "Code blocks look like the ones in the attached image: rounded rectangular blocks with a small notch on top and a matching tab below, so they snap together, each with a slightly darker bottom face."

COLORS = "Colors, only these: white #FFFFFF, navy slate #171D2E, orange #E8873A (the antenna ball, the chest light and at most one more small accent), cyan #22D3EE (only the eyes), the block colours indigo #6366F1, teal #0891B2, amber #D97706, violet #7C3AED, pink #DB2777 and olive green #4D7C0F, each with its own darker shade, and a pale grey-blue #E8EBF2 for shadows on the ground."

END = "Background plain solid white #FFFFFF. No text, no letters, no numbers, no logos, no people, no extra objects."

BANNER = "Composition: wide banner. Place the whole scene in the right 45% of the image, centered vertically and standing on an invisible ground with a soft pale shadow; keep the left 55% completely empty white. Large simple shapes that still read when the image is small."

SPOT = "Composition: square image. One single scene, centered, about 60% of the width, standing on an invisible ground with a soft pale shadow, with generous empty white around it."


def piece(scene, composition):
    return "\n\n".join([STYLE, CHARACTER, BLOCKS, "Scene: " + scene, composition, COLORS, END])


def banner(scene):
    return piece(scene, BANNER)


def spot(scene):
    return piece(scene, SPOT)


GROUPS = {
    "banners": ("Biblioteca · banners", "En la cabecera de cada sección de la biblioteca, a la derecha, en lugar del ícono actual."),
    "empty": ("Estados vacíos", "Donde hoy solo hay una frase: aparecen cuando todavía no hay nada que mostrar."),
    "account": ("Cuenta y bienvenida", "Fuera del editor: entrar a la cuenta y el primer paso del recorrido."),
}

ROWS = [
    ("banners", "Tus algoritmos", "banner-saved", "16:9",
     "Sección Guardados: «Empieza uno nuevo, retoma lo que dejaste…».",
     banner("Tobot stands beside the open drawer of a simple rounded filing cabinet, gently placing a small stack of three snapped-together code blocks (violet, teal, amber) into it; two more small stacks already rest inside the drawer.")),
    ("banners", "Ponte a prueba", "banner-challenges", "16:9",
     "Sección Retos: ejercicios a medio hacer.",
     banner("Tobot looks at a tall stack of four snapped-together code blocks that has one empty gap in the middle; it holds the missing amber block in both hands, about to slot it in, its head tilted with curiosity.")),
    ("banners", "Aprende con ejemplos", "banner-examples", "16:9",
     "Sección Ejemplos: problemas ya resueltos para comparar.",
     banner("Tobot holds a large round magnifying glass up to a finished program: a neat column of five snapped-together code blocks (indigo, teal, amber, violet, teal) standing beside it, with one small sparkle where the lens points.")),
    ("banners", "Entiende las ideas", "banner-concepts", "16:9",
     "Sección Conceptos: variables, decisiones y ciclos desde cero.",
     banner("Tobot sits on a short stack of three closed books and holds an open book on its lap; above the open book float three simple rounded shapes that stand for ideas: a small indigo box, an amber diamond and a violet circular arrow.")),

    ("empty", "Biblioteca vacía", "spot-empty-library", "1:1",
     "«Todavía no has guardado ningún algoritmo».",
     spot("Tobot holds an open, empty folder with both hands and peeks into it with a hopeful expression.")),
    ("empty", "Algoritmo vacío", "spot-empty-editor", "1:1",
     "En el lienzo de bloques: «Tu algoritmo está vacío».",
     spot("Tobot kneels beside an empty dashed outline of a code block on the ground, holding a teal code block just above it, about to place the very first block.")),
    ("empty", "Consola sin salida", "spot-empty-console", "1:1",
     "«Aún no hay salida. Ejecuta tu algoritmo para ver qué dice el robot».",
     spot("Tobot stands with an empty rounded speech bubble floating above its head, one hand resting on a big round orange play button on the ground beside it, waiting to be run.")),
    ("empty", "Diagrama vacío", "spot-empty-flowchart", "1:1",
     "En la pestaña Diagrama: «Agrega instrucciones para ver el diagrama».",
     spot("Tobot holds a short orange pencil and stands beside a small easel with a blank board; on the board there are only three faint dashed rounded boxes joined by faint dashed arrows, waiting to be filled.")),
    ("empty", "Sin resultados", "spot-no-results", "1:1",
     "Filtros de retos y búsqueda de la paleta sin coincidencias.",
     spot("Tobot looks through a large round magnifying glass at an empty patch of ground, its head tilted and one hand raised in a puzzled shrug; the lens shows nothing.")),

    ("account", "Entrar a la cuenta", "spot-sign-in", "1:1",
     "Junto al formulario de inicio de sesión: «Tus algoritmos te siguen entre el salón y tu casa».",
     spot("Tobot walks along a short gentle path with a small backpack, carrying a little stack of snapped-together code blocks under one arm; a small simple school building stands on the left end of the path and a small simple house on the right end.")),
    ("account", "Bienvenida del recorrido", "spot-welcome", "1:1",
     "Primer paso del recorrido guiado del editor.",
     spot("Tobot waves hello with one hand raised high, cheerful, standing next to a single amber code block marked with a small white rounded play triangle.")),
    ("account", "De bloques a código", "spot-blocks-to-code", "1:1",
     "Opcional: para «Escribir en JavaScript» y «Abrir en JavaScript».",
     spot("Tobot holds a teal code block in one hand; from the block, a short trail of small square pixels flows into a dark navy rounded card that shows a pair of orange curly brace shapes.")),
]


def versions(file):
    if not os.path.isdir(ORIGINALS):
        return []
    pattern = re.compile(re.escape(file) + r"-v\d+\.(png|jpe?g|webp)$", re.I)
    return sorted(f for f in os.listdir(ORIGINALS) if pattern.match(f))


def render():
    out, files, last = [], [], None
    for i, (group, name, file, ar, note, prompt) in enumerate(ROWS):
        if group != last:
            title, hint = GROUPS[group]
            out.append(f'<tr class="group"><th colspan="4" scope="colgroup">{html.escape(title)}<span>{html.escape(hint)}</span></th></tr>')
            last = group
        found = versions(file)
        files += [f"ilustraciones/originales/{v}" for v in found]
        state = (
            f'<span class="done-tag">{len(found)} {"versión" if len(found) == 1 else "versiones"}</span>'
            if found
            else '<span class="todo-tag">Pendiente</span>'
        )
        thumbs = "".join(
            f'<figure><button type="button" class="zoom" data-src="ilustraciones/originales/{html.escape(v)}" aria-label="Ampliar {html.escape(v)}">'
            f'<img src="ilustraciones/originales/{html.escape(v)}" alt="{html.escape(v)}" loading="lazy"></button><figcaption>{html.escape(v)}</figcaption></figure>'
            for v in found
        )
        out.append(f'''<tr{' class="todo"' if not found else ''}>
<td data-label="Pieza"><b>{html.escape(name)}</b>{('<span class="note">' + html.escape(note) + '</span>') if note else ''}{state}{('<div class="versions">' + thumbs + '</div>') if thumbs else ''}</td>
<td data-label="Archivo"><code>{file}-v1.png</code></td>
<td data-label="Formato"><span class="ar">{ar}</span><span class="q">1K</span></td>
<td data-label="Prompt" class="pcell"><div class="pwrap"><pre id="p{i}">{html.escape(prompt)}</pre><button type="button" class="copy" data-target="p{i}">Copiar</button></div></td>
</tr>''')
    page = (
        open(os.path.join(HERE, "template.html")).read()
        .replace("__ROWS__", "\n".join(out))
        .replace("__REFERENCE__", REFERENCE)
    )
    open(os.path.join(IDENTITY, "ilustraciones-tobot.html"), "w").write(page)
    saved = len(files)
    files.append(REFERENCE)
    open(os.path.join(HERE, "files.txt"), "w").write("\n".join(files) + "\n")
    print(f"{len(ROWS)} piezas, {saved} versiones guardadas → identity/ilustraciones-tobot.html")


if __name__ == "__main__":
    render()
