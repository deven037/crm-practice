# Practice CRM API

A real REST API for the Practice CRM app, built for API-automation practice
(Postman, RestAssured, pytest, curl, etc.). It's the CRM's single source of
truth — records created here show up in the CRM UI on the next navigation or
reload of the relevant page.

## Running locally

```bash
npm install
npm run dev
```

Starts on `http://localhost:4000`. The frontend's `vite.config.ts` proxies
`/api/*` to this port in dev, so no CORS setup is needed locally.

- `GET /api/health` — liveness check.
- `GET /api/docs` — interactive Swagger UI.
- `GET /api/openapi.json` — the raw OpenAPI 3 spec (importable into Postman/Insomnia).

## Login

Seed users (password `Pass@123` for all): `admin@crm.com`, `rep@crm.com`,
`viewer@crm.com`, `sam@crm.com`, `priya@crm.com` (deactivated).

## Resetting data

`POST /api/reset` deterministically reseeds every collection back to the same
fixed seed state — no auth required, since it only restores publicly-documented
data and a test suite needs to be able to call it as its very first step,
before it has a token.

## Design decisions worth knowing

- **In-memory store, no database.** Data lives in memory and is re-seeded on
  every server boot. This is deliberate, not a shortcut: see the free-tier
  note below.
- **Plaintext passwords.** This is a training tool with no real user data —
  the seed credentials are intentionally published for testers to use. Hashing
  would add a dependency and friction (testers couldn't just read the seed and
  reuse a password) for no realistic security benefit here.
- **Simulated latency** (300-1200ms on reads, 150-400ms on writes) mirrors the
  original client-only app's behavior, so timing-dependent UI exercises keep
  working the same way now that the API is the real data layer. Set
  `DISABLE_LATENCY=true` to turn this off for fast local iteration.

## Deploying (Render, free tier)

`render.yaml` is a Blueprint — point Render at this repo with `rootDir: server`
and it builds/starts itself. Set `CORS_ORIGIN` to your deployed frontend's URL.

**Free-tier trade-off**: Render's free Web Service has no persistent disk and
sleeps after ~15 minutes of inactivity. The next request cold-starts the
process, which re-seeds from scratch — so any data created via the API since
the last restart resets along with it. This is *embraced*, not fought: the
whole design (in-memory store + deterministic reseed) assumes this. It's the
same idea as the app's own `?reset=true`/`POST /api/reset` philosophy, just
happening automatically on a cold start instead of on demand.

**Future upgrade path** (not built, deliberately out of scope for now): swap
the in-memory arrays inside `src/db.ts`'s `Collection<T>` for a real query
against a free hosted Postgres (e.g. Neon, Supabase). Every route file only
calls `list/get/create/update/remove` on a `Collection`, so this is a
contained change — no route or OpenAPI-spec changes needed.
