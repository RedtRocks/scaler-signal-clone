"use client";

import { useMemo, useState } from "react";
import { Button, SearchField } from "@/components/ui";
import type { Id } from "@/lib/types";
import { useMessageStore } from "@/store";
import { findMatches } from "./chatLogic";
import styles from "./ChatSearch.module.css";

interface ChatSearchProps {
  conversationId: Id;
  onJump: (messageId: Id | null) => void;
  onClose: () => void;
}

/** Search among the messages loaded in this conversation, newest match first. */
export function ChatSearch({ conversationId, onJump, onClose }: ChatSearchProps) {
  const messages = useMessageStore((state) => state.threads[conversationId]?.messages);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const matches = useMemo(() => (messages ? findMatches(messages, query) : []), [messages, query]);
  const current = matches.length > 0 ? Math.min(index, matches.length - 1) : -1;

  const go = (next: number) => {
    if (matches.length === 0) return;
    const wrapped = (next + matches.length) % matches.length;
    setIndex(wrapped);
    onJump(matches[wrapped]);
  };

  const change = (value: string) => {
    setQuery(value);
    const found = messages ? findMatches(messages, value) : [];
    setIndex(Math.max(0, found.length - 1));
    onJump(found.length > 0 ? found[found.length - 1] : null);
  };

  return (
    <div className={styles.bar} role="search">
      <SearchField
        className={styles.field}
        placeholder="Search in chat"
        value={query}
        autoFocus
        onChange={(event) => change(event.target.value)}
        onClear={() => change("")}
        onKeyDown={(event) => {
          if (event.key === "Enter") go(event.shiftKey ? current + 1 : current - 1);
          if (event.key === "Escape") onClose();
        }}
      />
      <span className={styles.count} aria-live="polite">
        {query.trim() ? (matches.length ? `${current + 1} of ${matches.length}` : "No results") : ""}
      </span>
      <Button variant="icon" icon="chevron-down" iconSize={20} className={styles.up} aria-label="Previous match" onClick={() => go(current - 1)} />
      <Button variant="icon" icon="chevron-down" iconSize={20} aria-label="Next match" onClick={() => go(current + 1)} />
      <Button variant="link" onClick={onClose}>
        Done
      </Button>
    </div>
  );
}
