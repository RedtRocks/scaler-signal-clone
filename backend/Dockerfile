FROM python:3.13-slim

ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# SQLite file and uploaded avatars live in /data; mount a volume there to keep them.
ENV DATABASE_URL=sqlite:////data/signal.db \
    MEDIA_DIR=/data/media \
    ALLOWED_ORIGINS=http://localhost:3000
RUN mkdir -p /data/media
VOLUME /data

EXPOSE 8000
# SEED_ON_START=1 resets the database to the demo data before serving.
CMD ["sh", "-c", "if [ \"$SEED_ON_START\" = \"1\" ]; then python -m app.seed; fi; exec uvicorn app.main:app --host 0.0.0.0 --port 8000"]
