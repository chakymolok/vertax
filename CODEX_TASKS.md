# VERTAX — Tasks for Claude Code

Project: `/Users/1994lab/Documents/GitHub/vertax`
Stack: vanilla JS SPA, esbuild bundle, Vercel serverless (Node), IndexedDB, Telegram/VK Mini App.

Build: `npm run build` → `dist/app.js` + `dist/app.css` → copied to `public/` by `build-public.js`.
Deploy: Vercel, `public/` as static output, `api/` as serverless functions.

---

## Task 1 — Move GetSongBPM key server-side  *(security, high priority)*

`GETSONGBPM_KEY = '492c969f57d91b911355adc4b70bba8e'` is hardcoded in `js/state.js` and
compiled verbatim into `dist/app.js`.  The key is now set in Vercel Environment Variables
as `GETSONGBPM_KEY`.  Create a server-side proxy so the key never reaches the client.

### What to do

**1. Create `api/bpm.js`** — Vercel serverless function that proxies GetSongBPM.

Pattern to follow: look at the existing `api/discogs.js` — it reads a token from
`process.env`, sets CORS headers, and forwards the request.

The current client call (in `js/api.js`, look for `GETSONGBPM_BASE` usage) builds:
```
https://api.getsong.co/search/?api_key=<KEY>&type=both&lookup=<LOOKUP>
```
The proxy should:
- Accept `GET /api/bpm?lookup=<LOOKUP>`
- Read `process.env.GETSONGBPM_KEY`
- Forward to `https://api.getsong.co/search/?api_key=<KEY>&type=both&lookup=<LOOKUP>`
- Return the JSON response as-is
- Set the same CORS headers as `api/discogs.js`
- Return 503 if the env var is missing (so CI / local dev fails loudly)

**2. Update `js/api.js`** — in the `fetchFromGetSongBPM` function, replace the direct
`https://api.getsong.co` call with `/api/bpm?lookup=<LOOKUP>`.  Remove the
`GETSONGBPM_KEY` and `GETSONGBPM_BASE` references from this function.

**3. Clean up `js/state.js`** — delete the two lines:
```js
var GETSONGBPM_KEY = '492c969f57d91b911355adc4b70bba8e';
var GETSONGBPM_BASE = 'https://api.getsong.co';
```
Make sure nothing else in the codebase references these variables (`grep -r GETSONGBPM_KEY js/`).

**4. Update CSP in `index.html`** — remove `https://api.getsong.co` from `connect-src`
(requests now go to `/api/bpm` on the same origin).

After the change: `npm run build` must succeed and `npm run smoke` must pass.

---

## Task 2 — Replace `window.prompt` / `window.confirm` with modals  *(UX broken in Telegram/VK)*

`window.prompt()` and `window.confirm()` are silently blocked in Telegram Mini App and
VK WebView.  There are **24 calls** in `js/handlers.js`.  All must be replaced with the
app's own modal system.

### How the modal system works

State shape: `state.modal = { type: 'confirm', message, onConfirm, onCancel }` or
`{ type: 'prompt', message, defaultValue, fieldLabel, onConfirm, onCancel }`.
`render.js` renders modals from `state.modal` via `renderModal()`.
Closing: set `state.modal = null` then call `render()`.

Look at existing modal code in `render.js` (`renderModal`) and existing `state.modal`
usages in `handlers.js` to understand the exact shape currently in use — follow those
patterns exactly.

### Replacements needed

Replace every `window.confirm(…)` with a modal that shows the message with Confirm/Cancel
buttons, and executes the original `if (!window.confirm(…)) return;` guard logic.

Replace every `window.prompt(…)` with a modal that shows a labelled `<input>` pre-filled
with the default value, and calls the original continuation code on submit.

**All 24 occurrences must be replaced.**  Run `grep -n "window\.prompt\|window\.confirm"
js/handlers.js` before and after to verify the count reaches 0.

After the change: `npm run build` must succeed and `npm run smoke` must pass.

---

## Task 3 — Stop copying raw CSS source into `public/`  *(build hygiene)*

`scripts/build-public.js` copies the entire `css/` source directory to `public/css/`.
`index.html` loads only `dist/app.css` (the compiled bundle), so `public/css/` is dead
weight (~168 KB extra).

**Fix:** in `scripts/build-public.js`, remove `'css'` from the `entries` array.

Verify: after `npm run build`, confirm `public/css/` does not exist.
Verify: `public/dist/app.css` still exists and `index.html` loads it.

---

## Task 4 — Add `vercel.json`  *(deployment safety)*

Without `vercel.json`, Vercel auto-detects `public/` as output.  This is fragile.

Create `vercel.json` in the project root:

```json
{
  "outputDirectory": "public",
  "buildCommand": "npm run build",
  "installCommand": "npm ci"
}
```

No other changes needed.

---

## Task 5 — Fix CSS audit false positives  *(tooling)*

`scripts/css-audit.js` uses `/\.([a-zA-Z0-9_-]+)/g` to extract class names from CSS.
This regex also matches decimal values like `.18em`, `.08s`, `.35s`, causing 34 false
"unused" reports where every single "selector" is actually a number.

**Fix:** add one filter line in `css-audit.js`, inside the `maybeUnused` filter, before
the safelist check:

```js
if (/^\d/.test(name)) return false;  // skip decimal CSS values like .18em
```

Verify: `npm run css:audit` should now report 0 or only genuine class names — no more
numeric strings.

---

## Task 6 — Move `rebuild.example.sh` to `scripts/`  *(housekeeping)*

`rebuild.example.sh` is an admin utility for triggering a Vercel API rebuild batch.
It does not belong in the project root alongside `index.html`.

Move it: `git mv rebuild.example.sh scripts/rebuild.example.sh`.

Update `.gitignore`: the existing rule `rebuild.sh` (no path prefix) will still match
`scripts/rebuild.sh` if someone copies it, so no change needed there.

---

## Verification checklist

After all tasks:

```bash
npm run build        # must succeed, 0 errors
npm run smoke        # must pass
grep -r "GETSONGBPM_KEY" js/   # must return empty
grep -n "window\.prompt\|window\.confirm" js/handlers.js  # must return empty
ls public/css 2>/dev/null && echo "EXISTS — BAD" || echo "OK"  # must print OK
cat vercel.json      # must exist
npm run css:audit    # must report no numeric tokens
```
