// Shapes from docs/CONTRACT.md. JSON stays snake_case, exactly as the server sends it.

export type Id = number;
/** ISO-8601 UTC string with a trailing `Z`, e.g. "2026-10-08T13:00:00Z". */
export type IsoTime = string;

export type ConversationKind = "direct" | "group";
export type MemberRole = "admin" | "member";
export type MessageKind = "text" | "system";

export interface Me {
  id: Id;
  phone: string;
  display_name: string;
  about: string | null;
  avatar_url: string | null;
  created_at: IsoTime;
}

export interface UserPublic {
  id: Id;
  phone: string;
  display_name: string;
  about: string | null;
  avatar_url: string | null;
  online: boolean;
  last_seen_at: IsoTime | null;
}

export interface Contact {
  user: UserPublic;
  nickname: string | null;
  /** nickname ?? user.display_name */
  display_name: string;
}

/** Status the server reports on my own text messages. */
export type ServerMessageStatus = "sent" | "delivered" | "read";
/** Adds the client-only states of an optimistic message. */
export type MessageStatus = "sending" | "failed" | ServerMessageStatus;

export type SystemEvent =
  | { type: "group_created" }
  | { type: "members_added"; user_ids: Id[] }
  | { type: "member_removed"; user_id: Id }
  | { type: "member_left" }
  | { type: "admin_granted"; user_id: Id }
  | { type: "renamed"; name: string }
  | { type: "timer_changed"; seconds: number | null };

/** One file of a message. Local (optimistic) ones have a negative id and a blob: url. */
export interface Attachment {
  id: Id;
  /** Server-relative ("/media/attachments/…"); pass through mediaUrl() before use. */
  url: string;
  file_name: string;
  content_type: string;
  /** Bytes. */
  size: number;
  /** Images only. */
  width: number | null;
  height: number | null;
}

export interface ReplyPreview {
  id: Id;
  sender_id: Id | null;
  body: string;
  deleted: boolean;
  /** The first attachment of the quoted message. */
  attachment: Attachment | null;
}

export interface Reaction {
  emoji: string;
  user_id: Id;
}

export interface Message {
  /** Negative while the message exists only on this client (optimistic send). */
  id: Id;
  conversation_id: Id;
  client_id: string | null;
  /** The sender of a text message, or the actor of a system message. */
  sender_id: Id | null;
  kind: MessageKind;
  /** "" when deleted. */
  body: string;
  system_event: SystemEvent | null;
  reply_to: ReplyPreview | null;
  created_at: IsoTime;
  expires_at: IsoTime | null;
  deleted: boolean;
  /** True once the sender edited the text (shown as "Edited" by the time). */
  edited?: boolean;
  /** Only on my own text messages. */
  status: MessageStatus | null;
  reactions: Reaction[];
  /** In send order. [] when deleted or none. */
  attachments: Attachment[];
}

export interface ConversationSummary {
  id: Id;
  kind: ConversationKind;
  /** Group name, or the other user's display name (nickname-aware). */
  title: string;
  avatar_url: string | null;
  /** Direct conversations only. */
  peer: UserPublic | null;
  member_count: number;
  last_message: Message | null;
  last_message_at: IsoTime | null;
  unread_count: number;
  muted: boolean;
  pinned: boolean;
  archived: boolean;
  left: boolean;
  disappearing_seconds: number | null;
  my_role: MemberRole;
}

export interface Member {
  user: UserPublic;
  role: MemberRole;
  joined_at: IsoTime;
}

export interface ConversationDetail extends ConversationSummary {
  description: string | null;
  created_at: IsoTime;
  members: Member[];
  /** Left or removed; kept so their old messages still show a name. */
  former_members: UserPublic[];
}

export interface MessageSearchHit {
  message: Message;
  conversation_id: Id;
  conversation_title: string;
}

export interface SearchResults {
  conversations: ConversationSummary[];
  contacts: Contact[];
  messages: MessageSearchHit[];
}

// ---- REST request/response bodies ----

export interface RequestOtpResponse {
  phone: string;
  is_registered: boolean;
}

export interface VerifyOtpResponse {
  token: string;
  user: Me;
  is_new: boolean;
}

export interface ProfilePatch {
  display_name?: string;
  about?: string;
  avatar_url?: string | null;
}

export interface ConversationPatch {
  name?: string;
  description?: string;
  avatar_url?: string | null;
  disappearing_seconds?: number | null;
}

export interface ConversationSettingsPatch {
  muted?: boolean;
  pinned?: boolean;
  archived?: boolean;
}

export interface SendMessageBody {
  /** The caption when there are attachments; may then be "". */
  body: string;
  client_id: string;
  reply_to_id?: Id;
  attachment_ids?: Id[];
}

// ---- WebSocket frames: {"type": "...", "data": {...}} ----

export type ClientEvent =
  | { type: "typing"; data: { conversation_id: Id; is_typing: boolean } }
  | { type: "delivered"; data: { message_ids: Id[] } }
  | { type: "ping"; data: Record<string, never> };

export interface ReceiptEvent {
  conversation_id: Id;
  message_ids: Id[];
  status: ServerMessageStatus;
}

export interface ReadEvent {
  conversation_id: Id;
  user_id: Id;
  up_to_message_id: Id;
}

export interface TypingEvent {
  conversation_id: Id;
  user_id: Id;
  is_typing: boolean;
}

export interface PresenceEvent {
  user_id: Id;
  online: boolean;
  last_seen_at: IsoTime | null;
}

export type ServerEvent =
  | { type: "hello"; data: { user_id: Id } }
  | { type: "message.new"; data: Message }
  | { type: "message.updated"; data: Message }
  | { type: "receipt"; data: ReceiptEvent }
  | { type: "conversation.updated"; data: ConversationSummary }
  | { type: "conversation.removed"; data: { conversation_id: Id } }
  | { type: "read"; data: ReadEvent }
  | { type: "typing"; data: TypingEvent }
  | { type: "presence"; data: PresenceEvent }
  | { type: "pong"; data: Record<string, never> };

export type ServerEventType = ServerEvent["type"];
export type ServerEventData<T extends ServerEventType> = Extract<ServerEvent, { type: T }>["data"];
