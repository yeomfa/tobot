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

4. Under **Authentication → URL Configuration**, set *Site URL* to wherever
   the app is published, and add every address it runs at to *Redirect URLs*:

   ```
   https://your-app.vercel.app/**
   https://yourdomain.com/**
   http://localhost:5173/**
   ```

   Supabase only honours a redirect it has been shown, and falls back to the
   Site URL for anything else — which is why a sign-in from production can
   land on localhost. The app asks to come back to the address being visited,
   so both entries are needed for both to work; add the Vercel domain too if
   you deploy there as well.

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
