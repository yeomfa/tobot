"""Builds identity/ilustraciones-tobot.html (the Flow prompts page) from template.html.

    python3 build.py

Each row is a piece with up to two prompts: A · Cámara, which uses Flow's
camera — angle, perspective, crop, depth — and B · Simple, Tobot from the front,
kept as the fallback when A changes the character too much. The versions saved
in ilustraciones/originales/ as <file>-v1.png (simple) or <file>-cam-v1.png
(camera) are shown in the row, so the page is also where they are compared.
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

# The attached image is Tobot itself, so the character is copied on purpose: one
# robot, the same in every scene.
CHARACTER = f"The robot is Tobot, the character in the attached image. Keep its design exactly — same head, visor, eyes, chest light, body and proportions — and change only its pose and expression: {LOOK}."

# With the camera free, the turnaround sheet is what keeps Tobot itself from
# other sides.
CAMERA_CHARACTER = f"The robot is Tobot, the character in the attached images (the reference scene and the turnaround sheet with its front, three-quarter, side and back views). Keep its design exactly from every angle — same head, visor, eyes, antenna, chest light, body and proportions: {LOOK}. The camera is free to show it from another angle, crop it or place it in depth; the character never changes."

BLOCKS = "Code blocks look like the ones in the attached image: rounded rectangular blocks with a small notch on top and a matching tab below, so they snap together, each with a slightly darker bottom face."

COLORS = "Colors, only these: white #FFFFFF, navy slate #171D2E, orange #E8873A (the antenna ball, the chest light and at most one more small accent), cyan #22D3EE (only the eyes), the block colours indigo #6366F1, teal #0891B2, amber #D97706, violet #7C3AED, pink #DB2777 and olive green #4D7C0F, each with its own darker shade, and a pale grey-blue #E8EBF2 for shadows on the ground."

END = "Background plain solid white #FFFFFF. No text, no letters, no numbers, no logos, no people, no extra objects."

# A camera scene may have a setting, but it has to come off the white cleanly to
# be cut out and placed on the app's own backgrounds, light or dark.
SCENE_END = "Background mostly plain white #FFFFFF: any setting is drawn with a few large soft shapes in pale tones that fade into the white at the edges, never a full rectangle of background. No text, no letters, no numbers, no logos, no people."

# ── Compositions ────────────────────────────────────────────────────────────────
BANNER = "Composition: wide banner. Place the whole scene in the right 45% of the image, centered vertically and standing on an invisible ground with a soft pale shadow; keep the left 55% completely empty white. Large simple shapes that still read when the image is small."
BANNER_CAM = "Composition: wide banner. Keep the left 50% almost empty white, because text sits there; the scene lives in the right half and may bleed off the right and bottom edges. One clear focal point at about three quarters of the width. Large simple shapes that still read when the image is small."
SPOT = "Composition: square image. One single scene, centered, about 60% of the width, standing on an invisible ground with a soft pale shadow, with generous empty white around it."
SPOT_CAM = "Composition: square image. One single scene with one clear focal point slightly off-center; it may be cropped by one edge, and the rest stays white."
HERO = "Composition: wide hero image. The headline sits on the left, so keep the left 45% almost empty white; the scene fills the right 55% and may bleed off the right and bottom edges. One strong focal point at about two thirds of the width."
CARD = "Composition: 4:3 card illustration. One scene centered, about 70% of the width, with white around it so it sits calmly above a short text."
CARD_CAM = "Composition: 4:3 card illustration. One scene with one clear focal point slightly off-center; it may be cropped by one edge, and the rest stays white."
SHEET = "Composition: wide character sheet on plain white, every figure the same size and standing on one shared invisible ground line, evenly spaced across the width, nothing else in the image."


def simple(scene, composition):
    return "\n\n".join([STYLE, CHARACTER, BLOCKS, "Scene: " + scene, composition, COLORS, END])


def cam(camera, scene, composition):
    return "\n\n".join([STYLE, CAMERA_CHARACTER, BLOCKS, "Camera: " + camera, "Scene: " + scene, composition, COLORS, SCENE_END])


def sheet(scene, composition=SHEET):
    return "\n\n".join([STYLE, CHARACTER, "Scene: " + scene, composition, COLORS, END])


GROUPS = {
    "brand": ("Marca", "El logo. Flow sirve para explorar ideas; el definitivo se dibuja a mano en SVG para que se lea a 16 px."),
    "character": ("Tobot · personaje y editor", "Primero que todo: la hoja de giro se guarda también en referencias-flow/ y pasa a ser la segunda referencia de las escenas con cámara."),
    "landing": ("Landing", "Las escenas con más cámara: es donde una imagen con vida compensa su peso."),
    "banners": ("Biblioteca · banners", "En la cabecera de cada sección de la biblioteca, a la derecha, en lugar del ícono actual."),
    "empty": ("Estados vacíos", "Donde hoy solo hay una frase. Simples casi todos: en pequeño, una escena compleja se pierde."),
    "account": ("Cuenta y bienvenida", "Fuera del editor: entrar a la cuenta, el recorrido y el paso a código."),
}

# (group, piece, file, format, note, B · simple prompt or None, A · camera prompt or None)
LOGO = "Create a minimal flat vector app logo mark for a learn-to-code app, based on the robot character in the attached image. The mark is the robot reduced to its simplest geometric form: a rounded square head with a short centered antenna topped by an orange ball, a dark navy rounded visor with two short cyan vertical pill-shaped eyes, and, instead of a body, two or three stacked rounded bars that look like code blocks snapping together, each slightly indented like lines of code. Use as few shapes as possible, all with rounded corners, perfectly symmetrical, built on a simple grid, with bold solid flat colours and no shading, no gradients, no glow, no sparkles, no outlines, no texture.\n\nIt must read clearly at 16 pixels and still work in a single colour.\n\nColors, only these: white #FFFFFF, navy slate #171D2E, orange #E8873A, cyan #22D3EE, and for the bars teal #0891B2 and amber #D97706.\n\nComposition: square image, the mark centered, about 60% of the width, alone on plain solid white #FFFFFF. No text, no letters, no wordmark, no app-icon tile behind it, no other objects."

ROWS = [
    ("brand", "Logo", "logo", "1:1",
     "Exploración: cuatro variantes generadas. Ninguna sirve; el definitivo se redibuja a mano sobre la idea del logo actual.",
     LOGO, None),
    # ── Tobot himself ───────────────────────────────────────────────────────────
    ("character", "Hoja de giro", "tobot-giro", "16:9",
     "Genérala primero y guarda la elegida también como referencias-flow/tobot-giro.png: es la que le enseña a Flow cómo se ve Tobot de lado y de espaldas.",
     sheet("Character turnaround sheet of Tobot: the same robot shown four times side by side at exactly the same size and height, standing in a neutral relaxed pose with its arms slightly away from the body — front view, three-quarter view facing left, side view facing left, and back view."),
     None),
    ("character", "Hoja de expresiones", "tobot-expresiones", "16:9",
     "Los seis estados del robot del editor: reposo, pensando, hablando, preguntando, terminado y error. Sin boca, como en la referencia: todo se dice con los ojos, la antena y la luz del pecho.",
     sheet("Expression sheet: Tobot's head and shoulders shown six times, front view, same size, in two rows of three, one expression each, told only through the eyes on the visor, the antenna and the chest light, with no mouth. Left to right, top row: calm (relaxed pill eyes), thinking (eyes glancing up to one side, antenna ball glowing brighter), speaking (bright eyes lifted upward, chest light bright). Bottom row: asking (eyes wide and round, head tilted), happy and done (eyes as upward curved arcs, a small sparkle by the antenna), error (eyes as two short flat lines, antenna drooping, chest light dim).",
           "Composition: wide sheet on plain white, the six heads in two even rows of three, same size, evenly spaced, nothing else in the image."),
     None),
    ("character", "Tobot base para el editor", "tobot-editor-base", "1:1",
     "La que se vectoriza en capas para el panel del robot: cada parte separada para animarla (parpadeo, antena, brazos, luz del pecho).",
     sheet("Tobot alone, front view, standing perfectly straight and symmetrical, arms hanging slightly away from the body, legs straight, calm relaxed eyes. Every part is clearly separate so it can be animated: the antenna, head, visor, eyes, body, chest light, arms and legs do not overlap one another.",
           "Composition: square image. Tobot centered, about 60% of the image height, on plain white. No sparkles, no glow halo around the body, no ground shadow."),
     None),
    ("character", "Hoja de poses", "tobot-poses", "16:9",
     "Poses de cuerpo entero para los estados del editor y para usar sueltas en la app.",
     sheet("Pose sheet: Tobot full body shown five times side by side at the same size: waving hello with one hand raised high; one hand on its chin, thinking; both arms open wide, asking a question; one arm pointing forward, explaining; shoulders slumped and head lowered, something went wrong."),
     None),

    # ── Landing ─────────────────────────────────────────────────────────────────
    ("landing", "Portada", "landing-hero", "16:9",
     "Para el hero de la landing, junto o detrás de la demo en vivo.",
     simple("Tobot stands next to a big stack of six snapped-together code blocks, one of each colour, waving with one hand.", HERO),
     cam("dramatic low angle from the ground looking up, with a slight wide-angle lens",
         "Tobot stands proudly on top of a big stack of snapped-together code blocks in all six colours, one arm raised high; the stack rises from the bottom edge towards the camera, the nearest blocks large and cropped, with a few sparkles around Tobot.",
         HERO)),
    ("landing", "Paso 1 · Arma tu algoritmo", "landing-step-build", "4:3",
     "«Así funciona», primer paso.",
     simple("Tobot carries a violet code block towards a short column of two snapped-together blocks, about to snap it underneath.", CARD),
     cam("straight top-down view, looking down from directly above",
         "seen from directly above, Tobot drags a violet code block across a large canvas with a faint dot grid to snap it under a short column of two blocks; its antenna points at the camera.",
         CARD_CAM)),
    ("landing", "Paso 2 · Entiende qué hace", "landing-step-understand", "4:3",
     "«Así funciona», segundo paso: lo mismo en bloques y en código.",
     simple("Tobot stands between a column of three code blocks and a dark navy rounded card with three matching short coloured bars, pointing from one to the other.", CARD),
     cam("over-the-shoulder view from behind Tobot, slightly to one side",
         "Tobot, seen from behind, looks at a large dark navy rounded screen split into two halves: on the left a column of three code blocks, on the right three matching rows of short coloured bars standing for lines of code; a soft glow from the screen lights the edge of Tobot's head.",
         CARD_CAM)),
    ("landing", "Paso 3 · Ejecútalo paso a paso", "landing-step-run", "4:3",
     "«Así funciona», tercer paso: el robot va instrucción por instrucción.",
     simple("Tobot steps from one code block to the next on a short row of three blocks laid flat like stepping stones; the block under its foot glows softly.", CARD),
     cam("wide view with strong perspective, the path receding into the distance",
         "Tobot walks along a path of code blocks laid flat like stepping stones that recede into the distance; the block under its foot glows softly, the ones already behind it glow dimmer, and the ones ahead are still unlit.",
         CARD_CAM)),
    ("landing", "Para quien aprende", "landing-for-students", "4:3",
     "Tarjeta «Si estás aprendiendo».",
     simple("Tobot sits at a small desk in front of an open laptop, with a small stack of code blocks beside it.", CARD),
     cam("medium close-up from the side, at desk height",
         "Tobot sits at a small desk in front of an open laptop, its visor lit by the screen, one hand on the trackpad, a small stack of code blocks beside the laptop slightly out of focus in the foreground.",
         CARD_CAM)),
    ("landing", "Para quien enseña", "landing-for-teachers", "4:3",
     "Tarjeta «Si enseñas».",
     simple("Tobot stands beside a board with a simple flowchart of rounded boxes and arrows, pointing at it.", CARD),
     cam("three-quarter view along the board, which recedes in perspective",
         "Tobot stands at a large board and points with a long stick at a simple flowchart of rounded boxes joined by arrows; the board recedes in perspective, its far end smaller.",
         CARD_CAM)),
    ("landing", "Cierre · ¿Empezamos?", "landing-closing", "16:9",
     "Banda final oscura de la landing, junto al «¿Empezamos?».",
     simple("Tobot waves goodbye standing next to a small rocket built from snapped-together code blocks.", HERO),
     cam("low angle looking up, the rocket moving diagonally towards the upper right",
         "Tobot rides a small rocket built from snapped-together code blocks, lifting off towards the upper right, waving at the camera, with a soft trail of small square pixels behind it.",
         HERO)),

    # ── Library banners ─────────────────────────────────────────────────────────
    ("banners", "Tus algoritmos", "banner-saved", "16:9",
     "Sección Guardados: «Empieza uno nuevo, retoma lo que dejaste…».",
     simple("Tobot stands beside the open drawer of a simple rounded filing cabinet, gently placing a small stack of three snapped-together code blocks (violet, teal, amber) into it; two more small stacks already rest inside the drawer.", BANNER),
     cam("high three-quarter view from above, looking down at a slight angle",
         "Tobot kneels in front of a low open shelf seen in depth, arranging small snapped-together stacks of code blocks in rows that recede into the distance; the nearest stack is large in the foreground, slightly cropped by the bottom edge.",
         BANNER_CAM)),
    ("banners", "Ponte a prueba", "banner-challenges", "16:9",
     "Sección Retos: ejercicios a medio hacer.",
     simple("Tobot looks at a tall stack of four snapped-together code blocks that has one empty gap in the middle; it holds the missing amber block in both hands, about to slot it in, its head tilted with curiosity.", BANNER),
     cam("low angle from the ground looking up, with a slight wide-angle perspective",
         "a tall tower of snapped-together code blocks rises up and to the right, with one empty gap near the top; Tobot climbs the tower, one hand on a block, holding the missing amber block up towards the gap; the top of the tower is cropped by the top edge.",
         BANNER_CAM)),
    ("banners", "Aprende con ejemplos", "banner-examples", "16:9",
     "Sección Ejemplos: problemas ya resueltos para comparar.",
     simple("Tobot holds a large round magnifying glass up to a finished program: a neat column of five snapped-together code blocks (indigo, teal, amber, violet, teal) standing beside it, with one small sparkle where the lens points.", BANNER),
     cam("close-up, a large magnifying glass in the foreground",
         "seen through a big round magnifying glass that fills most of the right half, Tobot's visor and one glowing eye appear large and curious; behind the glass, slightly out of focus, stands a neat column of code blocks.",
         BANNER_CAM)),
    ("banners", "Entiende las ideas", "banner-concepts", "16:9",
     "Sección Conceptos: variables, decisiones y ciclos desde cero.",
     simple("Tobot sits on a short stack of three closed books and holds an open book on its lap; above the open book float three simple rounded shapes that stand for ideas: a small indigo box, an amber diamond and a violet circular arrow.", BANNER),
     cam("medium shot from slightly below, with depth",
         "Tobot sits cross-legged reading an open book; from its pages three simple rounded shapes rise into the air in layers — a small indigo box, an amber diamond and a violet circular arrow — the nearest one large and close to the camera, the farthest small.",
         BANNER_CAM)),

    # ── Empty states ────────────────────────────────────────────────────────────
    ("empty", "Biblioteca vacía", "spot-empty-library", "1:1",
     "«Todavía no has guardado ningún algoritmo».",
     simple("Tobot holds an open, empty folder with both hands and peeks into it with a hopeful expression.", SPOT),
     None),
    ("empty", "Algoritmo vacío", "spot-empty-editor", "1:1",
     "En el lienzo de bloques: «Tu algoritmo está vacío».",
     simple("Tobot kneels beside an empty dashed outline of a code block on the ground, holding a teal code block just above it, about to place the very first block.", SPOT),
     cam("straight top-down view, looking down from directly above",
         "seen from directly above: a large empty canvas with a faint dot grid; Tobot kneels at its lower edge and reaches in to place the first teal block in the middle, where a dashed outline waits.",
         SPOT_CAM)),
    ("empty", "Consola sin salida", "spot-empty-console", "1:1",
     "«Aún no hay salida. Ejecuta tu algoritmo para ver qué dice el robot».",
     simple("Tobot stands with an empty rounded speech bubble floating above its head, one hand resting on a big round orange play button on the ground beside it, waiting to be run.", SPOT),
     None),
    ("empty", "Diagrama vacío", "spot-empty-flowchart", "1:1",
     "En la pestaña Diagrama: «Agrega instrucciones para ver el diagrama».",
     simple("Tobot holds a short orange pencil and stands beside a small easel with a blank board; on the board there are only three faint dashed rounded boxes joined by faint dashed arrows, waiting to be filled.", SPOT),
     None),
    ("empty", "Sin resultados", "spot-no-results", "1:1",
     "Filtros de retos y búsqueda de la paleta sin coincidencias.",
     simple("Tobot looks through a large round magnifying glass at an empty patch of ground, its head tilted and one hand raised in a puzzled shrug; the lens shows nothing.", SPOT),
     cam("very wide shot, Tobot small in a big empty space",
         "Tobot, small and far away, stands in a wide empty pale landscape holding a magnifying glass, looking around; nothing else is there except a few faint dashed lines on the ground leading nowhere.",
         SPOT_CAM)),

    # ── Account and welcome ─────────────────────────────────────────────────────
    ("account", "Entrar a la cuenta", "spot-sign-in", "1:1",
     "Junto al formulario de inicio de sesión: «Tus algoritmos te siguen entre el salón y tu casa».",
     simple("Tobot walks along a short gentle path with a small backpack, carrying a little stack of snapped-together code blocks under one arm; a small simple school building stands on the left end of the path and a small simple house on the right end.", SPOT),
     cam("wide shot with deep perspective",
         "a gentle path winds from a small school building in the far distance towards the camera and ends at a small house close to the viewer; Tobot walks along the path towards the house with a small backpack and a little stack of code blocks under one arm.",
         SPOT_CAM)),
    ("account", "Bienvenida del recorrido", "spot-welcome", "1:1",
     "Primer paso del recorrido guiado del editor.",
     simple("Tobot waves hello with one hand raised high, cheerful, standing next to a single amber code block marked with a small white rounded play triangle.", SPOT),
     None),
    ("account", "De bloques a código", "spot-blocks-to-code", "1:1",
     "Opcional: para «Escribir en JavaScript» y «Abrir en JavaScript».",
     simple("Tobot holds a teal code block in one hand; from the block, a short trail of small square pixels flows into a dark navy rounded card that shows a pair of orange curly brace shapes.", SPOT),
     cam("over-the-shoulder view from behind Tobot",
         "Tobot, seen from behind and slightly to the side, holds a teal code block up towards a large dark navy rounded screen; on the screen the same block becomes a pair of orange curly brace shapes, and small square pixels float between the block and the screen.",
         SPOT_CAM)),
]


# What each saved version came to, once reviewed: (state, note). "ok" is good to
# vectorize; "redo" needs another pass in Flow.
REVIEW = {
    "tobot-giro-v1.png": ("ok", "Sirve como referencia. El tres cuartos y el perfil miran a la derecha y su antena sale curva."),
    "tobot-expresiones-v1.png": ("ok", "Salieron 8 caras en vez de 6, pero cubren los seis estados del editor: reposo, pensando, hablando, preguntando, terminado y error."),
    "tobot-editor-base-v1.png": ("ok", "Salió en vista despiezada, con cada parte suelta: mejor de lo pedido para vectorizar en capas y animar."),
    "tobot-poses-v1.png": ("ok", "Salieron 4 poses en vez de 5: falta «explicando, señalando», y en «pensando» la mano está en el pecho, no en la barbilla."),
    "banner-saved-v1.png": ("ok", "Buena composición: la mitad izquierda queda libre."),
    "banner-challenges-v1.png": ("ok", "Sirve de respaldo, aunque el bloque de arriba flota y la torre con hueco se lee poco."),
    "banner-examples-v1.png": ("ok", "Muy clara: la lupa sobre una columna de bloques."),
    "banner-concepts-v1.png": ("ok", "Muy buena: las tres ideas flotan sobre el libro."),
    "spot-empty-library-v1.png": ("ok", "Clara y amable."),
    "spot-empty-editor-v1.png": ("ok", "Se entiende el primer bloque sobre el hueco punteado."),
    "spot-empty-console-v1.png": ("ok", "Muy clara: globo vacío y botón de ejecutar."),
    "spot-empty-flowchart-v1.png": ("ok", "Buena: el diagrama punteado espera ser llenado."),
    "spot-no-results-v1.png": ("ok", "Regenerada: limpia y clara. Reemplaza a la anterior, que salió borrosa."),
    "spot-sign-in-v1.png": ("ok", "De las mejores: escuela, sendero y casa cuentan la idea solos."),
    "spot-welcome-v1.png": ("ok", "Clara: saludo junto al bloque de inicio."),
    "spot-blocks-to-code-v1.png": ("ok", "Clara: del bloque a las llaves, con los píxeles en medio."),
    # Camera versions and the landing.
    "landing-hero-cam-v1.png": ("ok", "La mejor del lote: contrapicado, Tobot en lo alto de una torre de los seis colores."),
    "landing-hero-v1.png": ("ok", "Es la imagen de referencia, no una escena nueva; sirve de respaldo."),
    "landing-step-build-cam-v1.png": ("redo", "La cenital deforma a Tobot: el visor se lee como un casco. Mejor la simple."),
    "landing-step-build-v1.png": ("ok", "Clara: lleva el bloque violeta a la columna."),
    "landing-step-understand-cam-v1.png": ("ok", "Muy buena: sobre el hombro, bloques y código lado a lado en la pantalla."),
    "landing-step-understand-v1.png": ("ok", "Clara, sirve de respaldo."),
    "landing-step-run-cam-v1.png": ("ok", "Excelente: el sendero de bloques en perspectiva, iluminado bajo el pie."),
    "landing-step-run-v1.png": ("ok", "Clara, sirve de respaldo."),
    "landing-for-students-cam-v1.png": ("ok", "Buena profundidad: el escritorio, la pantalla iluminando el visor."),
    "landing-for-students-v1.png": ("ok", "Clara, sirve de respaldo."),
    "landing-for-teachers-cam-v1.png": ("ok", "Buena: la pizarra en perspectiva con el diagrama."),
    "landing-for-teachers-v1.png": ("ok", "Clara, sirve de respaldo."),
    "landing-closing-cam-v1.png": ("ok", "Con mucha vida, aunque el cohete no está hecho de bloques."),
    "landing-closing-v1.png": ("ok", "Correcta pero quieta; respaldo."),
    "banner-saved-cam-v1.png": ("ok", "Con profundidad, aunque es la más cargada y la estantería entra un poco en la zona del texto: vigilarla al recortar."),
    "banner-challenges-cam-v1.png": ("ok", "Muy buena: la escalada cuenta la pieza que falta, que la simple no lograba."),
    "banner-examples-cam-v1.png": ("ok", "Simpática, pero no se ven los bloques que pedía la escena; si molesta, la simple es más clara."),
    "banner-concepts-cam-v1.png": ("ok", "Buena: las ideas más grandes y cercanas."),
    "spot-empty-editor-cam-v1.png": ("ok", "Buena: la cenital funciona aquí, el bloque sobre el hueco punteado."),
    "spot-no-results-cam-v1.png": ("ok", "Tobot pequeño en un espacio vacío: cuenta bien que no hay nada."),
    "spot-sign-in-cam-v1.png": ("ok", "Preciosa: el sendero de la escuela a la casa en perspectiva."),
    "spot-blocks-to-code-cam-v1.png": ("ok", "Buena: sobre el hombro, del bloque a las llaves."),
    # The logo, which Flow cannot do well.
    "logo-v1.png": ("no", "Trae el texto «TOBOT» y la cabeza blanca se pierde sobre blanco."),
    "logo-v2.png": ("no", "La más limpia, pero sin silueta: la cabeza blanca desaparece y a 16 px queda una mancha."),
    "logo-v3.png": ("no", "Trae el texto «TOBOT»; las barras se leen como panqueques, no como bloques."),
    "logo-v4.png": ("no", "El contorno gris salva la silueta pero se ve débil; demasiadas barras para 16 px."),
}

# The version to use for each piece, where one has been chosen.
CHOSEN = {
    "landing-hero": "landing-hero-cam-v1.png",
    "landing-step-build": "landing-step-build-v1.png",
    "landing-step-understand": "landing-step-understand-cam-v1.png",
    "landing-step-run": "landing-step-run-cam-v1.png",
    "landing-for-students": "landing-for-students-cam-v1.png",
    "landing-for-teachers": "landing-for-teachers-cam-v1.png",
    "landing-closing": "landing-closing-cam-v1.png",
    "banner-saved": "banner-saved-cam-v1.png",
    "banner-challenges": "banner-challenges-cam-v1.png",
    "banner-examples": "banner-examples-cam-v1.png",
    "banner-concepts": "banner-concepts-v1.png",
    "spot-empty-library": "spot-empty-library-v1.png",
    "spot-empty-editor": "spot-empty-editor-cam-v1.png",
    "spot-empty-console": "spot-empty-console-v1.png",
    "spot-empty-flowchart": "spot-empty-flowchart-v1.png",
    "spot-no-results": "spot-no-results-cam-v1.png",
    "spot-sign-in": "spot-sign-in-cam-v1.png",
    "spot-welcome": "spot-welcome-v1.png",
    "spot-blocks-to-code": "spot-blocks-to-code-cam-v1.png",
}


def versions(file):
    if not os.path.isdir(ORIGINALS):
        return []
    pattern = re.compile(re.escape(file) + r"-v\d+\.(png|jpe?g|webp)$", re.I)
    return sorted(f for f in os.listdir(ORIGINALS) if pattern.match(f))


def prompt_block(i, label, file, prompt, primary):
    # Every prompt opens with the same style paragraph; what tells one from
    # another is its camera and its scene, so those are shown above it.
    gist = "".join(
        f'<p class="gist"><b>{"Cámara" if line.startswith("Camera") else "Escena"}</b> {html.escape(line.split(": ", 1)[1])}</p>'
        for line in prompt.split("\n\n")
        if line.startswith(("Camera: ", "Scene: "))
    )
    return (
        f'<div class="variant{" primary" if primary else ""}"><div class="variant-head"><b>{html.escape(label)}</b><code>{html.escape(file)}-v1.png</code></div>{gist}'
        f'<div class="pwrap"><pre id="p{i}">{html.escape(prompt)}</pre><button type="button" class="copy" data-target="p{i}">Copiar</button></div></div>'
    )


def render():
    out, files, last, n = [], [], None, 0
    for group, name, file, ar, note, simple_prompt, cam_prompt in ROWS:
        if group != last:
            title, hint = GROUPS[group]
            out.append(f'<tr class="group"><th colspan="3" scope="colgroup">{html.escape(title)}<span>{html.escape(hint)}</span></th></tr>')
            last = group
        found = versions(file + "-cam") + versions(file) if cam_prompt else versions(file)
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
        variants = []
        if cam_prompt:
            variants.append(prompt_block(n, "A · Cámara", file + "-cam", cam_prompt, True))
            n += 1
        if simple_prompt:
            label = "B · Simple, respaldo" if cam_prompt else "Prompt"
            variants.append(prompt_block(n, label, file, simple_prompt, not cam_prompt))
            n += 1
        out.append(f'''<tr{' class="todo"' if not found else ''}>
<td data-label="Pieza"><b>{html.escape(name)}</b>{('<span class="note">' + html.escape(note) + '</span>') if note else ''}{state}{('<div class="versions">' + thumbs + '</div>') if thumbs else ''}</td>
<td data-label="Formato"><span class="ar">{ar}</span><span class="q">1K</span>{'<span class="cam-tag">Con cámara</span>' if cam_prompt else ''}</td>
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
