/** A Client id for an optimistic Message (see CONTEXT.md). */
export function newClientId(): string {
  // randomUUID exists only in secure contexts; plain http on a LAN IP lacks it.
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return uuidV4FromRandomBytes();
}

function uuidV4FromRandomBytes(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
