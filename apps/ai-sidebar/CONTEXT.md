# Context — Crystallize AI Sidebar

Reference material for working on this codebase. Keep this current when the shape of the data layer, prompt, or Crystallize integration changes. See [PROJECT.md](PROJECT.md) for high-level intent and [README.md](README.md) for user-facing setup.

---

## Crystallize integration points

### URL parameters

The custom view is loaded by Crystallize with template placeholders:

```
https://<app>/?itemId={{itemId}}&language={{language}}&variantId={{variantId}}
```

| Param | Meaning |
|---|---|
| `itemId` | Item being edited |
| `language` | Current editor language |
| `variantId` | Present only when a product variant is being edited |

### `@crystallize/app-signal`

Used to talk to the parent Crystallize window.

```ts
import { signal } from '@crystallize/app-signal';

// Required: tell Crystallize the iframe is live
document.addEventListener('DOMContentLoaded', () => signal.send('ready'));

// After writing to the Core API, refresh the editor's view
await signal.send('refetchItemComponents', { itemId, itemLanguage });
```

Debounce refresh signals (~600 ms) when applying several updates in a row to avoid editor flicker.

### HTTPS, CORS, and Private Network Access

Crystallize refuses to embed insecure origins and the browser enforces Private Network Access when the parent origin (`https://app.crystallize.com`) talks to the iframe. Next.js owns all required response headers — see `next.config.mjs`:

- `Access-Control-Allow-Origin: https://app.crystallize.com`
- `Access-Control-Allow-Credentials: true`
- `Access-Control-Allow-Private-Network: true`
- `Access-Control-Allow-Methods` / `-Headers`

In development the view is served from `http://localhost:4000` — Crystallize loads it straight into the iframe on your own machine. Use ngrok only when another person needs to open your running dev server in their Crystallize UI (see [README.md](README.md)). In production the origin comes from whatever platform runs the Next.js app.

---

## Crystallize APIs

Auth headers:

```
X-Crystallize-Access-Token-Id: <id>
X-Crystallize-Access-Token-Secret: <secret>
X-Crystallize-Tenant-Identifier: <tenant>
```

### Fetching an item with nested pieces and chunks

See `lib/crystallize.ts#getItem`. Key fragments include `SingleLineContent`, `RichTextContent`, `NumericContent`, `BooleanContent`, `ImageContent`, `ParagraphCollectionContent`, plus `PieceContent` and `ContentChunkContent` for nested structures.

### Updating a component

Rich text writes **must** use the JSON AST (`kind: "block" | "inline"`), never HTML. For nested paths, `lib/crystallize.ts#updateItemComponent` re-fetches the parent piece or chunk and rebuilds the entire `PieceContentInput` / `ContentChunkContentInput` before sending the mutation.

---

## Addressing scheme

| Path example | Meaning |
|---|---|
| `title` | Top-level component |
| `meta.title` | Child `title` inside piece `meta` |
| `specs[0].width` | Child `width` in the first row of chunk `specs` |

Produced by `flattenEditableComponents` in `lib/utils.ts`.

---

## AI contract

`POST /api/ai/generate` request:

```ts
{
  itemId: string;
  language: string;
  prompt: string;
  targetPaths?: string[];
  currentItem: ItemWithShape;
}
```

Response:

```ts
{
  updates: Array<{ path: string; type: ComponentType; content: ComponentContent }>;
  explanation: string;
}
```

The system prompt in `lib/ai.ts` enforces the JSON format, the path contract, and the component-aware length rules described in [PROJECT.md](PROJECT.md).

---

## Local dev recap

1. `pnpm install`
2. `cp .env.example .env` and fill in tokens
3. `pnpm dev` — Next.js on `:4000`
4. Register the custom view in Crystallize with `http://localhost:4000/?itemId={{itemId}}&language={{language}}&variantId={{variantId}}`
5. *(Optional, only to let others test the app in Crystallize)* `ngrok http 4000` with a reserved `--url=…` static domain, and register a second custom view with the ngrok URL

---

## Common pitfalls

- **Iframe stays blank.** `signal('ready')` was never sent, the dev server isn't running, or — when sharing via ngrok — the tunnel is down. Open the custom-view URL directly in a browser.
- **ngrok warning page in iframe.** Only relevant when tunnelling via ngrok. Send `ngrok-skip-browser-warning: true` on every request, or use a paid plan.
- **Rich text failed to update.** The AI returned HTML. System prompt forbids this; also validate in `lib/ai.ts` before forwarding to the Core API.
- **Meta title equals page title.** Regenerate; the prompt disallows this but the model can still slip. The preview panel surfaces the mismatch.
- **Nested component not visible.** Check that the shape fragment returns `PieceContent` / `ContentChunkContent`.
- **Signal not received.** Iframe must be HTTPS and the Crystallize origin must be allowed by CORS (`next.config.mjs`).
- **Unauthorized.** PIM access token lacks the scopes needed for writes. Create a new token with `Item` read/write.
