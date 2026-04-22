# Crystallize AI Sidebar

A [Crystallize](https://crystallize.com) **custom view** that lets editors update item content through natural language prompts. It opens as a side-by-side panel next to the item editor, reads the current item's shape + components (including nested pieces and chunks), asks Claude to produce structured updates, and writes them back through the Crystallize Core API. Changes in the editor refresh automatically via `@crystallize/app-signal`.

## Features

- Natural-language editing ("make the description more SEO-friendly", "summarise in 2 sentences")
- Component-aware output — respects shape, component type, and SEO length conventions (meta title 50–60, meta description 140–160, …)
- Supports nested **pieces** and **chunks** (e.g. SEO meta fields, specs)
- Supports `singleLine`, `richText`, `paragraphCollection`, `numeric`, `boolean`, `image`
- Preview before apply, with a before/after diff for text, rich text, and paragraph images
- Auto refresh of the Crystallize item view after updates (app-signal)

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS 4 with Crystallize design tokens
- [`@crystallize/js-api-client`](https://www.npmjs.com/package/@crystallize/js-api-client) for PIM + Core API
- [`@crystallize/app-signal`](https://www.npmjs.com/package/@crystallize/app-signal) for parent-window integration
- [`@anthropic-ai/sdk`](https://www.npmjs.com/package/@anthropic-ai/sdk) with `claude-sonnet-4`

## Getting started

### 1. Install

```bash
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in:

| Variable | Where to get it |
|---|---|
| `CRYSTALLIZE_TENANT_IDENTIFIER` | Your tenant identifier |
| `CRYSTALLIZE_ACCESS_TOKEN_ID` / `_SECRET` | Crystallize → Settings → Access tokens |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com |
| `NEXT_PUBLIC_APP_URL` | Public URL of this app — `http://localhost:4000` in dev, your deployed URL (or ngrok tunnel) otherwise |

### 3. Run the dev server

```bash
pnpm dev
# → http://localhost:4000
```

For local development that's all you need — Crystallize is happy to load `http://localhost:4000` in the custom-view iframe on your own machine, so no tunnel is required to iterate.

### 4. Register the custom view

In Crystallize → **Settings → Apps → Custom views**, add a new view with:

- **URL template:** `http://localhost:4000/?itemId={{itemId}}&language={{language}}&variantId={{variantId}}`
- **Location:** *Item editor – side panel*

Open any item and the sidebar appears next to the editor.

### 5. Optional: share the running app via ngrok

Only needed when someone else (a teammate, a reviewer, a tester on a different machine) needs to open *your* running dev server inside their Crystallize UI. Everyday local development does **not** require this.

```bash
# one-time
brew install ngrok
ngrok config add-authtoken <your-token>

# tunnel :4000 to a public HTTPS URL
ngrok http 4000
# → forwarding https://curly-otter-42.ngrok-free.app -> http://localhost:4000
```

Tip: reserve a static domain so the URL doesn't change on restart:

```bash
ngrok http --url=crystallize-ai-sidebar.ngrok-free.app 4000
```

Then register a second custom view (or update the existing one) with `https://<your-ngrok-host>/?itemId={{itemId}}&…`.

## How it works

```
 Crystallize UI                      AI Sidebar (this app)             External
 ──────────────                      ─────────────────────             ────────
 Item editor  ──── iframe (URL ──►  /app/page.tsx reads URL params
              ──── params)          │
                                    ├─► GET  /api/item  ─────────►  PIM GraphQL
                                    │    (shape + components, flattens
                                    │     pieces & chunks to path leaves)
                                    │
                     user prompt ──►├─► POST /api/ai/generate ────► Anthropic
                                    │    (system prompt includes the
                                    │     targeted components, their
                                    │     semantic role, and length rules)
                                    │
                          apply ───►├─► POST /api/update ─────────► Core API
                                    │    (rebuilds the full piece/chunk
                                    │     payload for nested paths)
                                    │
                                    └─► signal.send("refetchItemComponents")
 Editor refreshes ◄──────────────────
```

Paths use `parent.child` for pieces and `parent[index].child` for chunks, e.g. `meta.title` or `specs[0].width`. This lets the AI and the preview target a single nested field while the update layer reconstructs the full parent payload required by the Core API.

## Project layout

```
app/
  page.tsx              # reads URL params, renders SidebarApp
  api/
    item/               # GET item with pieces & chunks flattened
    ai/generate/        # POST to Claude, returns structured updates
    ai/analyze-image/   # image → alt text
    images/upload/      # upload to Crystallize media library
    update/             # POST update → Core API mutation
    languages/          # list tenant languages
    topics/             # list tenant topics
components/
  SidebarApp.tsx        # orchestrates item + prompt + preview
  AIPrompt.tsx          # prompt input, language pickers, component chips
  UpdatePreview.tsx     # before/after diff, apply per update
  RichTextPreview.tsx   # rich-text renderer (JSON AST)
  ItemContext.tsx       # current item header
  ImageUpload.tsx       # image picker
  SignalReady.tsx       # sends `signal("ready")` on mount
lib/
  crystallize.ts        # PIM queries + Core API mutations
  ai.ts                 # system prompt + Anthropic call
  types.ts              # component / content shapes
  utils.ts              # flattenEditableComponents, helpers
  languages.ts          # language list
```

## Deploying

Any platform that runs a standard Next.js app works (Vercel, Fly, Render, …). The only runtime requirements are the env vars above and HTTPS.

When deployed, register the custom view with your public URL instead of `http://localhost:4000` (or the ngrok host, if you were sharing one).

## Building your own side-by-side custom view

This repo is intentionally structured so you can lift the shell and drop in your own logic. If you want a guided walkthrough (URL params, signals, HTTPS, iframe requirements) without the AI specifics, see the skill at [.github/skills/crystallize-custom-view/SKILL.md](.github/skills/crystallize-custom-view/SKILL.md).

## License

MIT
