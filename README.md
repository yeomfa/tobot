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

That holds for block algorithms, which is what almost all of this document is
about. There is a second kind of document — see [Writing code](#writing-code) —
that is text and is deliberately outside it.

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
| `src/core/code` | The vocabulary, checks and worker behind code documents |
| `src/core/classroom` | Marking a submission against a teacher's cases |
| `src/core/world` | Scenarios a program acts on: components, time, the registry of world functions |
| `src/core/activity.ts` | The shape of set work, shared by challenges, assignments and authoring |
| `src/components/scene` | The scene panel that draws a world |

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

## Writing code

A second kind of document. An algorithm carries a `kind`: `blocks` is
everything above and stays the default, while a `code` document holds its
program as text in `source` and leaves `body` empty. One type rather than two,
because a name, a place in the library, a row in the database and an export
file are the same for both.

The editor is CodeMirror 6, loaded as its own chunk the first time a code
document is opened. It colours from the same `--code-*` tokens the read-only
view uses, offers Tobot's own functions alongside the names the program
declares, and explains a function under the pointer. A student reaches it
either by starting one from the library or by opening a block algorithm with
**Abrir en JavaScript**, which seeds it from the JavaScript emitter — so the
first code they read is their own algorithm.

Programs run in a Web Worker. Not for tidiness: in blocks a runaway loop is
caught by the validator before it runs, in text nothing catches it, and only a
worker can be killed without taking the tab with it. `console.log` reaches the
console and `prompt`/`ask` reach the robot, both reported in the same
`ExecutionState` shape the interpreter produces — which is why the console and
the robot are the same components on both workbenches.

Asking is therefore a promise, so the emitter writes `await prompt(...)` and
the editor flags its absence. Without the keyword a program computes with the
promise and prints `NaN`, silently.

## Classrooms

A teacher creates a room and hands out a short code; students join with it.
The teacher sets assignments — a starting algorithm plus cases, each a list of
answers and the lines the program should print — and decides what each is
worth.

Both happen in the workbench, which has a mode for what it is doing:

- **own** — the student's own document; nearly always.
- **doing** — set work with its brief in the rail: an assignment to hand in, or
  a built-in challenge whose cases the student can check against.
- **review** — a teacher reading one submission. Read-only in both editors,
  runnable, and markable in place, with each case's expected result beside
  what happened.
- **author** — a teacher writing an assignment: title, instructions, points,
  scenario and cases in the brief panel, the starting program in the real
  editor. Editing an existing assignment opens the same mode on it.

Review and author switch saving off (`useAlgorithm`'s `setPersisting`): loading
is itself a change, so without it opening a submission copied it into the
teacher's library half a second later. The teacher's own document is saved
first and put back on the way out.

Marking happens in the teacher's browser. There is no server, and the browser
key is public, so a mark computed on the student's machine would be a claim
rather than a fact; the policies let only the room's teacher write a score, and
a trigger checks it again. Marks are partial: points times passed over total.

All of the rules live in `supabase/schema.sql` rather than in React. Three of
them are worth knowing before changing anything there:

- Every membership test goes through a `security definer` function. A policy on
  `classroom_members` that queries `classroom_members` makes Postgres recurse
  and every query on the table fails.
- Joining is a function, not an insert: a student holding a code cannot read the
  room it names, and it answers the same way for a code that does not exist as
  for one that is not theirs.
- The leaderboard is its own function too, because a student may read their own
  submissions and nobody else's — so it cannot be assembled from rows the
  caller is allowed to see.

**Run `supabase/schema.sql` in full after pulling.** It is written to be
re-runnable — `create table if not exists`, `drop policy if exists` before each
policy, `create or replace` for every function — and each of the three times it
has grown, a deploy without it has broken something in production.

## Worlds

A document can carry a **world**: a scenario its program acts on — a panel of
buttons, lamps and motors today; a conveyor or a safety scenario on the same
footing tomorrow. Absent means exactly what Tobot was before, so no existing
program behaves differently.

The model is deliberately small. A component is an **input** the scenario owns
(a pushbutton, a sensor) or an **output** the program owns (a lamp, a motor, a
siren); skins are only how it is drawn. Four functions act on it — `encender`,
`apagar`, `leer`, `esperar` (`turnOn`, `turnOff`, `read`, `wait`) — named in the
interface language like pseudocode, stored in the tree by their stable id, and
accepted by both runtimes under every name. Each shows its Arduino line on hover.

**World time is moved by the program.** It is neither interpreter steps nor the
wall clock: only `esperar` advances it. That is what makes a run deterministic,
and so markable: the same program leaves the same world in either editor, on
any machine. The world is a pure module (`src/core/world`) that each runtime
hosts locally — the interpreter on the main thread, `runSource` inside the code
worker — so reading a sensor is a plain synchronous call in both, and the
parity test runs every program both ways and requires identical worlds.

A scenario has a duration, and reaching it ends the run normally. A control
program is an endless loop by nature — read, act, wait, again — and the
scenario ending is what lets it finish and be checked. A case can describe what
the scenario does by itself and what must be true when, one moment per line:
`1 arranque sí` presses start at second 1; `4 motor sí` requires the motor on
at second 4.

Authoring a world is choosing a template and renaming its parts; drawing one
from nothing is a later feature. Numeric sensors, moving items and zones —
which production and safety will need — arrive as new kinds of component in the
same registry.

## Persistence

Algorithms and preferences are stored in `localStorage` behind the
`AlgorithmStore` interface in `src/state/storage.ts`.

Optionally, students can sign in and have their work follow them between
computers. `createAlgorithmStore()` returns the Supabase-backed store when a
session exists and the local one when it does not, so no component knows which
it is talking to. With no credentials configured the account layer does not
exist at all: no sign-in screen, no network calls, and the app behaves exactly
as it did before.

### Enabling accounts

1. Create a free project at [supabase.com](https://supabase.com).
2. In **SQL Editor → New query**, run [`supabase/schema.sql`](supabase/schema.sql).
   It creates the `algorithms` and `profiles` tables with row-level security:
   the browser key is public, so the *database* is what stops one student
   reading another's work, not the client code.
3. From **Project Settings → API Keys**, copy the project URL and the
   publishable key into `.env.local`:

   ```
   VITE_SUPABASE_URL=https://yourproject.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   VITE_SUPABASE_GOOGLE=false
   ```

   A project created before 2025 has a legacy `anon` JWT instead, under the
   *Legacy API Keys* tab; it works the same, and `VITE_SUPABASE_ANON_KEY` is
   still read if that is what you have.

   Never use the `sb_secret_` key: it bypasses those policies and must not
   reach a browser. Restart `pnpm dev` afterwards — Vite reads env at startup.

   Leave the values blank to run entirely on localStorage, with no account
   layer at all.

4. Under **Authentication → URL Configuration**, set *Site URL* to the
   published address — a fresh project has it at `http://localhost:3000`,
   which is nothing this app runs on — and add every host it runs on to
   *Redirect URLs*:

   ```
   https://your-app.vercel.app/**
   https://yourdomain.com/**
   http://localhost:5173/**
   ```

   Supabase only honours a redirect it has been shown, and **silently** falls
   back to the Site URL for anything else — with a valid token attached, so it
   looks as though the app asked for the wrong address. That is why a sign-in
   from production lands on localhost. The app asks to come back to
   `/library` on whatever host it is running on, so every host needs its own
   entry.

5. Optionally turn off *Confirm email* under **Authentication → Sign In /
   Providers → Email**. The built-in mail service is rate-limited for testing,
   so thirty students signing up at once will not all receive a message.

### Google sign-in (optional)

Skip this and students sign in with email and password.

1. In Supabase, open **Authentication → Sign In / Providers → Google** and
   copy the **Callback URL** it shows.
2. In [Google Cloud Console](https://console.cloud.google.com), pick or create
   a project and open **APIs & Services**. Google is midway through renaming
   this screen, so the sidebar shows one of two things:

   - **OAuth consent screen** — the older form. Click it and pick **External**
     right there, then fill in the app name and support email.
   - **Google Auth Platform** — the newer version, split into the tabs
     *Branding*, *Audience*, *Data Access* and *Clients*. Press **Get
     started**, enter the app name and support email, and choose **External**
     when it asks for the audience. The user type lives on the *Audience* tab
     here, which is why the first screen never offers it.

3. Create the client: **Credentials → Create credentials → OAuth client ID**
   on the older console, or the **Clients → Create client** tab on the newer
   one. Either way choose *Web application* and paste the callback URL from
   step 1 into **Authorised redirect URIs**. It has to match exactly, or
   sign-in fails with `redirect_uri_mismatch`.

   While the app is unpublished, only the accounts listed as **test users**
   can sign in. Add your own, or publish the app, before asking a class to
   try it.
4. Copy the resulting *Client ID* and *Client Secret* back into the Supabase
   Google provider page and enable it.
5. Set `VITE_SUPABASE_GOOGLE=true`. On the published site this is a
   repository **variable**, not a secret — *Settings → Secrets and variables
   → Actions → Variables*. Set as a secret it reads back empty and the button
   stays hidden. Until then the button is hidden rather
   than failing when pressed.

## Deployment

Hosted on Vercel. Import the repository at [vercel.com/new](https://vercel.com/new)
— the framework, the build command and the output directory are all detected,
and `vercel.json` carries the rest.

Add the three environment variables under **Settings → Environment Variables**,
for every environment you want accounts in:

```
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_GOOGLE
```

Vite reads them at build time, so a change to any of them needs a redeploy to
take effect. None is truly secret — they end up in the JavaScript the browser
downloads — and row-level security is what protects the data.

For a custom domain, add it under **Settings → Domains**, then go back to
Supabase and add it to *Redirect URLs* (see step 4 above). A sign-in from an
address Supabase has not been shown falls back to the Site URL, which is how
someone ends up on localhost after signing in from production.

### Why not GitHub Pages

It served the app from `/<repo>/` and could not route unknown paths, which
needed a `base` prefix, a `404.html` redirect and a plugin to bake the prefix
into it. Those three parts between them produced a blank page on reload and,
in one build configuration, an infinite redirect. Vercel routes to
`index.html` itself, so a single `rewrites` rule replaces all of it — and it
handles the domain.
