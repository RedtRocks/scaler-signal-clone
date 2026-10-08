# Signal clone: backend

FastAPI + SQLAlchemy 2 + SQLite. It implements [`../docs/CONTRACT.md`](../docs/CONTRACT.md) (schema, REST, WebSocket, seed) using the terms in [`../CONTEXT.md`](../CONTEXT.md).

## Setup and run

```bash
cd backend
uv venv -p 3.13 .venv && uv pip install -p .venv/bin/python -r requirements.txt
# or: python3.13 -m venv .venv && .venv/bin/pip install -r requirements.txt

.venv/bin/python -m app.seed                          # reset the DB to the demo data
.venv/bin/uvicorn app.main:app --reload --port 8000   # http://localhost:8000/docs
.venv/bin/pytest -q                                   # tests (each one gets a temp SQLite DB)
```

Sign in as **+15550000001** (Aarav Dudeja). The OTP is always **123456**.

The seed is **idempotent by reset**: every run drops and recreates all tables, then writes the same demo world relative to the current time. That also signs everyone out.

### Environment variables (all optional; a `backend/.env` file works too)

| Variable | Default | Meaning |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./signal.db` | SQLAlchemy URL |
| `MEDIA_DIR` | `./media` | where uploaded avatars (`avatars/`) and message attachments (`attachments/`) are stored, served at `/media/...` |
| `MAX_ATTACHMENT_BYTES` | `10485760` | size limit per attachment (413 above it) |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | comma-separated CORS origins |
| `FIXED_OTP` | `123456` | the mocked verification code |

## Architecture

```
app/
  main.py          app factory: settings, DB, CORS, routers, /media, lifespan (create tables, expiry task)
  config.py        Settings (pydantic-settings)
  db.py            Database (engine + sessions, SQLite foreign keys ON), get_db, utcnow
  models.py        ORM tables, constraints and indexes, exactly as in the contract
  schemas.py       request/response models; times serialise as ISO-8601 with "Z"
  errors.py        domain errors (BadRequest/Forbidden/NotFound/Conflict) -> {"detail": ...}
  auth.py          session tokens (random, stored as sha256), current_user dependency
  presenter.py     ORM -> API shapes from one viewer's point of view, batched (no N+1)
  deps.py          shared FastAPI dependencies
  routers/         thin HTTP layer: parse, call a service, push events, present
  services/        business rules, one unit of work (commit) per operation
    access.py        membership lookups, admin checks, message visibility (joined_at..left_at)
    conversations.py direct get-or-create, groups, admin rules, last-admin succession
    messages.py      send (idempotent on client_id), history, reactions, delete, expiry, search
    attachments.py   validated uploads (allowlist, 10 MB), claiming files for a message, file removal, purge of unclaimed uploads
    imageinfo.py     PNG/GIF/JPEG/WebP size from the header (no Pillow)
    receipts.py      status aggregation, delivered/read stamping, read pointer
    users.py, contacts.py, accounts.py
  realtime/
    connections.py   ConnectionManager: user_id -> set[WebSocket]; presence = has a socket
    notifier.py      every server->client push, built per recipient
    websocket.py     /ws?token= endpoint (typing, delivered, ping)
  tasks.py         disappearing-messages loop (every 5 s)
  seed.py          python -m app.seed
```

**Request flow.** A router calls a service. The service checks the rules, writes, and commits, raising a domain error when a rule fails. The router then `await`s the matching `Notifier` method to push WebSocket events, and returns a shape built by the `Presenter`. Services never touch sockets or HTTP types.

**Sync DB in async endpoints (deliberate).** Every endpoint is `async def` so it can `await` WebSocket pushes on the same event loop that owns the sockets. Database access uses ordinary synchronous SQLAlchemy sessions. Each query blocks the loop briefly, which is fine for SQLite at this scale and keeps the code simple. With Postgres and real load, the next step would be `AsyncSession`.

**Viewer-dependent shapes.** A direct conversation's title is the peer's name, or *my* nickname for them. `status` appears only on my own text messages. Unread count, role and the muted/pinned/archived flags are per member. That is why `conversation.updated` and `message.new` are built separately for each recipient.

**Visibility.** A member sees messages created between their `joined_at` and their `left_at` (if set). A removed member's history ends with the "removed you" system message.

**Status.** One grouped query over `message_receipts` per batch: `read` if every receipt has `read_at`, `delivered` if every receipt has `delivered_at`, otherwise `sent`.

**N+1.** `GET /api/conversations` uses a fixed number of queries, however many conversations there are: memberships, member counts, last visible message ids, those messages with reactions and replies, unread counts, direct peers, nicknames and statuses. A test asserts this.

**Data integrity in the schema.** Besides the contract's keys and uniques, CHECK constraints guarantee the following: a direct conversation has a `direct_key` and a group never does, a text message has a sender, a receipt cannot be read without being delivered, and nobody can be their own contact. Enum columns are VARCHAR with CHECKs.
