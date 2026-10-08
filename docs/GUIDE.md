# Project Guide: how this Signal clone works and why

This is your study guide for the evaluation interview. It explains what was built, how the pieces fit, and *why* each decision was made. Read it top to bottom once, then use the "Likely interview questions" section to rehearse.

> Status: **in progress.** Sections marked 🚧 get filled in as each part lands.

---

## 1. The big picture

```
 Browser (Next.js app)                                   Server (FastAPI)
┌─────────────────────────────────┐                ┌──────────────────────────────────┐
│ UI components (presentational)  │                │ Routers  (HTTP endpoints)        │
│        ▲ props    │ callbacks   │   REST (JSON)  │    │                             │
│ Screens (wire store → UI)       │ ─────────────▶ │ Services (business rules)        │
│        ▲ hooks    │ actions     │                │    │                             │
│ Store (zustand: state + logic)  │ ◀── WebSocket ─│ Realtime (who's connected,       │
│   api.ts (REST)  socket.ts (WS) │    pushes      │           push events)           │
└─────────────────────────────────┘                │ Models (SQLAlchemy) → SQLite     │
                                                   └──────────────────────────────────┘
```

**One rule drives the architecture:** *changes go over REST, notifications come over the WebSocket.*
- To send a message, the browser `POST`s it. The server saves it, then **pushes** `message.new` over the WebSocket to every member, including your own other tabs.
- Only **ephemeral** signals travel browser → server on the socket: "I'm typing" and "I received these messages" (delivery acks).

Why: REST requests are easy to validate, test and retry, and they return proper errors. The socket stays a thin, one-way notification channel. Real Signal works differently (it routes everything through its own server protocol) {unverified}, but this split is the standard pattern for a web chat app and is easy to explain.

## 2. Tech stack and why

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 16 (App Router) + TypeScript | Required by the assignment. |
| State | zustand | Small, no boilerplate, works outside React (the socket handler can update state directly). |
| Styling | CSS Modules + design tokens as CSS variables | One `.module.css` per component, so styles can't leak. Dark mode is one attribute (`data-theme="dark"`) that swaps the variables. |
| Backend | FastAPI | Native async WebSockets, automatic request validation with Pydantic, auto-generated docs at `/docs`. |
| ORM | SQLAlchemy 2 | Typed models, real relationships and constraints, and the industry standard. |
| DB | SQLite | Required. Foreign keys are switched on explicitly (SQLite has them off by default) {unverified}. |
| Real-time | WebSockets | Two-way and low-latency, so typing indicators and receipts arrive instantly. |

## 3. The domain, in plain words

See [`CONTEXT.md`](../CONTEXT.md) for the exact glossary. The essentials:

- A **User** is identified by a phone number. Login is mocked: the OTP is always `123456`.
- A **Contact** is *your private address-book entry* for another User. It's one-way: they don't approve it, just as in Signal, which has no friend requests.
- Everything you chat in is a **Conversation**. It's either **direct** (two people) or **group** (a name, members and admins). Both kinds share one messages table and one pipeline, so features such as receipts, reactions and replies work in both without duplicate code.
- A **Member** row links a User to a Conversation and stores their personal state: role, read pointer, muted, pinned, and when they joined or left.

## 4. Database schema and why it looks like this

Full schema: [`CONTRACT.md` → Database schema](./CONTRACT.md#database-schema-sqlite-via-sqlalchemy-2).

Key design decisions (be ready to defend these):

1. **One `conversations` table with `kind`, not separate DM and group tables.** Messages, unread counts and the list view are identical for both kinds, so separate tables would duplicate every query.
2. **`direct_key` UNIQUE column (`"minUserId:maxUserId"`).** The database itself guarantees there's at most one direct chat between two people, even if both open a chat at the same moment.
3. **`conversation_members` holds per-person state**: `role`, `last_read_message_id`, `muted`, `pinned`, `left_at`. Anything that differs per person lives here, not on the conversation.
4. **Unread count comes from a read pointer.** We don't store an "unread" flag per message; we count messages after `last_read_message_id`. Marking a chat read is one UPDATE, not N.
5. **`message_receipts` has one row per recipient** with `delivered_at` and `read_at`. In a group, "read" must mean *everyone* read it, which a single status column on the message can't represent. The status the sender sees is computed as the *weakest* state across recipients.
6. **`client_id` on messages, UNIQUE per sender.** The browser makes up an id before sending. If the network hiccups and it retries, the server recognises the duplicate and returns the existing message (this is called *idempotency*). The browser also uses it to swap its grey "sending" bubble for the real one.
7. **System messages live in the same table** (`kind='system'`, a JSON `system_event`). "Maya added Kai" appears in the right place in the timeline automatically. The server stores the *event*, and the browser renders the sentence, so "You" vs "Maya" is worked out per viewer.
8. **Soft delete (`deleted_at`)** for "delete for everyone" and disappearing messages. The row stays so replies pointing at it don't break; the body is hidden.
9. **`last_message_at` is denormalised** onto conversations so the chat list can sort with an index instead of scanning every message.

## 5. Message lifecycle (the ✓ / ✓✓ story)

```
You type "hi" and press Enter
 1. Browser: adds a bubble with status "sending" (dashed circle) and a fresh client_id
 2. Browser → POST /api/conversations/7/messages {body:"hi", client_id}
 3. Server: saves the message + one receipt row per other member  → status "sent" (one circle with check)
 4. Server → WebSocket "message.new" to every member's open tabs
 5. Your browser: swaps the optimistic bubble for the saved one (matched by client_id)
 6. Friend's browser: shows it, and replies on the socket {"type":"delivered", message_ids:[…]}
 7. Server: stamps delivered_at → pushes "receipt" {status:"delivered"} to you   → two circles
 8. Friend opens the chat → POST /read {up_to_message_id}
 9. Server: stamps read_at, moves their read pointer → pushes "receipt" {status:"read"} → two filled circles
```
If your friend is offline at step 6, their receipts stay "sent" until they next load the chat. Fetching messages marks them delivered.

## 6. Real-time features

- **Typing**: the browser sends `typing` at most once every 3 s while you type. Others show the three dots and hide them after 5 s of silence or when the message arrives. Nothing is stored.
- **Presence**: you count as *online* if you have at least one socket open. When your last tab closes, the server records `last_seen_at` and tells everyone who shares a chat with you.
- **Disappearing messages**: when a chat has a timer, each new message gets `expires_at`. A background task on the server deletes expired messages every 5 s and pushes the update.
- **Reconnects**: the socket reconnects with exponential backoff (1 s, 2 s, 4 s… up to 10 s, plus a little randomness so all clients don't reconnect at once) and pings every 25 s to keep the connection alive.

## 7. Frontend structure 🚧

- `src/components/ui/`: the design system ported to React. Each component is *presentational*: it receives data through props and reports clicks through callbacks, and never fetches anything. That makes the components reusable and easy to reason about.
- `src/lib/`: framework-free logic, including API calls, the socket client, time formatting, and timeline grouping (which bubbles join into a run).
- `src/store/`: app state and the actions that change it.
- `src/app/`: pages (routes) that connect store hooks to UI components.

## 8. Backend structure 🚧

- `routers/`: thin HTTP layer that parses input, checks auth, and calls a service.
- `services/`: the rules, e.g. "only admins can add members" and "the last admin leaving promotes the oldest member".
- `realtime/`: the connection registry and event pushes.
- `models.py` / `schemas.py`: database tables / API shapes. They're kept separate so the API can change without changing the DB, and vice versa.

## 9. How the UI matches Signal 🚧

## 10. Running, seeding, deploying 🚧

## 11. Assumptions and mocked parts

- OTP is fixed at `123456`. There's no SMS.
- No real end-to-end encryption. Messages are stored in plain text on the server. The UI shows Signal's encryption notice as decoration.
- Calls, Stories and Linked devices show "Coming soon".
- One account per phone number. A "Session" is one browser login, and logout ends only that one.

## 12. Likely interview questions (and short answers) 🚧

- *Why REST for sending instead of the WebSocket?* See §1: validation, error codes, retries, testability. The socket is for pushes.
- *How do you prevent duplicate messages on retry?* `client_id` with a UNIQUE(sender_id, client_id) constraint (§4.6).
- *How is "read" computed in groups?* Per-recipient receipts, weakest state wins (§4.5).
- *How is unread count computed?* Read pointer, not per-message flags (§4.4).
- *What happens if two people create the same DM at once?* `direct_key` UNIQUE, so the second insert fails and we return the existing one (§4.2).
