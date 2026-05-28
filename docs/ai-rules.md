# AI Rules For Vertax

These rules are for Codex, Claude Code, and any AI agent editing this repository.

## Prime Directive

Do not break the working app on `/`.

The main Vertax app must stay on `/`. Do not move it to `/app`. Do not replace it with the landing page.

## Required First Steps

Before editing:

1. Read `README.md`.
2. Read `docs/product.md`.
3. Read `docs/architecture.md`.
4. Inspect the exact files you plan to change.
5. Search for wrappers/patches that may override the same function or handler.

Useful searches:

```bash
rg -n "handlers\\['ACTION'\\]|on\\('ACTION'|data-action=\"ACTION\"" js
rg -n "function viewSet|window.viewSet|viewSet =" js
rg -n "window.laisoBuck.render|function render\\(" js
rg -n "state.view|runt26-source|live-set|backup" js
```

## Architecture Reality

This is not a clean module-based SPA. It is a vanilla JS app with:

- global state;
- global functions;
- delegated `data-action` handlers;
- HTML-string rendering;
- a long `handlers.js` with incremental patch installers;
- render wrappers that depend on order.

Do not assume there is only one implementation of a feature.

## Editing Rules

- Keep changes small and local.
- Prefer existing patterns over new architecture.
- Do not introduce React, Vue, Vite, Next, or a heavy framework.
- Do not rewrite the app around modules unless explicitly asked.
- Do not delete user data stores.
- Do not rename IndexedDB stores.
- Do not remove fallback code without verifying the old scenario is dead.
- Do not hand-edit files in `public/`; edit source and run `npm run build`.
- Do not put secrets in client JS, HTML, `dist/`, or docs.

## Build Files

Source files:

- `js/*.js`
- `css/*.css`
- `index.html`
- `about/index.html`
- `vk/index.html`
- `sw.js`
- `api/**/*.js`
- `lib/*.js`
- `scripts/*.js`

Generated/deploy output:

- `dist/app.js`
- `dist/app.css`
- `dist/build-report.json`
- `public/`

If you change client JS or CSS, run:

```bash
npm run build
```

## IndexedDB Rules

Current database:

- `laiso-buck-db`
- version `2`

Stores:

- `vinyls`
- `sets`
- `settings`
- `bpm_cache`

Rules:

- Never clear user data automatically.
- Never change key paths without migration.
- Backup/restore must stay compatible.
- Manual user metadata must not be overwritten by low-confidence API data.

## Serverless Function Limit

The project targets Vercel Hobby unless stated otherwise. Hobby deployments allow no more than 12 Serverless Functions.

Before adding an `api/*.js` or `api/**/.js` file:

```bash
find api -type f -name '*.js' | wc -l
```

If the count would exceed 12, consolidate endpoints or remove an unused diagnostic function with explicit approval/context.

## Secrets

Never expose these in frontend code:

- `DISCOGS_TOKEN`
- `DISCOGS_PERSONAL_ACCESS_TOKEN`
- `GETSONGBPM_KEY`
- `KV_REST_API_TOKEN`
- `BEATPORT_USERNAME`
- `BEATPORT_PASSWORD`
- `TELEGRAM_BOT_TOKEN`
- `ADMIN_TOKEN`
- `EXPORT_TOKEN`
- `VK_APP_SECRET`

Client requests should use relative API routes like `/api/bpm` where possible.

## CSP And HTML Safety

The app uses HTML strings and `innerHTML`. Always escape dynamic user/API values with `esc()` or an equivalent safe function.

Current CSP still allows some inline script/style behavior for compatibility. Do not tighten CSP aggressively unless you also remove or nonce all inline dependencies.

When adding external domains, update CSP deliberately and document why.

## WebView Rules

Telegram, VK, and MAX WebViews can behave differently from normal browsers.

Do not use:

- `window.prompt`
- `window.confirm`
- blocking external scripts in `<head>`
- UI flows that depend only on browser chrome back behavior

Use:

- in-app modal state;
- delegated handlers;
- `syncTelegramChrome`;
- graceful fallbacks when SDKs are absent.

## Navigation Rules

Back behavior is sensitive.

Before changing navigation, inspect:

- `handlers.back`
- `telegramBack`
- `syncTelegramChrome`
- `runt26-source` handlers
- `live-set` handlers
- backup handler wrapper

The in-app back button must remain visible when host BackButton is unavailable.

## i18n Rules

The app i18n layer is an overlay in `js/app-i18n.js`. It translates rendered Russian text after render.

Rules:

- Keep RU source text working.
- When adding user-facing text, add translations where practical.
- Do not translate user-entered artist/title/notes metadata.
- If a screen is rendered by a custom wrapper, ensure translation hooks still run.
- Prefer stable `data-action` and `data-testid` over visible text in tests.

## Metadata Rules

Metadata sources are imperfect. Preserve user control.

- Manual BPM/Key wins over uncertain automatic data.
- Cache lookups should support old normalized artist/title keys.
- Prefer Discogs release ID plus track position when available.
- Respect rate limits; do not add uncontrolled `Promise.all` against Discogs.
- Partial failures should not kill the whole flow.
- Compatibility score must be calculated by math, not by AI.
- AI/DJ verdicts, when present, may explain the result but must not decide compatibility.

## Redis TTL Rules

Temporary compatibility keys may expire:

- `collection_index:{user_id}:{collection_hash}` gets a sliding 30-day TTL.
- future `ai_verdict:{release_id}:{collection_hash}` may also use a 30-day TTL.

Shared metadata keys must not receive that TTL:

- `vertax:beatport:track:*`
- Discogs/Beatport enriched track records
- shared BPM/Camelot metadata

Existing miss-cache TTLs, such as `vertax:beatport:miss:*`, should keep their current behavior.

## Service Worker Rules

`sw.js` caches the app shell and cover images.

Rules:

- Version cache names when changing cache behavior.
- Do not cache private API responses.
- Do not cache OAuth/token-sensitive endpoints.
- Keep `/api/*` network-driven unless there is a very explicit offline design.

## Testing Rules

Run at least:

```bash
npm run build
npm test
```

For CSS/tooling changes:

```bash
npm run css:audit
```

For formatting:

```bash
npm run lint
```

Smoke tests should use `data-testid`, not Russian visible text.

## Documentation Rules

Update docs when changing:

- routes;
- API endpoints;
- environment variables;
- IndexedDB schema;
- build pipeline;
- service worker strategy;
- major product flows;
- AI/editing constraints.

Keep README short. Put deeper documentation in `/docs`.
