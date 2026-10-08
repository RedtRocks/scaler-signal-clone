// Next inlines NEXT_PUBLIC_* at build time, so the reference must stay literal.
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");

/** http → ws, https → wss. */
export const WS_URL = API_URL.replace(/^http/, "ws");

/** Server-relative media paths ("/media/avatars/…") need the API origin in front. */
export function mediaUrl(path: string | null): string | null {
  if (!path) return null;
  return path.startsWith("/") ? `${API_URL}${path}` : path;
}
