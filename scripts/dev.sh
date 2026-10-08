#!/usr/bin/env bash
# Seed the demo data and start the backend (8000) and frontend (3000) together. Ctrl+C stops both.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PY="${PYTHON:-$ROOT/backend/.venv/bin/python}"

if [ ! -x "$PY" ]; then
  echo "Backend venv not found at $PY."
  echo "Create it: cd backend && python3.13 -m venv .venv && .venv/bin/pip install -r requirements.txt"
  echo "(or set PYTHON=/path/to/python)"
  exit 1
fi
if [ ! -d "$ROOT/frontend/node_modules" ]; then
  (cd "$ROOT/frontend" && npm ci)
fi

export ALLOWED_ORIGINS="${ALLOWED_ORIGINS:-http://localhost:3000}"
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:8000}"

cd "$ROOT/backend"
"$PY" -m app.seed
"$PY" -m uvicorn app.main:app --reload --port 8000 &
API_PID=$!
trap 'kill "$API_PID" 2>/dev/null || true' EXIT INT TERM

cd "$ROOT/frontend"
npx next dev -p 3000
