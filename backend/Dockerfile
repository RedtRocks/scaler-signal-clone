FROM python:3.13-slim

ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# SQLite file and uploads live in /data. Attach a volume there to keep them (Railway volume,
# Fly mount, or the compose named volume). No VOLUME instruction: Railway rejects it.
ENV DATABASE_URL=sqlite:////data/signal.db \
    MEDIA_DIR=/data/media \
    ALLOWED_ORIGINS=http://localhost:3000
RUN mkdir -p /data/media

EXPOSE 8000
# Seeds the demo data when the database file does not exist yet (first start on a new volume).
# SEED_ON_START=1 forces a reset to the demo data on every start.
CMD ["sh", "-c", "if [ \"$SEED_ON_START\" = \"1\" ] || [ ! -f /data/signal.db ]; then python -m app.seed; fi; exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
