"use client";

import { useCallback } from "react";
import type { Id, UserPublic } from "@/lib/types";
import { useConversationStore, useNameOf } from "@/store";

/**
 * `nameOf` for one conversation that also knows people from my other direct chats.
 * A Member who left a group is no longer in its member list, but their old messages still name them.
 */
export function useChatNames(conversationId: Id) {
  const nameOf = useNameOf(conversationId);
  const byId = useConversationStore((state) => state.byId);

  const userElsewhere = useCallback(
    (userId: Id): UserPublic | undefined => {
      for (const summary of Object.values(byId)) if (summary.peer?.id === userId) return summary.peer;
      return undefined;
    },
    [byId],
  );

  const name = useCallback(
    (userId: Id): string => {
      const known = nameOf(userId);
      return known === "Unknown" ? (userElsewhere(userId)?.display_name ?? known) : known;
    },
    [nameOf, userElsewhere],
  );

  return { nameOf: name, userElsewhere };
}
