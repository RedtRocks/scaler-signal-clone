# Deploying the demo

The backend (FastAPI, SQLite, WebSockets) runs on Render from `render.yaml`; the frontend (Next.js) runs on Vercel. Both have free plans.

## 1. Backend on Render
1. In Render, choose **New > Blueprint** and pick this repository. Render reads `render.yaml` and builds `backend/Dockerfile`.
2. Leave `ALLOWED_ORIGINS` empty for now; it is filled in step 3.
3. When the service is live, note its URL, for example `https://signal-clone-api.onrender.com`. Opening `/docs` there shows the API.

The free plan has no persistent disk, so `SEED_ON_START=1` resets to the demo data whenever the service restarts or wakes from sleep (the first request after 15 idle minutes takes about a minute). For data that survives restarts, use a paid plan with a disk mounted at `/data` and set `SEED_ON_START=0` after the first start.

## 2. Frontend on Vercel
1. **Add New > Project**, import this repository, and set **Root Directory** to `frontend`.
2. Add the environment variable `NEXT_PUBLIC_API_URL` = the Render URL (no trailing slash). The WebSocket URL is derived from it (`https` becomes `wss`).
3. Deploy, and note the Vercel URL.

## 3. Connect them
In Render, set `ALLOWED_ORIGINS` to the Vercel URL (comma-separate several) and redeploy. Then open the Vercel URL and sign in with `+15550000001` and OTP `123456`.

## Alternatives
Any host that runs a Docker container with WebSockets works for the backend (Railway, Fly.io); mount a volume at `/data` to keep the database. `docker compose up --build` runs both services on one machine.
