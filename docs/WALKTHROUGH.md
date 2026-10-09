# Code walkthrough: read this to explain the project to the judge

[`GUIDE.md`](./GUIDE.md) explains *what* was built and *why*. This file is the **map of the code**: which file does what, how one action travels through the whole stack, and what to say when you are asked about it. Every path below exists in the repo.

Suggested reading order (about 45 minutes): sections 1 → 2 → 3 (trace one message end to end) → 6 (demo script) → 7 (questions).

---

## 1. The 60-second explanation

> "It is a Signal clone with a Next.js frontend and a FastAPI backend on SQLite. **Changes go over REST; notifications come back over a WebSocket.** When you send a message, the browser POSTs it, the server stores it in one transaction, and then pushes `message.new` over the WebSocket to everyone in the chat. The frontend shows the message immediately as 'sending' (optimistic UI) and swaps in the stored copy when the server answers. The ticks come from a `message_receipts` table with one row per recipient."

Folder layout:

```
backend/   FastAPI app, SQLAlchemy models, tests (pytest)
frontend/  Next.js (App Router) + TypeScript, zustand stores, CSS Modules
docs/      CONTRACT.md (API + schema, the source of truth), GUIDE.md, this file, DEPLOY.md
e2e/       smoke.mjs, an end-to-end script against a running server
```

## 2. Backend, layer by layer

The backend has four layers. A request only ever goes **downwards**.

| Layer | Folder | Job | Example |
|---|---|---|---|
| Router | `backend/app/routers/` | Receives HTTP, validates the body (via `schemas.py`), calls one service, returns JSON. No business rules. | `routers/messages.py` |
| Service | `backend/app/services/` | **All the rules**: who may do what, what changes in the DB. Plain functions taking a SQLAlchemy `Session`. | `services/messages.py` |
| Models | `backend/app/models.py` | The tables (SQLAlchemy 2). Constraints live here too. | `Message`, `Member`, `Receipt` |
| Realtime | `backend/app/realtime/` | Which sockets are open, and pushing events to them. | `notifier.py` |

Supporting files:

- `main.py`: the app factory (`create_app`). Wires settings, DB, CORS, routers, the `/media` static folder and the background task. Tests call `create_app` with a temporary database.
- `auth.py`: sessions. Login creates a random token; only its **SHA-256 hash** is stored (`sessions` table), so a leaked database can't be used to log in. `current_user` is the FastAPI dependency every protected route uses.
- `schemas.py`: Pydantic request and response shapes. Validation (phone must be E.164, body at most 4000 characters, picture URLs must start with `/media/`) is declared here, so routers stay thin.
- `presenter.py`: turns database rows into API objects **from one viewer's point of view** (the title of a chat is the other person's name; `status` ticks only appear on my own messages; unread count is mine).
- `errors.py`: domain errors (`NotFound`, `Forbidden`, `BadRequest`, `Conflict`). Services raise them, `main.py` turns them into JSON `{"detail": ...}` with the right status code.
- `tasks.py`: a loop that runs every 5 s: expires disappearing messages, deletes unclaimed uploads and expired stories.
- `seed.py`: demo data (8 users, chats, reactions, a photo, stories, every tick state). `welcome()` gives each new sign-up three chats and a group.
- `services/access.py`: two small, important helpers. `get_membership` (non-members get **404, not 403**, so conversation ids don't leak) and `only_visible_to` (a person only sees messages from the time they joined until they left).

### The database (12 tables)

`users`, `sessions`, `contacts`, `conversations`, `conversation_members`, `messages`, `message_receipts`, `message_reactions`, `attachments`, `hidden_messages`, `stories`, `story_views`. (Full columns: `CONTRACT.md`.)

Things worth pointing out:

- **One `conversations` table for both direct chats and groups** (`kind` column). Direct chats have a UNIQUE `direct_key` like `"3:7"`, so the database itself stops duplicate chats.
- **Per-person state is on `conversation_members`** (role, read pointer `last_read_message_id`, muted, pinned, archived, chat colour, `joined_at`, `left_at`).
- **Unread = messages after the read pointer**, so marking a chat read is one UPDATE.
- **`message_receipts`: one row per recipient** with `delivered_at` and `read_at`. The tick shown to the sender is the *weakest* state across recipients: all read → read; all delivered → delivered; else sent (`services/receipts.py: statuses`). This is what makes group ticks correct.
- **`UNIQUE(sender_id, client_id)` on messages** makes sending **idempotent**: if the network drops and the browser retries, the same message comes back instead of a duplicate.
- **Delete for everyone is a soft delete** (row kept, text and files removed) so the chat shows "This message was deleted". **Delete for me** inserts a row in `hidden_messages`.
- Foreign keys are switched on explicitly for SQLite (`db.py`) and use `ON DELETE CASCADE` or `SET NULL` as appropriate.

## 3. One message, end to end

This is the trace to memorise. Sending "hi" from Aarav to Maya:

1. **Composer** (`frontend/src/features/chat/ChatComposer.tsx`) calls the send action in `store/chat.ts`, which calls `useMessageStore.send(...)`.
2. **`store/messages.ts → send`** creates an *optimistic* message with a negative local id and a fresh `client_id` and shows it at once with a "sending" clock. Then `deliver()` runs.
3. **`lib/api.ts`** does `POST /api/conversations/{id}/messages` with `{body, client_id, reply_to_id, attachment_ids}`. Files are uploaded first (`POST .../attachments`) and the message only carries their ids.
4. **`routers/messages.py → send_message`** looks up Aarav's membership and calls the service.
5. **`services/messages.py → send_message`** (one DB transaction):
   - if this `client_id` was already stored, return it (idempotent);
   - make sure Aarav is still an active member;
   - if replying, check Aarav is *allowed to see* the quoted message;
   - insert the `Message` (with `expires_at` if the chat has disappearing messages on);
   - claim any uploaded attachments;
   - insert one `Receipt` per other member;
   - update `conversation.last_message_at`; commit.
6. **`realtime/notifier.py → messages_created`** pushes `message.new` to every connected member, including Aarav's other tabs. Each payload is built per recipient by the `Presenter`.
7. Back in Aarav's browser the POST response replaces the optimistic bubble (`receive` → `upsertMessage` matches on `client_id`). Status: **sent** ✓.
8. **Maya's browser** gets `message.new` over the WebSocket (`store/realtime.ts → handleNewMessage`). It adds the message and sends a `delivered` frame back on the socket (batched every 200 ms).
9. **`realtime/websocket.py`** receives `delivered`, calls `receipts.acknowledge_delivery`, which stamps `delivered_at`, and the notifier pushes a `receipt` event to Aarav → his tick becomes **delivered** ✓✓.
10. When Maya opens the chat and the window is focused, `store/readTracker.ts` (debounced 300 ms) calls `POST /conversations/{id}/read`. `receipts.read_up_to` stamps `read_at`; Aarav gets another `receipt` event → **read** (blue ✓✓). If that request fails, the pointer is rewound so it is retried on the next focus or message.

Typing indicators are the other direction: `store/chat.ts` sends `{"type":"typing"}` on the socket; the server checks Maya is an active member and relays it to the other members.

If the socket drops, `lib/socket.ts` reconnects with exponential backoff plus jitter and queues non-ephemeral frames. On the next `hello` event, `store/realtime.ts → resync` re-fetches the chat list and the open threads so nothing is missed.

## 4. Frontend, layer by layer

```
app/            Next.js routes (login, the signed-in shell, /c/[id], /settings, /stories, /calls, /dev/ui)
features/       Screens: each folder is one area (auth, chat, sidebar, settings, stories, calls, dialogs, shell)
components/ui/  About 45 small presentational components (Button, Avatar, Modal, MessageBubble ...), no store access
store/          zustand stores: all state and logic
lib/            api.ts (REST), socket.ts (WebSocket), pure helpers (format, timeline, attachments, avatarCrop ...)
styles/         tokens.css: colours, spacing, dark theme as CSS variables
```

The rules that keep it explainable:

- **`components/ui` never import a store.** They get props and callbacks, so each can be shown on the `/dev/ui` page and reused.
- **`features/*` are the glue**: they read stores and render `components/ui`.
- **Stores hold the logic; pure helpers hold the tricky maths.** `store/messageLogic.ts`, `lib/timeline.ts`, `lib/avatarCrop.ts`, `lib/format.ts` are pure functions with unit tests, which is why they are easy to explain and safe to change.
- **Stores:** `auth` (token and me), `conversations` (the chat list and details), `messages` (threads, optimistic send), `presence` (online and typing), `contacts`, `search`, `stories`, `calls`, `toasts`. `store/session.ts` is the composition root: it creates the socket, boots the session and clears every store on logout. `store/realtime.ts` routes each socket event to the right store.
- **Session persistence:** the token is saved in local storage; on page load `SessionGate` calls `bootstrap()`, which connects the socket and loads `/api/me`, the chats and the contacts.
- **Styling:** CSS Modules per component and design tokens as variables. Dark mode swaps the variables via `data-theme`.
- **Responsive:** three columns on desktop, a collapsed rail on tablet, a single full-screen pane on phones (below 600 px).

## 5. Feature → where to find it

| Feature | Frontend | Backend |
|---|---|---|
| Login with fixed OTP, profile step | `features/auth/LoginFlow.tsx` | `routers/auth.py`, `services/accounts.py` |
| Profile photo with crop | `components/ui/AvatarCropper`, `lib/avatarCrop.ts`, `features/settings/ProfileSection.tsx` | `routers/me.py`, `services/users.py` |
| Chat list, search, filters | `features/sidebar/` | `services/conversations.py: list_memberships`, `routers/search.py` |
| Contacts, add contact | `features/dialogs/ContactsDialog.tsx`, `store/contacts.ts` | `services/contacts.py` |
| Messages, ticks | `features/chat/`, `store/messages.ts` | `services/messages.py`, `services/receipts.py` |
| Typing, online, last seen | `store/presence.ts` | `realtime/websocket.py`, `services/users.py` |
| Groups, admins | `features/dialogs/NewGroupDialog.tsx`, `features/chat/InfoPanel.tsx` | `services/conversations.py` (`create_group`, `add_members`, `remove_member`, `set_role`) |
| Reactions, replies, edit, forward, delete | `features/chat/MessageContextMenu.tsx`, `ForwardDialog.tsx` | `services/messages.py` |
| Attachments, voice messages | `features/chat/AttachTray.tsx`, `voiceRecorder.ts` | `services/attachments.py` |
| Disappearing messages | timer in `InfoPanel.tsx` | `_expiry` + `tasks.py` |
| Stories | `features/stories/` | `services/stories.py` |
| Calls (simulated, UI only) | `features/calls/` | none |
| Settings, dark mode, shortcuts | `features/settings/`, `features/shell/shortcuts.ts` | none |

## 6. Live demo script (3 minutes)

1. Open the app in two browser windows (one normal, one private). Sign in as the demo account (**Use demo account**, OTP `123456`) and, in the other window, with a new phone number to show onboarding, the photo **crop dialog** and the profile step.
2. Send a message from one window: show the clock → ✓ → ✓✓ → blue ✓✓ as the other window receives and opens it. Show the typing indicator.
3. Reply to a message, add a reaction, edit it, delete it for everyone.
4. Create a group, add and remove a member (admin controls), send a message in it.
5. Turn on disappearing messages and watch a message vanish.
6. Show dark mode, a narrow window (phone layout), Settings, Stories, and the Calls tab ("simulated").
7. Show `docs/CONTRACT.md` for the schema and `http://<backend>/docs` for the auto-generated API.

The free Railway plan sleeps the backend: open the site a minute before so the first request isn't slow.

## 7. Questions a judge may ask

**Why REST plus WebSocket instead of everything on the socket?** REST gives validation, status codes and easy retries and tests; the socket stays a thin notification channel. Only typing and delivery acks go up the socket.

**How do you avoid duplicate messages on retry?** The browser makes the `client_id`; the DB has `UNIQUE(sender_id, client_id)`; the service returns the stored message if it already exists (`200` instead of `201`).

**How do group ticks work?** One receipt per recipient; the status is the weakest across them (`receipts.statuses`).

**How is "unread" computed?** Messages after `last_read_message_id` that I didn't send. No per-message flag.

**What stops someone reading a chat they aren't in?** `get_membership` returns 404 for non-members; `only_visible_to` limits history to the period they were a member. Quoting a message from before you joined is rejected (`send_message`, with a test).

**How do you handle a lost connection?** Exponential backoff with jitter in `lib/socket.ts`, a queue for non-ephemeral frames, and a resync on reconnect.

**Is the encryption real?** No. The assignment allows it to be mocked; the "Messages are end-to-end encrypted" notice and safety-number screens are UI only. Login is a fixed OTP `123456`.

**Why SQLite?** Required by the assignment. Foreign keys are enabled explicitly, and the deployment keeps the file on a persistent volume.

**How are tokens protected?** Only the SHA-256 hash is stored. Tokens are random 32-byte URL-safe strings.

**What would you do with more time?** See the limitations below.

## 8. Honest limitations (say these before they are found)

- **Uploaded files are served from `/media/...` without a login check.** The file names are 128-bit random, so they cannot be guessed, but anyone who has a link can open it. A production version would serve files through an authenticated route or signed, expiring URLs. (The images and audio tags in the browser can't send an `Authorization` header, which is why this build uses unguessable names.)
- Sessions do not expire, and there is no rate limiting on the OTP (it is fixed and mocked).
- The disappearing-message timer starts when a message is sent. Signal starts it when the recipient reads it.
- Calls, linked devices and encryption are mocked. Not built: video stories, view-once media, stickers, emoji picker, camera capture. Unread badges are missing on the collapsed avatar column (600–900 px).
- Seed profile photos are hotlinked from randomuser.me; if it is down, initials show instead.
- SQLite columns added later are added by `Database._add_missing_columns` rather than a migration tool.

## 9. Commands

```bash
# backend (http://localhost:8000, docs at /docs)
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload
python -m app.seed            # demo data
pytest -q                     # 85 tests
ruff check . && ruff format --check .

# frontend (http://localhost:3000)
cd frontend && npm install && npm run dev
npm test                      # unit tests (vitest)
npm run lint
```
