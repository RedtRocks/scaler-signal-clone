import { API_URL } from "./config";
import type {
  Contact,
  ConversationDetail,
  ConversationPatch,
  ConversationSettingsPatch,
  ConversationSummary,
  Id,
  Me,
  MemberRole,
  Message,
  ProfilePatch,
  RequestOtpResponse,
  SearchResults,
  SendMessageBody,
  UserPublic,
  VerifyOtpResponse,
} from "./types";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly detail: string,
  ) {
    super(detail);
    this.name = "ApiError";
  }
}

/** Status used when the request never reached the server. */
export const NETWORK_ERROR_STATUS = 0;

interface ApiAuth {
  getToken: () => string | null;
  onUnauthorized: () => void;
}

let auth: ApiAuth = { getToken: () => null, onUnauthorized: () => {} };

/** Called once by the store so the API layer never imports it. */
export function configureApi(next: ApiAuth): void {
  auth = next;
}

type Query = Record<string, string | number | undefined>;

interface RequestOptions {
  json?: unknown;
  form?: FormData;
  query?: Query;
}

function buildUrl(path: string, query?: Query): string {
  const url = new URL(`/api${path}`, API_URL);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

/** FastAPI sends `detail` as a string, or as a list of field errors on 422. */
async function readDetail(response: Response): Promise<string> {
  try {
    const { detail } = await response.json();
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && typeof detail[0]?.msg === "string") return detail[0].msg;
  } catch {
    // Not JSON: fall through to the status text.
  }
  return response.statusText || `Request failed (${response.status})`;
}

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers();
  const token = auth.getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let body: BodyInit | undefined = options.form;
  if (options.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.json);
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), { method, headers, body });
  } catch {
    throw new ApiError(NETWORK_ERROR_STATUS, "Can't reach the server. Check your connection.");
  }

  if (response.status === 401) auth.onUnauthorized();
  if (!response.ok) throw new ApiError(response.status, await readDetail(response));
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  // Auth
  requestOtp: (phone: string) => request<RequestOtpResponse>("POST", "/auth/request-otp", { json: { phone } }),
  verifyOtp: (phone: string, code: string) =>
    request<VerifyOtpResponse>("POST", "/auth/verify-otp", { json: { phone, code } }),
  logout: () => request<void>("POST", "/auth/logout"),

  // Me
  getMe: () => request<Me>("GET", "/me"),
  updateMe: (patch: ProfilePatch) => request<Me>("PATCH", "/me", { json: patch }),
  uploadAvatar: (file: Blob) => {
    const form = new FormData();
    form.append("file", file);
    return request<Me>("POST", "/me/avatar", { form });
  },

  // Users & contacts
  lookupUser: (phone: string) => request<UserPublic>("GET", "/users/lookup", { query: { phone } }),
  listContacts: () => request<Contact[]>("GET", "/contacts"),
  addContact: (phone: string, nickname?: string) => request<Contact>("POST", "/contacts", { json: { phone, nickname } }),
  renameContact: (userId: Id, nickname: string | null) =>
    request<Contact>("PATCH", `/contacts/${userId}`, { json: { nickname } }),
  removeContact: (userId: Id) => request<void>("DELETE", `/contacts/${userId}`),
  search: (q: string) => request<SearchResults>("GET", "/search", { query: { q } }),

  // Conversations
  listConversations: () => request<ConversationSummary[]>("GET", "/conversations"),
  openDirect: (userId: Id) => request<ConversationSummary>("POST", "/conversations/direct", { json: { user_id: userId } }),
  createGroup: (name: string, memberIds: Id[]) =>
    request<ConversationSummary>("POST", "/conversations/group", { json: { name, member_ids: memberIds } }),
  getConversation: (id: Id) => request<ConversationDetail>("GET", `/conversations/${id}`),
  updateConversation: (id: Id, patch: ConversationPatch) =>
    request<ConversationSummary>("PATCH", `/conversations/${id}`, { json: patch }),
  updateConversationSettings: (id: Id, patch: ConversationSettingsPatch) =>
    request<ConversationSummary>("PATCH", `/conversations/${id}/settings`, { json: patch }),
  addMembers: (id: Id, userIds: Id[]) =>
    request<ConversationDetail>("POST", `/conversations/${id}/members`, { json: { user_ids: userIds } }),
  /** Removes someone (admin only), or leaves when userId is me. */
  removeMember: (id: Id, userId: Id) => request<void>("DELETE", `/conversations/${id}/members/${userId}`),
  setMemberRole: (id: Id, userId: Id, role: MemberRole) =>
    request<void>("PATCH", `/conversations/${id}/members/${userId}`, { json: { role } }),

  // Messages
  /** Newest first, as the server sends them. */
  listMessages: (conversationId: Id, page: { beforeId?: Id; limit?: number } = {}) =>
    request<Message[]>("GET", `/conversations/${conversationId}/messages`, {
      query: { before_id: page.beforeId, limit: page.limit },
    }),
  sendMessage: (conversationId: Id, body: SendMessageBody) =>
    request<Message>("POST", `/conversations/${conversationId}/messages`, { json: body }),
  markRead: (conversationId: Id, upToMessageId: Id) =>
    request<void>("POST", `/conversations/${conversationId}/read`, { json: { up_to_message_id: upToMessageId } }),
  setReaction: (messageId: Id, emoji: string) => request<void>("PUT", `/messages/${messageId}/reaction`, { json: { emoji } }),
  removeReaction: (messageId: Id) => request<void>("DELETE", `/messages/${messageId}/reaction`),
  deleteMessage: (messageId: Id) => request<void>("DELETE", `/messages/${messageId}`),
};
