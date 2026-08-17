# Tobot

A teaching tool for introductory programming. Students build algorithms from a
palette of predefined statements and read the same algorithm back in four
synchronised views — natural language, pseudocode, real source code, and a
flowchart — while a robot executes it step by step.

Covers the five introductory topics: variables, output, input, conditionals and
loops.

## Running it

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm test       # interpreter, emitter and layout tests
pnpm build      # production build into dist/
```

## Architecture

The design rests on one decision: **the algorithm is an AST, and every view is a
projection of it.** Nothing in the app parses text.

```
                  ┌───────────────────┐
                  │   Algorithm AST   │   core/ast
                  └─────────┬─────────┘
        ┌───────────┬───────┴───────┬───────────────┐
        ▼           ▼               ▼               ▼
   ┌─────────┐ ┌──────────┐   ┌──────────┐   ┌───────────┐
   │ natural │ │ pseudo   │   │ JS / Py  │   │ flowchart │
   │ emitter │ │ emitter  │   │ emitters │   │  layout   │
   └─────────┘ └──────────┘   └──────────┘   └───────────┘
                          ▲
                  ┌───────┴────────┐
                  │  interpreter   │   core/runtime
                  └────────────────┘
```

Consequences worth knowing:

- **Invalid programs are unrepresentable.** The editor manipulates the tree
  directly, so the four views can never disagree with each other.
- **Adding a language is one file.** Write an emitter, add it to the registry in
  `core/emitters/index.ts`. Python is in the repo precisely to prove this seam —
  it required no change to the AST, the editor or the interpreter.
- **The interpreter is a pausable state machine**, not a recursive evaluator. It
  uses an explicit frame stack so it can suspend mid-program while waiting for
  student input, and advance exactly one statement at a time to drive the
  flowchart highlight.
- **Static checks run as you type.** `core/ast/validate.ts` catches what the
  interpreter would only find at run time — or never: a duplicated name, a loop
  whose condition nothing updates, a range that runs backwards. Each problem
  carries the id of one statement, so the editor marks exactly one block.

### Where things live

| Path | Responsibility |
| --- | --- |
| `src/core/ast` | Node types, construction, immutable tree operations |
| `src/core/emitters` | One file per output language |
| `src/core/runtime` | Step-based interpreter |
| `src/core/ast/validate.ts` | Static checks surfaced on the block itself |
| `src/core/flowchart` | Two-pass layout producing absolute geometry |
| `src/state` | Editor state with undo, persistence, execution driver |
| `src/i18n` | Spanish (source of truth) and English dictionaries |
| `src/content` | Concept explanations, references, worked examples |

## Layout

A constant canvas with three panels around it — palette, robot, and the
code/diagram drawer. Each hides independently from the header and resizes by
dragging its edge; sizes persist per panel.

The canvas is the grid's `1fr`, so hiding a rail hands its width straight to
the algorithm. The columns are assigned explicitly rather than by source order:
with auto-placement, unmounting a rail let the canvas slide into the rail's
`auto` track and shrink instead of growing.

## Interface languages

Spanish is the default; English is available from the header. Spanish is the
source of truth for copy — `en.ts` is typed against it, so a missing key is a
compile error rather than a runtime fallback.

The interface language also drives the pseudocode keywords (`SI … ENTONCES`
versus `IF … THEN`) and the natural language view, which is the point: the shape
of the algorithm stays identical while only the words change.

## Persistence

Algorithms and preferences are stored in `localStorage` behind the
`AlgorithmStore` interface in `src/state/storage.ts`. Every method is async so
that a Supabase-backed implementation can be dropped in by writing a second
class and changing the one line in `createAlgorithmStore()` — no calling code
changes.

## Deployment

Pushing to `main` builds and publishes to GitHub Pages via
`.github/workflows/deploy.yml`. Enable it once under **Settings → Pages →
Source → GitHub Actions**.

The workflow passes the repository name as `BASE_PATH` so assets resolve under
`/<repo>/`. For a user or organisation page served from the domain root, remove
that environment variable from the workflow.

Tests gate the deploy: a failing interpreter never ships.
