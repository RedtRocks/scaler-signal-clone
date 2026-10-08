"use client";

import { useState } from "react";
import { Button, Modal } from "@/components/ui";
import { ApiError } from "@/lib/api";
import type { Message } from "@/lib/types";
import { useMessageStore, useToastStore } from "@/store";
import styles from "./ChatModals.module.css";

/** Change the text of my own message. Everyone in the chat sees the new text marked "Edited". */
export function EditMessageModal({ message, onClose }: { message: Message; onClose: () => void }) {
  const push = useToastStore((s) => s.push);
  const [text, setText] = useState(message.body);
  const [saving, setSaving] = useState(false);
  const trimmed = text.trim();

  const save = async () => {
    if (!trimmed || trimmed === message.body) return onClose();
    setSaving(true);
    try {
      await useMessageStore.getState().edit(message.id, trimmed);
      onClose();
    } catch (error) {
      setSaving(false);
      push(error instanceof ApiError && error.detail ? error.detail : "Couldn't edit the message.");
    }
  };

  return (
    <Modal
      title="Edit message"
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving || !trimmed}>
            Save
          </Button>
        </>
      }
    >
      <textarea
        className={styles.editInput}
        value={text}
        autoFocus
        rows={4}
        maxLength={4000}
        aria-label="Message text"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void save();
          }
        }}
      />
    </Modal>
  );
}
