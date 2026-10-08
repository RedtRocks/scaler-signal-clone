# Running the project

Checked from a clean checkout: a fresh virtualenv installed from `backend/requirements.txt`, `python -m app.seed`, and `uvicorn app.main:app` all start with no extra setup. The media directory is created on demand.

## Prerequisites

- Python 3.13 (the backend was developed and tested on 3.13)
- Node 22 and npm

## Backend

```bash
cd backend
python3.13 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m app.seed                          # creates signal.db with demo data
.venv/bin/uvicorn app.main:app --reload --port 8000   # http://localhost:8000/docs
```

- `python -m app.seed` drops and recreates every table, so it also signs everyone out. Run it again whenever you want a fresh demo.
- The tables are also created on startup, so the server runs without seeding (you then register users through the OTP flow).
- Uploaded avatars go to `MEDIA_DIR` (default `backend/media`) and are served at `/media/...`.
- CORS: the browser origin must appear in `ALLOWED_ORIGINS`. Several origins are comma-separated, e.g. `ALLOWED_ORIGINS=http://localhost:3000,https://signal.example.com`.

## Frontend

```bash
cd frontend
npm ci
npm run dev            # http://localhost:3000
# production build:
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run build && npm start
```

`NEXT_PUBLIC_API_URL` is inlined when Next builds, so set it before `npm run dev` / `npm run build`. The WebSocket URL is derived from it (`http` becomes `ws`, `https` becomes `wss`).

## Both at once

```bash
scripts/dev.sh
```

Seeds the database, starts uvicorn on 8000 and `next dev` on 3000, and stops both on Ctrl+C. Set `PYTHON=/path/to/python` if the backend venv is elsewhere than `backend/.venv`.

## Docker

```bash
docker compose up --build        # frontend :3000, backend :8000
```

- The backend container keeps its SQLite file and uploads in the `signal-data` volume. `SEED_ON_START=1` (the default in `docker-compose.yml`) resets the demo data on every start; set it to `0` to keep data between restarts.
- `NEXT_PUBLIC_API_URL` is a **build** argument of the frontend image and must be the URL the *browser* uses to reach the backend. `ALLOWED_ORIGINS` must contain the URL of the frontend. For a deployment behind a domain, put both in a `.env` file next to `docker-compose.yml` (see `.env.example`) and rebuild.
- These Dockerfiles were written but not built in the authoring environment (no Docker daemon was available); the commands inside them are the same ones used above.

## Demo accounts

`+15550000001` to `+15550000008`, OTP `123456`. `+15550000001` is Aarav Dudeja, the richest account. To see messages arrive live, sign in as `+15550000001` in one browser profile and `+15550000002` in another (or a private window).

## Tests

```bash
cd backend && .venv/bin/pytest -q
cd frontend && npx tsc --noEmit && npx eslint src && npx vitest run && npx next build
```

### End-to-end smoke test

`e2e/smoke.mjs` drives two browser contexts: user A signs in with the OTP, opens a conversation and sends a message; user B (a second context) sees it arrive without reloading.

```bash
# with the backend (seeded) and frontend running:
cd e2e && npm install && npm run smoke
# other ports / users:
WEB_URL=http://localhost:3103 API_URL=http://localhost:8103 npm run smoke
```

It needs a Chromium that Playwright can find (`npx playwright install chromium`, or set `PLAYWRIGHT_BROWSERS_PATH`). It reseeds nothing, so run `python -m app.seed` first if earlier runs changed the data.

## Troubleshooting

- **Requests fail with a CORS error**: the page's origin is missing from `ALLOWED_ORIGINS` (the origin includes the port).
- **"Can't reach the server"**: `NEXT_PUBLIC_API_URL` is wrong, or it was changed after the build. Restart `next dev` or rebuild.
- **Signed out after re-seeding**: expected; the seed resets the sessions table.
