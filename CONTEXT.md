# Signal Clone — Domain Glossary

The words this project uses, and what each one means. Code, API and UI use these terms exactly.

## People

- **User**: someone registered in the app, identified by a unique **phone number** (E.164, e.g. `+15550000001`). Has a **display name**, an optional **avatar**, an optional **about** line, and a **last seen** time.
- **Session**: one signed-in device/browser for a User. Logging out ends that Session only.
- **Contact**: a private, one-way address-book entry: *Owner* saved *User X*, optionally under a **nickname**. X is not told and does not need to accept. You can message any User whose phone number you know; saving them as a Contact is optional.
- **Presence**: whether a User is **online** (has at least one live connection) or was **last seen** at a time.

## Conversations

- **Conversation**: a thread of Messages between Members. Every Conversation is either:
  - **Direct**: exactly two Members, both permanent. Between any two Users there is at most one Direct Conversation.
  - **Group**: a name, an optional avatar, and one or more Members, at least one of whom is an Admin.
- **Note to Self**: a Direct Conversation whose only Member is you. *(Bonus only: build it if time allows.)*
- **Member**: a User's place in a Conversation. Carries a **role** (Admin or Member), when they joined, and when they left, if they did. A Member who has left keeps their history up to the moment they left and receives nothing after it.
- **Admin**: a Group Member who may rename the Group, add Members, remove Members and make other Members Admins. The creator is the first Admin.
- **Conversation list**: the signed-in User's Conversations, sorted by **last activity** (the time of the latest visible Message).
- **Unread count**: the number of Messages in a Conversation, sent by someone else, after the Member's **read pointer**.
- **Read pointer**: the latest Message a Member has read in a Conversation.

## Messages

- **Message**: something posted to a Conversation. Its **kind** is:
  - **Text**: written by a Member (the **sender**).
  - **System**: an event the app writes in the timeline, e.g. "Maya added Kai.", "You set disappearing message time to 1 hour." It has no sender status and is never counted as unread.
- **Attachment**: one file (image, PDF, text, zip, audio or video) belonging to exactly one Message, with an original **file name**, a content type, a size in bytes and, for images, a width and height. A Message carries up to 10 Attachments and an optional caption (its body). An Attachment is uploaded first and is private to its uploader until a Message claims it; it is deleted from disk together with its Message.
- **Client id**: an id the sending client generates before the server knows about the Message. It lets the client match its optimistic bubble to the stored Message and makes resending safe.
- **Reply**: a Message that quotes an earlier Message in the same Conversation.
- **Reaction**: one emoji a User puts on a Message. At most one per User per Message; choosing another emoji replaces it.
- **Disappearing timer**: a per-Conversation duration. Messages sent while it is on get an **expiry time**, after which they are deleted for everyone.

## Delivery

- **Receipt**: one recipient's record for one Message, holding **delivered at** and **read at**.
- **Message status** (shown to the sender only, on their own Messages):
  - **sending**: the client has not yet heard back from the server (exists only on the client).
  - **sent**: the server stored it.
  - **delivered**: a device of *every* current recipient has received it.
  - **read**: *every* current recipient has read it.
  - In a Group the sender sees the *weakest* state across recipients.
- **Typing**: a short-lived signal that a Member is composing in a Conversation. It is never stored.

## Mocked by design

- **OTP**: the verification code is always `123456`.
- **Safety number** / **end-to-end encryption**: shown as UI text only. Messages are stored in plain text on the server.
- **Calls**, **Stories**, **Linked devices**: "Coming soon" placeholders.
