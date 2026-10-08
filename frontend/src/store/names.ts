import type { Contact, Id, Member, UserPublic } from "@/lib/types";

interface NameSources {
  contacts: Contact[];
  members?: Member[];
  peer?: UserPublic | null;
}

/** My Contact's name (nickname-aware) wins, then the User's own display name. */
export function resolveName(userId: Id, { contacts, members, peer }: NameSources): string {
  const contact = contacts.find((c) => c.user.id === userId);
  if (contact) return contact.display_name;
  const user = members?.find((member) => member.user.id === userId)?.user ?? (peer?.id === userId ? peer : null);
  return user?.display_name || user?.phone || "Unknown";
}
