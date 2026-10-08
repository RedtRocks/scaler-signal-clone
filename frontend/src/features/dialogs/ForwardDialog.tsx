"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Avatar, Button, Modal, SearchField } from "@/components/ui";
import { Icon } from "@/components/ui";
import { mediaUrl } from "@/lib/config";
import { useConversationStore, useMessageStore, useToastStore } from "@/store";
import { useDialogStore } from "./dialogStore";
import styles from "./Dialogs.module.css";

const MAX_TARGETS = 5;

/** Pick one or more chats and send a copy of a message's text to each (text only; no endpoint forwards files). */
export function ForwardDialog() {
  const { close, forwarding } = useDialogStore();
  const byId = useConversationStore((s) => s.byId);
  const order = useConversationStore((s) => s.order);
  const push = useToastStore((s) => s.push);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<number[]>([]);
  const deferred = useDeferredValue(query);

  const needle = deferred.trim().toLowerCase();
  const chats = useMemo(
    () =>
      order
        .map((id) => byId[id])
        .filter((c) => c && !c.left && (!needle || c.title.toLowerCase().includes(needle))),
    [order, byId, needle],
  );

  if (!forwarding) return null;

  const toggle = (id: number) =>
    setPicked((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : current.length < MAX_TARGETS ? [...current, id] : current,
    );

  const send = () => {
    const send = useMessageStore.getState().send;
    for (const id of picked) void send(id, forwarding.body);
    push(picked.length === 1 ? "Message forwarded" : `Message forwarded to ${picked.length} chats`);
    close();
  };

  return (
    <Modal
      title="Forward to"
      onClose={close}
      actions={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button onClick={send} disabled={!picked.length}>
            Send{picked.length > 1 ? ` (${picked.length})` : ""}
          </Button>
        </>
      }
    >
      <div className={styles.stack}>
        <SearchField
          placeholder="Search chats"
          value={query}
          autoFocus
          onChange={(e) => setQuery(e.target.value)}
          onClear={() => setQuery("")}
        />
        <ul className={styles.list}>
          {chats.map((c) => {
            const selected = picked.includes(c.id);
            return (
              <li key={c.id}>
                <button type="button" className={styles.item} role="checkbox" aria-checked={selected} onClick={() => toggle(c.id)}>
                  <Avatar name={c.title} src={mediaUrl(c.avatar_url) ?? undefined} size={40} />
                  <span className={styles.text}>
                    <span className={styles.name}>{c.title}</span>
                    <span className={styles.sub}>{c.kind === "group" ? `${c.member_count} members` : "Direct chat"}</span>
                  </span>
                  <span className={`${styles.check} ${selected ? styles.checked : ""}`}>
                    <Icon name="check" size={14} strokeWidth={2.4} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {!chats.length ? <p className={styles.empty}>No chats match your search.</p> : null}
      </div>
    </Modal>
  );
}
