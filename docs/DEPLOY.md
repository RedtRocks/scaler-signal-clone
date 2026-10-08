# Deploying the demo

Frontend on **Vercel**. Backend on **Railway** (or Fly.io) with a **persistent volume** at `/data` for the SQLite file and uploads.

The backend image (`backend/Dockerfile`) keeps the database at `/data/signal.db` and files at `/data/media`, listens on `$PORT`, and seeds the demo data on its first start (when `/data/signal.db` does not exist yet). Set `SEED_ON_START=1` only if you want a reset to the demo data on every start.

## 1. Backend on Railway
1. In Railway: **New Project > Deploy from GitHub repo**, pick `scaler-signal-clone`.
2. Service **Settings**: set **Root Directory** to `backend`. Railway builds `backend/Dockerfile` (it always uses a Dockerfile when it finds one). No config file is needed: Railway no longer lets new services use `railway.json`.
3. Service **Variables**: add `PORT` = `8000`.
4. Right-click the canvas > **Volume**, attach it to the service with mount path **`/data`**.
5. Optional: **Settings > Deploy > Healthcheck Path** = `/docs`.
6. **Settings > Networking > Generate Domain**, target port `8000`. Note the URL, e.g. `https://signal-clone-api.up.railway.app`. `/docs` on it shows the API.

## 1 (alternative). Backend on Fly.io
From `backend/`, with the `fly` CLI logged in. First change `app` in `backend/fly.toml` to a unique name (region is `sin`, Singapore; Fly has no India region):
```bash
fly apps create <app-name>
fly volumes create signal_data --size 1 --region sin -a <app-name>
fly deploy
```
The URL is `https://<app-name>.fly.dev`.

## 2. Frontend on Vercel
1. **Add New > Project**, import this repository, set **Root Directory** to `frontend`.
2. Add the environment variable `NEXT_PUBLIC_API_URL` = the backend URL (no trailing slash). The WebSocket URL is derived from it (`https` becomes `wss`).
3. Deploy, and note the Vercel URL.

## 3. Connect them
Set `ALLOWED_ORIGINS` on the backend to the Vercel URL (Railway: service **Variables**; Fly: `fly secrets set ALLOWED_ORIGINS=https://…vercel.app`), and let it redeploy. Open the Vercel URL and sign in with `+15550000001`, OTP `123456`.

`docker compose up --build` runs both services on one machine instead.
