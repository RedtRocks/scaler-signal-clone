# Contract: database, REST API, WebSocket protocol

The backend implements this and the frontend consumes it. Change it **here first**, then in code. Domain terms come from [`../CONTEXT.md`](../CONTEXT.md).

## Conventions

- Base URL: `NEXT_PUBLIC_API_URL` (dev `http://localhost:8000`). Every REST path is under `/api`.
- Auth: `Authorization: Bearer <token>`. The WebSocket uses `GET /ws?token=<token>`.
- IDs are integers. Times are ISO-8601 UTC strings with a `Z` (`2026-10-08T13:00:00Z`).
- JSON is `snake_case`, everywhere.
- Errors use FastAPI's shape `{"detail": "<human message>"}` with 400 / 401 / 403 / 404 / 409 / 422.
- Lists are arrays. Message history is paginated by cursor: `?before_id=<id>&limit=50`, newest-first from the server, and the client reverses it.

## Database schema (SQLite via SQLAlchemy 2)

```
users                 id PK, phone UNIQUE NOT NULL, display_name NOT NULL, about, avatar_url,
                      created_at, last_seen_at
sessions              id PK, user_id FK→users CASCADE, token_hash UNIQUE (sha256 of token),
                      created_at, last_used_at
contacts              id PK, owner_id FK→users CASCADE, contact_user_id FK→users CASCADE,
                      nickname, created_at,  UNIQUE(owner_id, contact_user_id), CHECK(owner≠contact)
conversations         id PK, kind ('direct'|'group') NOT NULL, name (group only), avatar_url,
                      description, created_by FK→users, created_at,
                      last_message_at (denormalised, for list sorting; indexed),
                      disappearing_seconds NULL (NULL = off),
                      direct_key UNIQUE NULL  -- "minId:maxId" for direct; enforces one per pair
conversation_members  id PK, conversation_id FK CASCADE, user_id FK CASCADE,
                      role ('admin'|'member'), joined_at, left_at NULL,
                      last_read_message_id NULL, muted BOOL, pinned BOOL, archived BOOL, chat_color NULL,
                      UNIQUE(conversation_id, user_id), INDEX(user_id)
messages              id PK, conversation_id FK CASCADE, sender_id FK→users NULL (NULL for system),
                      kind ('text'|'system'), body TEXT, system_event JSON NULL,
                      client_id NULL, reply_to_id FK→messages SET NULL NULL,
                      created_at, expires_at NULL, deleted_at NULL,
                      INDEX(conversation_id, id), UNIQUE(sender_id, client_id)
attachments           id PK, conversation_id FK→conversations CASCADE, uploader_id FK→users CASCADE,
                      message_id FK→messages CASCADE NULL (NULL until a message claims it),
                      position INT (order inside the message), file_name, content_type, size,
                      width NULL, height NULL (images only),
                      duration_ms NULL (audio only: set = a voice message),
                      storage_name UNIQUE (random, on disk),
                      created_at, INDEX(message_id)
message_receipts      message_id FK CASCADE, user_id FK CASCADE, delivered_at NULL, read_at NULL,
                      PK(message_id, user_id)   -- one row per recipient (not the sender)
message_reactions     message_id FK CASCADE, user_id FK CASCADE, emoji, created_at,
                      PK(message_id, user_id)
```

Derived rules:
- **Message status** for the sender = `read` if every receipt has `read_at`, `delivered` if every receipt has `delivered_at`, otherwise `sent`. A message with no receipts (a group where everyone else left) is `sent`.
- **Unread count** = messages with `id > last_read_message_id`, `sender_id ≠ me`, `kind='text'`, not deleted, and `created_at ≥ joined_at` (and `≤ left_at` if set).
- Reading a conversation (`POST /read`) moves `last_read_message_id` forward and stamps `read_at` (plus `delivered_at` if missing) on my receipts up to that id.
- **Attachment rules.** A message carries 0 to 10 attachments, with an optional caption (`body`). A message needs a non-blank `body` or at least one attachment. Each file is at most 10 MB. An unclaimed attachment (`message_id` NULL) is private to its uploader and is deleted, row and file, an hour after upload if no message claims it. Deleting a message for everyone, or its expiry, deletes the attachment rows and the files on disk.
- Leaving or being removed sets `left_at`. Re-adding clears it and sets a new `joined_at`.
- `system_event` shapes: `{"type":"group_created"}`, `{"type":"members_added","user_ids":[..]}`, `{"type":"member_removed","user_id":..}`, `{"type":"member_left"}`, `{"type":"admin_granted","user_id":..}`, `{"type":"renamed","name":".."}`, `{"type":"timer_changed","seconds":..|null}`. `sender_id` on a system row is the *actor*. The client renders the sentence ("You added Kai.").

## REST API

### Auth
| Method | Path | Body → Response |
|---|---|---|
| POST | `/api/auth/request-otp` | `{phone}` → `{phone, is_registered}`. The OTP is always `123456`. |
| POST | `/api/auth/verify-otp` | `{phone, code}` → `{token, user: Me, is_new}`. A new phone creates a User with `display_name = ""`, and the client then sends it to the profile step. A wrong code → 400. |
| POST | `/api/auth/logout` | → 204. Deletes this session. |
| GET | `/api/me` | → `Me` |
| PATCH | `/api/me` | `{display_name?, about?, avatar_url?}` → `Me` |
| POST | `/api/me/avatar` | multipart `file` (image ≤ 2 MB) → `Me`. Stored under `/media/avatars/…`. |

### Users & contacts
| Method | Path | Notes |
|---|---|---|
| GET | `/api/users/lookup?phone=` | → `UserPublic` or 404. Finds someone to message or save. |
| GET | `/api/contacts` | → `Contact[]`, sorted by name. |
| POST | `/api/contacts` | `{phone, nickname?}` → `Contact` (201). An unknown phone → 404, yourself → 400, an existing contact → 409. |
| PATCH | `/api/contacts/{user_id}` | `{nickname}` → `Contact` |
| DELETE | `/api/contacts/{user_id}` | → 204 |
| GET | `/api/search?q=` | → `{conversations: ConversationSummary[], contacts: Contact[], messages: MessageSearchHit[]}`. Case-insensitive. |

### Conversations
| Method | Path | Notes |
|---|---|---|
| GET | `/api/conversations` | → `ConversationSummary[]`, sorted by pinned, then `last_message_at` desc. Only conversations where I'm a member (left groups included, with `left: true`). |
| POST | `/api/conversations/direct` | `{user_id}` → `ConversationSummary`. Get-or-create. |
| POST | `/api/conversations/group` | `{name, member_ids: int[]}` → `ConversationSummary` (201). The creator becomes admin, and a `group_created` system message is written plus `members_added`. |
| GET | `/api/conversations/{id}` | → `ConversationDetail` |
| PATCH | `/api/conversations/{id}` | `{name?, description?, avatar_url?, disappearing_seconds?}`. Groups need an admin for name and description; a direct conversation lets either member set the timer. Writes a system message. |
| PATCH | `/api/conversations/{id}/settings` | `{muted?, pinned?, archived?, chat_color?}`. Per member. `chat_color` is a preset name (`crimson`, `vermilion`, `burlap`, `forest`, `wintergreen`, `teal`, `blue`, `indigo`, `violet`, `plum`, `taupe`, `steel`) or `"default"` to clear; other values → 422. The summary returns `chat_color` (null = default). |
| POST | `/api/conversations/{id}/members` | `{user_ids}`, admin only → `ConversationDetail` |
| DELETE | `/api/conversations/{id}/members/{user_id}` | Admin only (remove), or yourself (leave). If the last admin leaves, the oldest member becomes admin. |
| PATCH | `/api/conversations/{id}/members/{user_id}` | `{role}`, admin only |
| GET | `/api/conversations/{id}/messages?before_id=&limit=` | → `Message[]` (newest first). Side effect: marks my undelivered receipts in this conversation as delivered. |
| POST | `/api/conversations/{id}/attachments` | multipart `file` (+ optional `duration_ms` for a voice message) → `Attachment` (201). Active members only. Uploads one file, not yet part of any message. See *Attachments*. |
| GET | `/api/attachments/{id}` | → `Attachment`. Members who can see its message (the uploader, until it is claimed). Others get 404. |
| POST | `/api/conversations/{id}/messages` | `{body?, client_id, reply_to_id?, attachment_ids?}` → `Message` (201). Idempotent on `client_id`. `body` defaults to `""` but body and `attachment_ids` cannot both be empty (422). |
| POST | `/api/conversations/{id}/read` | `{up_to_message_id}` → 204 |
| PUT | `/api/messages/{id}/reaction` | `{emoji}` → 204. `DELETE` removes my reaction. |
| DELETE | `/api/messages/{id}` | Sender only, "delete for everyone" → 204 (soft delete) |

### Shapes
```ts
Me              = { id, phone, display_name, about, avatar_url, created_at }
UserPublic      = { id, phone, display_name, about, avatar_url, online: bool, last_seen_at }
Contact         = { user: UserPublic, nickname: string|null, display_name: string /* nickname ?? user.display_name */ }
ConversationSummary = {
  id, kind: 'direct'|'group', title /* group name or the other user's display name (nickname-aware) */,
  avatar_url, peer: UserPublic|null /* direct only */, member_count,
  last_message: Message|null, last_message_at, unread_count, muted, pinned, archived,
  left: bool, disappearing_seconds: number|null, my_role: 'admin'|'member'
}
ConversationDetail  = ConversationSummary & { description, created_at, members: Member[], former_members: UserPublic[] }
Member          = { user: UserPublic, role: 'admin'|'member', joined_at }
Message = {
  id, conversation_id, client_id, sender_id|null, kind: 'text'|'system', body, system_event|null,
  reply_to: { id, sender_id, body, deleted: bool, attachment: Attachment|null /* the first one, for the quote thumbnail */ }|null,
  created_at, expires_at|null, deleted: bool /* body becomes "" */,
  status: 'sent'|'delivered'|'read'|null /* only on my own text messages */,
  reactions: { emoji, user_id }[],
  attachments: Attachment[] /* in send order; [] when deleted or none */
}
Attachment = { id, url /* "/media/attachments/<random>.<ext>" */, file_name, content_type, size /* bytes */,
               width: number|null, height: number|null /* images only, measured by the server */,
               duration_ms: number|null /* audio only: a recorded voice message; capped at 1 hour, ignored for other types */ }
MessageSearchHit = { message: Message, conversation_id, conversation_title }
```

### Attachments

**Two steps: upload each file, then send a message that references the ids.** `POST /api/conversations/{id}/attachments` takes one multipart `file` and returns an `Attachment` that belongs to no message yet. The client then sends the normal JSON `POST …/messages` with `attachment_ids` (in display order), `client_id` and the caption in `body`. Why not one multipart message POST:
- the browser reports upload progress per file, and a failed file can be retried alone without resending the others;
- the message POST stays small JSON, so `client_id` idempotency, the optimistic bubble and the 201/200 behaviour are unchanged;
- a resend of the message POST with the same `client_id` returns the stored message and ignores `attachment_ids` (the files are already attached), so a retry can never attach twice.

Claiming rules: every id must be an unclaimed attachment uploaded by me in this same conversation, at most 10, no duplicates; otherwise 400. Claiming happens in the same transaction as the message insert.

Limits and errors (all `{"detail": "…"}`):
- over 10 MB → **413**; empty file → 400;
- content type not in the allowlist → **400**. Allowed: `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `application/pdf`, `text/plain`, `application/zip`, `audio/mpeg`, `audio/ogg`, `audio/wav`, `audio/mp4`, `audio/webm`, `video/mp4`, `video/webm`, `video/quicktime`. SVG and HTML are refused on purpose (they run script when opened). Audio with a `duration_ms` is a voice message (the client draws a waveform and a play button); other audio and video are plain downloadable files;
- an image whose bytes don't parse as its declared type → 400. The server reads `width` and `height` from the PNG/GIF/JPEG/WebP header itself (no Pillow dependency, and a client cannot lie about it);
- not an active member of the conversation → 404 or 403, as for sending a message.

Storage: `MEDIA_DIR/attachments/<32 hex random>.<ext>`. The extension comes from the allowlisted content type, never from the user's file name, so the static server always answers with a safe `Content-Type`. The original name is kept only in the database (`file_name`, path parts stripped, max 255 chars) and returned as data.

**Known limitation: files are served by `/media/…` without authentication.** Access control is the 128-bit random name, which cannot be guessed, and the name is only ever sent to members. Anyone who obtains the URL can fetch the file. Metadata (`GET /api/attachments/{id}`) is membership-checked. A production system would use signed, expiring URLs or an authenticated download endpoint.

Cleanup: deleting for everyone and disappearing-message expiry remove the rows and the files. A background pass (same 5 s task) removes unclaimed uploads older than one hour.

Previews (built on the client from `body` and `attachments`, for the chat list, search hits and quotes): the caption if there is one, else `📷 Photo` (one image) / `📷 N photos` (only images), `🎤 Voice Message` (one voice message), `📎 File` (one other file) or `📎 N files` (anything else).

## WebSocket `/ws?token=…`

There is one socket per tab. Every frame is JSON `{"type": "...", "data": {...}}`. The server keeps a registry `user_id → set[socket]`.
Sending messages and other changes go through **REST**. The socket carries **pushes** and **ephemeral signals**.

### Client → server
| type | data | effect |
|---|---|---|
| `typing` | `{conversation_id, is_typing}` | Relayed to the other online members. Throttle to one every 3 s while typing. |
| `delivered` | `{message_ids: int[]}` | Stamps `delivered_at` on my receipts and pushes `receipt` to the senders. The client sends it on every `message.new` it receives. |
| `ping` | `{}` | The server answers `pong`. Keepalive every 25 s. |

### Server → client
| type | data | sent to |
|---|---|---|
| `hello` | `{user_id}` | the socket, on connect |
| `message.new` | `Message` (`status` set for the sender's copy) | all current members, *including the sender's other tabs* |
| `message.updated` | `Message` | members (reaction changed, deleted, expired) |
| `receipt` | `{conversation_id, message_ids: int[], status}` | the sender: the new aggregate status of their messages |
| `conversation.updated` | `ConversationSummary` (from the recipient's point of view) | members (rename, members changed, timer, a new conversation appeared) |
| `conversation.removed` | `{conversation_id}` | a user removed from a group (their list keeps it with `left: true`; this tells the open view) |
| `read` | `{conversation_id, user_id, up_to_message_id}` | the reader's other tabs (to clear unread) |
| `typing` | `{conversation_id, user_id, is_typing}` | other members |
| `presence` | `{user_id, online, last_seen_at}` | users who share a conversation or have this user as a contact |
| `pong` | `{}` | |

Presence: **online** = at least one open socket. On the last socket closing, set `last_seen_at = now` and broadcast.
Disappearing: a background task runs every 5 s, soft-deletes messages past `expires_at`, and pushes `message.updated` with `deleted: true`.

## Seed (idempotent, `python -m app.seed`)

There are 8 users with phones `+15550000001` to `+15550000008`. `+15550000001` is the demo login (**"Aarav Dudeja"**), OTP `123456`.
The seed has about 6 direct chats and 3 groups (e.g. "Family", "Rock climbers", "Roommates") with realistic messages spread over the last 7 days, a mix of receipt states, one image attachment (a generated PNG) in one direct conversation, some unread counts, a reply, reactions, one conversation with a disappearing timer, and system events in the groups.


## Stories

A story is visible for 24 hours to everyone the author shares an active conversation with. `Story = { id, author, body, background, media_url: string|null, created_at, expires_at, viewed, views? }`.

| Method | Path | Notes |
|---|---|---|
| GET | `/api/stories` | My stories and my audience's, newest first. |
| POST | `/api/stories` | `{body, background}` → text story (201). |
| POST | `/api/stories/photo` | multipart `file` (JPEG, PNG, WebP or GIF, at most 10 MB, bytes checked) + optional `caption` (≤ 700) → photo story (201). The file is stored under `MEDIA_DIR/stories/` with a random name and deleted with the story. |
| POST | `/api/stories/{id}/view` | Records a view (idempotent). |
| DELETE | `/api/stories/{id}` | Author only. |

Replying to a story has no endpoint of its own: the client opens (or creates) the direct chat with the author and sends an ordinary message.

Calls have no backend: the call screens and the Calls tab history are client-side (history lives in `localStorage` per account).
