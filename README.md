# Vertax

Vertax is a web tool for vinyl DJs: Discogs release lookup, record collection management, BPM/Key lookup, Camelot-aware set building, and backup/export flows. The main app is a static vanilla JS application with a small Vercel `api/` layer for Discogs, Beatport, cache, and admin workflows.

Production: https://vertax.live

## Local Development

```bash
npm install
npm run build
npm run dev
```

Then open http://localhost:4177.

Useful commands:

```bash
npm run smoke
npm test
npm run css:audit
npm run format
npm run lint
```

## Deployment

The project is deployed as a static site plus Vercel Serverless Functions.

- Static output directory: `public`
- Build command: `npm run build`
- Main app route: `/`
- SEO landing page: `/about`
- VK placeholder route: `/vk`

The build creates minified assets in `dist/` and copies deployable static files into `public/`.

## Environment Variables

Required for `api/discogs.js`:

- `DISCOGS_TOKEN` or `DISCOGS_PERSONAL_ACCESS_TOKEN`

Required for `api/bpm.js`:

- `GETSONGBPM_KEY`

Used by Redis-backed cache and proposal/admin flows:

- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

Used by Beatport lookup:

- `BEATPORT_USERNAME`
- `BEATPORT_PASSWORD`

Used by Telegram auth, webhook, and admin notifications:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_ADMIN_CHAT_ID`
- `TELEGRAM_ADMIN_USER_ID`
- `TELEGRAM_WEBHOOK_SECRET`

Used by protected admin/export endpoints:

- `ADMIN_TOKEN`
- `EXPORT_TOKEN`

Not currently used by the codebase:

- `KV_REST_API_READ_ONLY_TOKEN`
- `KV_URL`
- `REDIS_URL`
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`

## License

ISC
