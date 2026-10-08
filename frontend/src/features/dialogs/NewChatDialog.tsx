"use client";

import { useRouter } from "next/navigation";
import { useDeferredValue, useMemo, useState } from "react";
import { Modal, SearchField, Spinner } from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import { useAuthStore, useContactStore, useConversationStore } from "@/store";
import { useDialogStore } from "./dialogStore";
import { ActionRow, ContactRow } from "./PersonRow";
import { looksLikePhone, normalizePhone } from "./phone";
import styles from "./Dialogs.module.css";

/** Search or pick a Contact, or type a phone number, to open (or create) a Direct Conversation. */
export function NewChatDialog() {
  const router = useRouter();
  const { close, show } = useDialogStore();
  const contacts = useContactStore((s) => s.contacts);
  const openDirect = useConversationStore((s) => s.openDirect);
  const meId = useAuthStore((s) => s.me?.id);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const deferred = useDeferredValue(query);

  const needle = deferred.trim().toLowerCase();
  const phone = looksLikePhone(query) ? normalizePhone(query) : null;
  const matches = useMemo(
    () =>
      contacts.filter(
        (c) => !needle || c.display_name.toLowerCase().includes(needle) || c.user.phone.replace(/\D/g, "").includes(needle.replace(/\D/g, "") || "\u0000"),
      ),
    [contacts, needle],
  );

  const start = async (userId: number) => {
    setBusy(true);
    setError("");
    try {
      const id = await openDirect(userId);
      close();
      router.push(`/c/${id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Couldn't start the chat. Try again.");
      setBusy(false);
    }
  };

  const startByPhone = async (number: string) => {
    setBusy(true);
    setError("");
    try {
      const user = await api.lookupUser(number);
      await start(user.id);
    } catch (e) {
      setError(e instanceof ApiError && e.status === 404 ? "No Signal account found for that number." : "Couldn't look up that number. Try again.");
      setBusy(false);
    }
  };

  return (
    <Modal title="New chat" onClose={close}>
      <div className={styles.stack}>
        <SearchField
          placeholder="Search name or phone number"
          value={query}
          autoFocus
          onChange={(e) => {
            setQuery(e.target.value);
            setError("");
          }}
          onClear={() => setQuery("")}
        />
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        <ul className={styles.list}>
          {!needle ? <ActionRow icon="add-member" label="New group" onClick={() => show("newGroup")} /> : null}
          {!needle ? <ActionRow icon="user" label="Contacts" sub="View and add contacts" onClick={() => show("contacts")} /> : null}
          {meId !== undefined && "note to self".includes(needle) ? (
            <ActionRow icon="note" label="Note to Self" sub="Send yourself notes and files" disabled={busy} onClick={() => void start(meId)} />
          ) : null}
          {phone ? (
            <ActionRow icon="chat" label={`Message ${phone}`} sub="Start a chat by phone number" disabled={busy} onClick={() => void startByPhone(phone)}>
              {busy ? <Spinner size={18} /> : null}
            </ActionRow>
          ) : null}
          {matches.map((c) => (
            <ContactRow key={c.user.id} contact={c} disabled={busy} onClick={() => void start(c.user.id)} />
          ))}
        </ul>
        {!matches.length && !phone ? (
          <p className={styles.empty}>
            {contacts.length ? "No contacts match your search." : "You have no contacts yet. Type a phone number to start a chat."}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
