---
name: crystallize-custom-view
description: "Use when building a Crystallize side-by-side custom view — a web app embedded as an iframe next to the Crystallize item editor. Covers the URL parameter contract, the @crystallize/app-signal handshake, running local dev against Crystallize (with ngrok as an optional way to share the running app), CORS + Private Network Access, registering the custom view in Crystallize, and the minimal file layout for a Next.js shell. Do NOT use for generic Next.js setup, Crystallize API-only integrations without a UI, or non-iframe Crystallize extensions."
---

# Crystallize side-by-side custom view

Use this skill to scaffold a custom view that renders alongside the Crystallize item editor. The skill is agnostic to what the view *does* — it focuses on the embedding contract (URL params, signals, HTTPS, CORS) that every side-by-side view must satisfy.

## When this applies

- Editor asks for a "panel next to the item editor", "side-by-side view", "custom view", "Crystallize iframe app".
- Anything that needs to react to the currently-viewed item and push updates back to the editor.

## What a custom view is

A custom view is just a web app that Crystallize loads in an iframe next to the item editor. Crystallize injects context through the URL and talks to the iframe through `@crystallize/app-signal` over `postMessage`. You can build it with any framework; this skill uses Next.js as the default because it keeps SSR, API routes, and static assets in one process.

## Build checklist

Follow these in order. Each step has a concrete deliverable.

### 1. URL parameter contract

The view is loaded by Crystallize with a template URL. Settle on the placeholders you need:

```
https://<app>/?itemId={{itemId}}&language={{language}}&variantId={{variantId}}
```

Available placeholders:

| Placeholder | When present |
|---|---|
| `{{itemId}}` | Always, for item-scoped views |
| `{{language}}` | Always |
| `{{variantId}}` | Only when viewing a product variant |
| `{{tenantIdentifier}}` | Always; useful for multi-tenant apps |
| `{{shapeIdentifier}}` | When registered as shape-scoped |

Read them on the client with `useSearchParams()` (or in a server component via the `searchParams` prop). If any required param is missing, render a "missing context" placeholder — that means the view is being opened outside Crystallize.

### 2. App-signal handshake

Install `@crystallize/app-signal` and send `ready` on mount. Without this, Crystallize treats the iframe as not loaded and may not deliver subsequent signals.

```tsx
// components/SignalReady.tsx
'use client';
import { signal } from '@crystallize/app-signal';
import { useEffect } from 'react';

export function SignalReady() {
  useEffect(() => {
    signal.send('ready');
  }, []);
  return null;
}
```

Mount `<SignalReady />` once in your root layout.

After every successful write, refresh the editor:

```ts
await signal.send('refetchItemComponents', { itemId, itemLanguage: language });
// Or `refetchItem` / `refetchItemVariantComponents` depending on scope
```

Debounce refresh calls (~600 ms) when applying several updates in sequence so the editor doesn't flicker.

### 3. Run local dev (and optionally share it via ngrok)

For your own machine, `http://localhost:<port>` works as the custom-view URL — Crystallize will happily load it into the iframe while you iterate. No tunnel or local CA gymnastics required.

```bash
pnpm dev  # Next.js on :3000 (or whatever port)
```

Register the custom view with `http://localhost:3000/?itemId={{itemId}}&…` (see step 5) and you can develop end-to-end without any public URL.

**When you do need ngrok:** anyone other than you (teammates, reviewers, QA on another machine) can't reach your `localhost`. To let them open the running app inside *their* Crystallize UI, expose it with [ngrok](https://ngrok.com):

```bash
# One-time: install and auth
brew install ngrok
ngrok config add-authtoken <your-token>

# Tunnel the dev server
ngrok http 3000
```

ngrok prints something like `https://curly-otter-42.ngrok-free.app` — register that as a second custom view URL for shared testing. It changes on every restart unless you reserve a static domain:

```bash
# Free tier: one reserved static domain
ngrok http --url=my-view.ngrok-free.app 3000
```

A static domain is strongly recommended so shared testers don't need the URL updated in Crystallize every time you restart. For production the public URL comes from wherever you deploy the Next.js app, not ngrok.

### 4. CORS + Private Network Access from Next.js

The parent origin (`https://app.crystallize.com`) talks to the iframe cross-origin and — for `localhost` iframes — triggers the browser's Private Network Access check. Next.js has to set the response headers itself, both in local dev and behind any tunnel. In `next.config.mjs`:

```js
const nextConfig = {
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'Access-Control-Allow-Origin', value: 'https://app.crystallize.com' },
        { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
        { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        { key: 'Access-Control-Allow-Credentials', value: 'true' },
        { key: 'Access-Control-Allow-Private-Network', value: 'true' },
      ],
    }];
  },
};
export default nextConfig;
```

Also skip ngrok's browser warning page (only relevant when you're tunnelling via ngrok) so the iframe doesn't stall on first load — either upgrade plans or set the header on every fetch from the client:

```ts
fetch(url, { headers: { 'ngrok-skip-browser-warning': 'true' } });
```

### 5. Register the custom view in Crystallize

In the Crystallize UI: **Settings → Apps → Custom views → New**.

- **URL template**: during local dev, use `http://localhost:3000/?itemId={{itemId}}&language={{language}}&variantId={{variantId}}`; for shared or deployed instances, substitute the ngrok or production host from step 3
- **Location**: *Item editor — side panel* (or another placement if the view is for a different surface)
- **Scope**: global, shape-scoped, or language-scoped depending on intent

Open any item whose shape matches the scope — the view appears in the right panel.

### 6. Minimal file layout

```
app/
  layout.tsx       # renders <SignalReady /> once
  page.tsx         # reads searchParams → passes itemId/language/variantId down
  api/
    item/route.ts  # server-side PIM fetch (hide tokens here)
    update/route.ts
components/
  SignalReady.tsx
  View.tsx         # your actual UI
lib/
  crystallize.ts   # @crystallize/js-api-client wrapper
.env.example
next.config.mjs
```

Keep tokens server-side. Never expose `CRYSTALLIZE_ACCESS_TOKEN_SECRET` to the browser; call `/api/item` and `/api/update` from the client instead of hitting Crystallize directly.

### 7. Reading and writing

Use `@crystallize/js-api-client` for both read and write. For item + shape + components:

```ts
import { createClient } from '@crystallize/js-api-client';

const client = createClient({
  tenantIdentifier: process.env.CRYSTALLIZE_TENANT_IDENTIFIER!,
  accessTokenId: process.env.CRYSTALLIZE_ACCESS_TOKEN_ID!,
  accessTokenSecret: process.env.CRYSTALLIZE_ACCESS_TOKEN_SECRET!,
});

const { item } = await client.pimApi(/* GraphQL */`
  query GetItem($itemId: ID!, $language: String!) {
    item(id: $itemId, language: $language) {
      id name type
      shape { identifier name components { id name type } }
      components {
        componentId type
        content {
          ... on SingleLineContent { text }
          ... on RichTextContent { plainText json }
          # ...add the content types you care about
        }
      }
    }
  }
`, { itemId, language });
```

Mutations return union types — **always** include fragments for both success and error:

```graphql
mutation Update($itemId: ID!, $language: String!, $input: ComponentInput!) {
  item {
    updateComponent(itemId: $itemId, language: $language, input: $input) {
      ... on Item { id }
      ... on BasicError { message }
    }
  }
}
```

Rich text writes **must** use the JSON AST (`kind: "block" | "inline"`), never HTML.

## Environment variables

Minimum `.env.example` for a side-by-side view:

```env
CRYSTALLIZE_TENANT_IDENTIFIER=your-tenant
CRYSTALLIZE_ACCESS_TOKEN_ID=your-token-id
CRYSTALLIZE_ACCESS_TOKEN_SECRET=your-token-secret
NEXT_PUBLIC_APP_URL=http://localhost:3000  # or https://my-view.ngrok-free.app / your deployed URL
```

## Common pitfalls

- **Iframe stays blank in Crystallize.** The app didn't send `signal('ready')`, the dev server isn't running, or (if you're tunnelling) the ngrok tunnel is down. Open the custom-view URL directly in a browser and confirm it loads.
- **ngrok warning page appears in the iframe.** Only relevant when sharing via ngrok: free-tier ngrok injects an interstitial. Send the `ngrok-skip-browser-warning: true` header on every fetch, or use a paid plan that disables it.
- **ngrok URL changed after restart.** Use a reserved static domain (`ngrok http --url=…`) so the shared custom view URL in Crystallize stays stable.
- **CORS error on `/api/*`.** The Next.js route returned its own `Access-Control-Allow-Origin: *` that conflicts with the credentialed request from Crystallize. Let `next.config.mjs` own the headers.
- **`refetchItemComponents` does nothing.** The signal is being sent before Crystallize finished registering the iframe, or `itemLanguage` is undefined. Send `ready` first, then any refetch.
- **Custom view registered but never appears.** Scope mismatch (e.g. registered only for a shape the current item doesn't use), or the URL template is missing `{{itemId}}`.
- **"Mixed content" warning.** The view imports an http:// asset. Everything must be https.
- **Tokens leak to the browser.** Use route handlers under `app/api/` for anything that touches the Core API. Client components should only call your own API routes.

## Reference

- `@crystallize/app-signal`: https://www.npmjs.com/package/@crystallize/app-signal
- `@crystallize/js-api-client`: https://www.npmjs.com/package/@crystallize/js-api-client
- Crystallize custom views docs: https://crystallize.com/learn/developer-guides/custom-views
- ngrok static domains: https://ngrok.com/docs/network-edge/domains-and-tcp-addresses/
- Example: https://github.com/CrystallizeAPI/translation-app
