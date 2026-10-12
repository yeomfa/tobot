# Identidad visual de Tobot

El mismo flujo que en ACUDA: se genera en Google Flow, se guarda aquí, se compara
y lo elegido se vectoriza en capas para la app.

| Carpeta | Qué guarda |
| --- | --- |
| `estilos/` | La comparación de estilos: `python3 build.py` genera `estilos-tobot.html`. |
| `estilos/referencias/<estilo>/` | Ejemplos reales de cada estilo, de terceros. Solo para consulta: no se suben al repositorio. |
| `estilos/pruebas/` | Las pruebas de Flow de cada estilo: `redondeado-v1.png`, `grano-v2.png`… |
| `referencias-flow/` | La imagen que se adjunta en Flow como referencia, una vez elegido el estilo. |
| `ilustraciones/originales/` | Las piezas generadas para la app, con el nombre de su fila y `-v1`, `-v2`… |
| `ilustraciones/prompts/` | La lista de escenas con su prompt, cuando el estilo esté elegido. |

Las imágenes (referencias, pruebas y originales) quedan fuera de git: son de
terceros o pesadas, y lo que llega a la app son los SVG vectorizados.
