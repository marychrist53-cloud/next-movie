# Next Movie

A Next.js movie and TV discovery app powered by TMDB. It includes search,
discover filters, detail pages, watchlists, favorites, ratings, comments,
release notifications, profiles, and administration.

## Local setup

Requirements: Node.js 20+, a TMDB API Read Access Token, and optionally a
Google AI Studio API key for Gemini chat.

```bash
npm install
cp .env.example .env
npm run dev
```

Fill in `.env` before starting, then open <http://localhost:3000>.

## Environment variables

- `TMDB_TOKEN` — required TMDB API Read Access Token.
- `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` — server-only OpenAI-compatible
  chat settings. If `AI_API_KEY` is set, the movie chatbot uses this model.
- `GEMINI_API_KEY` — server-only Google AI Studio key used when `AI_API_KEY`
  is absent. If the model is unavailable, chat falls back to the local TMDB
  assistant.
- `GEMINI_MODEL` — optional model ID; defaults to `gemini-3.8-flash`.
- `GEMINI_MODEL_FALLBACK` — defaults to `gemini-3.5-flash` and is retried when
  the requested Gemini model is unavailable, inaccessible, or out of quota.
- `NEXT_PUBLIC_SITE_URL` — canonical URL used by metadata and the sitemap.
- `TRUST_PROXY_HEADERS` — set to `1` only when the deployment proxy overwrites
  `X-Forwarded-For`/`X-Real-IP`; otherwise rate limits use a shared safe key.
- `CRON_SECRET` — required bearer token for the notification cron endpoint.
- `OWNER_EMAIL`, `OWNER_PASSWORD`, `OWNER_NAME` — explicitly provision the sole
  owner account. Public registration always creates regular users.
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` — required for web
  push. Generate the key pair with `npx web-push generate-vapid-keys`.
- `DATABASE_PATH` — SQLite file location. Defaults to `./data/nextmovie.db`.

Never commit `.env`.

Place chat keys only in `.env`. Do not use a `NEXT_PUBLIC_` prefix: the browser
calls `/api/chat`, and only the server talks to the model. The model can discuss
any film from its knowledge; posters are attached only after official titles
are resolved in TMDB. Failed, timed-out, or quota-limited requests use the
local assistant.

## Owner provisioning

Set the owner variables and restart the application. Startup creates the owner
if absent, or promotes and unbans the configured account. Any other owner is
demoted to admin. When `OWNER_PASSWORD` is set, it becomes the configured
owner's login password. A pre-existing non-owner account is never promoted
unless `OWNER_PASSWORD` is configured, preventing an earlier registrant from
claiming the reserved address.

## Notification cron

Call the endpoint with the secret as a bearer token:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "$NEXT_PUBLIC_SITE_URL/api/cron/notifications"
```

The route fails closed when `CRON_SECRET` is absent.

## Development seed migration

Run the idempotent seed migration to add 20 regular test accounts and 40
comments:

```bash
npm run db:seed
```

The accounts range from `testuser01@example.test` through
`testuser20@example.test`. Their default local password is `TestUser123!`;
override it with `SEED_TEST_PASSWORD` before the first run. The migration is
recorded in `schema_migrations`, so rerunning does not duplicate data.

The command refuses to run when `NODE_ENV=production` unless
`ALLOW_TEST_SEED=1` is explicitly set.

## Deployment

SQLite requires one shared, persistent filesystem. Set `DATABASE_PATH` to a
mounted persistent volume and avoid horizontally scaled instances that each
have separate local disks. For multi-instance or serverless deployment, migrate
the persistence layer to a shared database and distributed rate limiter.

## Checks

```bash
npm run lint
npm test
npx tsc --noEmit
npm run build
```

TMDB supplies catalog data and images. This product uses the TMDB API but is
not endorsed or certified by TMDB.
