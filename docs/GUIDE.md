# Project Guide: how this Signal clone works and why

This is your study guide for the evaluation interview. It explains what was built, how the pieces fit, and *why* each decision was made. Read it top to bottom once, then use the "Likely interview questions" section to rehearse.

> Status: **complete for the submitted build.** Section 11 lists what is mocked or not built.

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

### 4.1 Attachments (schema)

10. **A separate `attachments` table, not a column on `messages`.** A message may carry up to 10 files, so it is a one-to-many relationship. Each row stores the original `file_name` (shown to people), `content_type`, `size`, and for images `width`/`height`, so the browser can reserve the right amount of space *before* the picture loads and the timeline does not jump.
11. **Upload first, then send a message that references the ids (two steps).** `POST /conversations/{id}/attachments` stores one file and returns an Attachment with no message yet (`message_id` NULL). The normal JSON `POST /messages` then lists `attachment_ids`. Why: the browser can show *per-file upload progress* (XHR) and retry just the failed file; the message POST stays small JSON, so the `client_id` idempotency from 4.6 works unchanged (a retry returns the stored message and attaches nothing twice); and the server claims the files and creates the message in one transaction.
12. **Files live on disk under a random name, the database keeps the metadata.** The name is 128 random bits plus an extension taken from the *allowlisted content type*, never from the user's file name. That blocks path tricks (`../../x`) and means the static server can only ever answer with a safe type. SVG and HTML are refused because they run script when opened. The **known limitation**: `/media/…` is not authenticated, so access control is "the URL is unguessable and only members receive it". Metadata (`GET /attachments/{id}`) *is* membership-checked. Real systems use signed, expiring URLs.
13. **The server measures image size itself** from the PNG/GIF/JPEG/WebP header (about 60 lines, no Pillow). A client cannot lie about it, and a file that claims `image/png` but isn't one is rejected with 400.
14. **Limits answer in the usual `{"detail": …}` shape:** more than 10 MB gives 413, a type that is not allowed gives 400, an 11th attachment gives 400. The upload reads at most 10 MB + 1 byte, so a huge upload is never held in memory.

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

### 5.1 Attachment lifecycle

```
You pick, paste or drop files, type an optional caption and press Send
 1. Browser: files wait in a strip above the input (thumbnails, remove buttons); nothing is uploaded yet
 2. Browser: shows a "sending" bubble at once with local previews (blob: URLs) and a progress ring per file
 3. Browser → POST /conversations/7/attachments (one request per file, in parallel, with progress)
 4. Browser → POST /messages {body: caption, client_id, attachment_ids:[…]}   (same client_id idempotency as text)
 5. Server: claims the files for the message, saves, pushes message.new (with attachments) to every member
 6. Both browsers swap the optimistic bubble for the stored one; the chat list reads "📷 Photo" or "📎 name"
 If a step fails: the bubble shows "Not sent. Tap to retry"; a retry skips files that already uploaded.
 Delete for everyone, or the disappearing timer: the rows and the files on disk are removed in the same pass.
 Files uploaded but never sent (user closed the tab) are deleted by the 5 s background task after one hour.
```

## 6. Real-time features

- **Typing**: the browser sends `typing` at most once every 3 s while you type. Others show the three dots and hide them after 5 s of silence or when the message arrives. Nothing is stored.
- **Presence**: you count as *online* if you have at least one socket open. When your last tab closes, the server records `last_seen_at` and tells everyone who shares a chat with you.
- **Disappearing messages**: when a chat has a timer, each new message gets `expires_at`. A background task on the server deletes expired messages every 5 s and pushes the update.
- **Reconnects**: the socket reconnects with exponential backoff (1 s, 2 s, 4 s… up to 10 s, plus a little randomness so all clients don't reconnect at once) and pings every 25 s to keep the connection alive.

- **Keyboard shortcuts** (`features/shell/shortcuts.ts`, `useShortcuts.ts`): one window `keydown` listener, a pure `matchShortcut` function (unit tested) and a help dialog opened with `?`. Bare keys such as `?` and Esc never fire while you type in a field, and Esc never fires while a dialog or menu is open. The "new chat / new group / settings" shortcuts use Alt because browsers keep Ctrl/Cmd+N for themselves; Signal Desktop uses Ctrl/Cmd there, so this is a deliberate web difference.

## 7. Frontend structure

- `src/components/ui/`: the design system ported to React. Each component is *presentational*: it receives data through props and reports clicks through callbacks, and never fetches anything. That makes the components reusable and easy to reason about.
- `src/lib/`: framework-free logic, including API calls, the socket client, time formatting, and timeline grouping (which bubbles join into a run).
- `src/store/`: app state and the actions that change it.
- `src/features/`: screens that connect store hooks to UI components. `auth/` (login, OTP, profile), `sidebar/` (list, search, filters), `dialogs/` (new chat, new group, contacts), `chat/` (header, timeline, composer, info panel), `settings/`, and `shell/` (session gate and the three-column frame).
- `src/app/`: thin routes: `/login`, `/` (empty pane), `/c/[id]`, `/settings/[section]`, `/calls` and `/stories` (coming soon). Routes only pick a feature; they hold no logic.

Request flow for one action, e.g. reacting to a message: `MessageRow` (UI) calls a store action, the store calls `lib/api.ts` (REST), the server saves it and pushes a `reaction` event, `lib/socket.ts` receives it, `store/realtime.ts` updates the message store, and every open tab re-renders from that one source of truth.

## 8. Backend structure

- `routers/`: thin HTTP layer that parses input, checks auth, and calls a service.
- `services/`: the rules, e.g. "only admins can add members" and "the last admin leaving promotes the oldest member".
- `realtime/`: the connection registry and event pushes.
- `models.py` / `schemas.py`: database tables / API shapes. They're kept separate so the API can change without changing the DB, and vice versa.

## 9. How the UI matches Signal

- **Design system first.** Every colour, radius, spacing and shadow comes from `src/styles/tokens.css`, generated from your Signal design system. Components never hard-code a hex value, which is why dark mode is one attribute (`data-theme="dark"`) and why the phone layout can change metrics without touching components.
- **Desktop layout:** a 68px rail, a 320px conversation list and the chat pane (`AppShell`). Below 600px the same components become the phone layout: the list is the home screen with a tab bar, and a chat is a full screen with a back button. This is one codebase, not two.
- **Details copied from Signal:** message runs share a tail and tight spacing, sender names and colours in groups, delivery circles (sending, sent, delivered, read), a day pill that sticks while scrolling, "N unread messages" divider, typing bubbles, system lines such as "Mom added you", the encryption notice at the top of a chat, a blue Ultramarine accent on desktop, and Title Case settings rows.
- **Where each piece lives:** `src/components/ui/<Name>` is the pixel-level piece; `src/features/*` composes pieces into screens.
- **How it was checked:** every screen was opened with Playwright at 1440x900 and 390x844 in light and dark and compared by eye with Signal. Screenshots are in `docs/screenshots/`.

## 10. Running, seeding, deploying

Everything needed is in [`RUNNING.md`](./RUNNING.md): backend and frontend commands, environment variables, the demo account (`+15550000001`, OTP `123456`), Docker, and the Playwright smoke test (`e2e/smoke.mjs`). The Docker files and `scripts/dev.sh` were written but not run end to end in the build environment (no Docker daemon there), so run them once before relying on them.

## 11. Assumptions and mocked parts

- OTP is fixed at `123456`. There's no SMS.
- No real end-to-end encryption. Messages are stored in plain text on the server. The UI shows Signal's encryption notice as decoration.
- Calls, Stories and Linked devices show "Coming soon".
- Not built, because the API contract has no endpoint for it: editing a sent message, delete for me, forwarding, group avatars, voice notes, emoji picker and stickers. The buttons for the last three, and the camera, show a "coming soon" toast. Attachments *are* built (bonus), see 4.1 and 5.1; audio and video are sent as plain downloadable files with no inline player.
- One account per phone number. A "Session" is one browser login, and logout ends only that one.

## 12. Likely interview questions (and short answers)

- *Why REST for sending instead of the WebSocket?* See §1: validation, error codes, retries, testability. The socket is for pushes.
- *How do you prevent duplicate messages on retry?* `client_id` with a UNIQUE(sender_id, client_id) constraint (§4.6).
- *How is "read" computed in groups?* Per-recipient receipts, weakest state wins (§4.5).
- *How is unread count computed?* Read pointer, not per-message flags (§4.4).
- *What happens if two people create the same DM at once?* `direct_key` UNIQUE, so the second insert fails and we return the existing one (§4.2).
- *Why zustand and not Redux or context?* Small API, no provider tree, and the socket handler can update state outside React.
- *How does the phone layout work without a second app?* One `AppShell` switches which column is visible below 600px (`useIsPhone`), and the tokens change metrics under the same media query.
- *How do you keep two tabs of one user in sync?* The server pushes every change to all of that user's open sockets, including the sender's other tabs, and the store reconciles by `client_id` and message id.
- *What happens to messages from someone who left a group?* The conversation detail returns `former_members`, so old messages and "X left" lines still show their name.
- *How is auth done?* Phone plus mocked OTP gives a random session token. Only its sha256 is stored, so a database leak does not leak live tokens. REST sends it as `Authorization: Bearer`, the socket as `?token=`.
- *What would you do next with more time?* Real SMS, end-to-end encryption, message editing, signed URLs for attachments, thumbnails and image compression, and replacing the polling expiry task with a scheduler or queue.
- *What is deliberately not built?* See section 11 and the README's known limitations: editing messages, delete-for-me, forwarding, group avatars, calls, stories, voice notes.
- *Why upload attachments separately instead of one multipart message request?* Per-file progress and retry in the browser, the message request stays small JSON so `client_id` idempotency and the optimistic bubble work exactly as for text, and a resend can never attach a file twice (4.1, point 11). The cost is orphan uploads when a user abandons a draft; a background task deletes unclaimed files after an hour.
- *Is it safe that anyone with the file URL can download it?* No, and the README lists it. The name is 128 random bits and is only sent to conversation members, and the metadata endpoint checks membership, but the static `/media` route has no auth. The fix is signed expiring URLs or a download endpoint that checks membership (it would need cookies or a short-lived token, since `<img>` cannot send an Authorization header). The upload side is hardened: allowlist, size limit, extension from the content type, image headers verified, no SVG or HTML.
