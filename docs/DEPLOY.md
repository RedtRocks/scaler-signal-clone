# Deploying the demo

Frontend on **Vercel** (free). Backend on **Render's free plan**, kept awake by a free uptime pinger. Railway and Fly.io (paid, with a persistent volume) are described at the end.

The backend image (`backend/Dockerfile`) keeps the database at `/data/signal.db`, listens on `$PORT`, and seeds the demo data whenever `/data/signal.db` does not exist yet. Render's free plan has no persistent disk, so the demo data comes back fresh after every restart or redeploy; messages sent in between last until then.

## 1. Backend on Render (free)
1. In Render: **New > Blueprint**, pick this repository. Render reads `render.yaml` and builds `backend/Dockerfile` on the free plan.
2. Leave `ALLOWED_ORIGINS` empty for now; it is filled in step 4.
3. Note the service URL, e.g. `https://signal-clone-api.onrender.com`. `/docs` on it shows the API.

Render's free services sleep after 15 minutes without traffic. To keep it awake, create a free monitor at [UptimeRobot](https://uptimerobot.com) or [cron-job.org](https://cron-job.org) that requests `https://<your-service>.onrender.com/docs` every 10 minutes.

## 2. Frontend on Vercel
1. **Add New > Project**, import this repository, set **Root Directory** to `frontend`.
2. Add the environment variable `NEXT_PUBLIC_API_URL` = the backend URL (no trailing slash). The WebSocket URL is derived from it (`https` becomes `wss`).
3. Deploy, and note the Vercel URL.

## 3. Connect them
Set `ALLOWED_ORIGINS` on the Render service (**Environment**) to the Vercel URL and let it redeploy. Open the Vercel URL and sign in with `+15550000001`, OTP `123456`.

## Paid alternatives with a persistent volume
### Railway
1. In Railway: **New Project > Deploy from GitHub repo**, pick `scaler-signal-clone`.
2. Service **Settings**: set **Root Directory** to `backend`. Railway builds `backend/Dockerfile` (it always uses a Dockerfile when it finds one). No config file is needed: Railway no longer lets new services use `railway.json`.
3. Service **Variables**: add `PORT` = `8000`.
4. Right-click the canvas > **Volume**, attach it to the service with mount path **`/data`**.
5. Optional: **Settings > Deploy > Healthcheck Path** = `/docs`.
6. **Settings > Networking > Generate Domain**, target port `8000`. Note the URL, e.g. `https://signal-clone-api.up.railway.app`. `/docs` on it shows the API.

### Fly.io
From `backend/`, with the `fly` CLI logged in. First change `app` in `backend/fly.toml` to a unique name (region is `sin`, Singapore; Fly has no India region):
```bash
fly apps create <app-name>
fly volumes create signal_data --size 1 --region sin -a <app-name>
fly deploy
```
The URL is `https://<app-name>.fly.dev`.

`docker compose up --build` runs both services on one machine instead.
