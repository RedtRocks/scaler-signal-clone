# Signal Messenger clone

A full-stack clone of Signal: Signal Desktop's layout on wide screens, and Signal iOS's layout below 600px. Next.js (App Router) + TypeScript on the front, FastAPI + SQLAlchemy + SQLite on the back, with real-time delivery over WebSockets.

Built for the Scaler SDE Fullstack assignment. Domain words (User, Contact, Conversation, Member, Receipt, ...) are defined in [`CONTEXT.md`](CONTEXT.md); the API and database are specified in [`docs/CONTRACT.md`](docs/CONTRACT.md); how and why it is built is in [`docs/GUIDE.md`](docs/GUIDE.md).

## Features

Checked against the glossary in `CONTEXT.md`. Backend rules are covered by `pytest`; the sign-in, conversation list, send and live-receive path is covered by the Playwright smoke test (`e2e/`).

- [x] Sign in by phone number with a mocked OTP (always `123456`); new users set a name, about and photo
- [x] Direct conversations (at most one per pair of users) and group conversations with admins
- [x] Group admin rules: rename, add and remove members, make admins, leave (the oldest member becomes admin if the last admin leaves)
- [x] Contacts as private, one-way address-book entries with optional nicknames
- [x] Conversation list sorted by last activity, with unread counts, pin, mute and archive
- [x] Text messages with optimistic sending (client id), replies, emoji reactions, delete for everyone
- [x] Message status: sending, sent, delivered, read (the weakest across recipients in a group)
- [x] Typing indicators and online / last seen presence
- [x] Disappearing-message timer per conversation, with system messages in the timeline
- [x] Search across conversations, contacts and messages
- [x] Settings: profile (name, about, photo upload), appearance (System / Light / Dark), chats, notifications, privacy, about, log out
- [x] Light and dark themes; responsive layouts (desktop three-column, phone single-column with tab bar)
- [ ] Calls, Stories, Linked devices, Help and Donate: "Coming soon" placeholders, as intended
- [ ] Note to Self (bonus, not built)

## Quickstart

Needs Python 3.13 and Node 22.

```bash
# 1. Backend: http://localhost:8000 (API docs at /docs)
cd backend
python3.13 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python -m app.seed
.venv/bin/uvicorn app.main:app --reload --port 8000

# 2. Frontend: http://localhost:3000   (in a second terminal)
cd frontend
npm ci
npm run dev
```

Or run both with one command: `scripts/dev.sh` (seeds the database first). With Docker: `docker compose up --build`. More detail in [`docs/RUNNING.md`](docs/RUNNING.md).

### Demo accounts

Sign in with any of `+15550000001` to `+15550000008`; the OTP is always `123456`. `+15550000001` is **Aarav Dudeja**, who has the most data (about six direct chats, three groups, unread messages, replies, reactions, one disappearing-message chat). Open a second browser profile signed in as `+15550000002` (Maya Patel) to see both sides live.

Any other phone number creates a new account and takes you through the profile step.

## Configuration

| Variable | Where | Default | Meaning |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | frontend, read at build/dev start | `http://localhost:8000` | URL the browser uses to reach the backend |
| `DATABASE_URL` | backend | `sqlite:///./signal.db` | SQLAlchemy URL |
| `MEDIA_DIR` | backend | `./media` | Uploaded avatars, served at `/media/...` |
| `ALLOWED_ORIGINS` | backend | `http://localhost:3000` | Comma-separated CORS origins |
| `FIXED_OTP` | backend | `123456` | The mocked verification code |

Examples: [`.env.example`](.env.example) (docker compose), [`backend/.env.example`](backend/.env.example), [`frontend/.env.example`](frontend/.env.example).

## Tests

```bash
cd backend && .venv/bin/pytest -q                  # 50 tests: REST rules, receipts, WebSocket pushes
cd frontend && npx tsc --noEmit && npx eslint src && npx vitest run && npx next build
cd e2e && npm install && npm run smoke            # needs both servers running; see e2e/smoke.mjs
```

## Project layout

```
backend/        FastAPI app (routers -> services -> SQLAlchemy models), WebSocket hub, seed, tests
frontend/       Next.js app
  src/app/        routes: (app)/ is the signed-in shell, login/
  src/components/ui/   presentational component library (Signal design system)
  src/features/   screens: auth, sidebar, chat, dialogs, settings, shell
  src/store/      Zustand stores and the realtime wiring
  src/lib/        API client, WebSocket client, formatting, types
  src/styles/tokens.css   design tokens (light and dark)
design-system/  the design reference the UI components were ported from
docs/           CONTRACT.md (API + schema), GUIDE.md (architecture), RUNNING.md
e2e/            Playwright smoke test
scripts/        dev.sh
docker-compose.yml, backend/Dockerfile, frontend/Dockerfile
```

## Screenshots

_To be added: desktop (1440x900) and phone (390x844), light and dark._

## Known limitations

- The OTP is mocked, and "end-to-end encryption" and safety numbers are interface text only. Messages are stored in plain text.
- SQLite with synchronous SQLAlchemy sessions inside async endpoints: fine for a demo, not for heavy load (see `backend/README.md`).
- Text messages only: no attachments, voice notes, calls, stories or linked devices.
- Settings for chats and notifications are stored in the browser (`localStorage`), per device. The notification switches do not send push notifications yet.
- Disappearing-message timers are set per conversation; there is no account-wide default.
- Running the seed resets the database and signs everyone out.
- The Docker files were written but not built in the authoring environment (no Docker daemon was available).
