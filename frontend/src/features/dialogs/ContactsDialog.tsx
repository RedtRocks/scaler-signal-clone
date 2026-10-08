"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, COUNTRIES, Modal, PhoneInput, SearchField, Spinner, TextField, toE164 } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { useContactStore, useConversationStore, useToastStore } from "@/store";
import { useDialogStore } from "./dialogStore";
import { ContactRow } from "./PersonRow";
import styles from "./Dialogs.module.css";

const ADD_ERRORS: Record<number, string> = {
  404: "No Signal account found for that number.",
  400: "You can't add your own number.",
  409: "That number is already in your contacts.",
};

/** Contacts list, with an "Add contact" form (phone + optional nickname). */
export function ContactsDialog() {
  const router = useRouter();
  const close = useDialogStore((s) => s.close);
  const contacts = useContactStore((s) => s.contacts);
  const add = useContactStore((s) => s.add);
  const openDirect = useConversationStore((s) => s.openDirect);
  const push = useToastStore((s) => s.push);
  const [mode, setMode] = useState<"list" | "add">("list");
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("US");
  const [national, setNational] = useState("");
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const needle = query.trim().toLowerCase();
  const shown = contacts.filter(
    (c) => !needle || c.display_name.toLowerCase().includes(needle) || c.user.display_name.toLowerCase().includes(needle),
  );

  const message = async (userId: number) => {
    setBusy(true);
    try {
      const id = await openDirect(userId);
      close();
      router.push(`/c/${id}`);
    } catch {
      push("Couldn't open that chat.");
      setBusy(false);
    }
  };

  const submit = async () => {
    const digits = national.replace(/\D/g, "");
    if (digits.length < 4) {
      setError("Enter a valid phone number.");
      return;
    }
    const dial = COUNTRIES.find((c) => c.iso === country)?.dial ?? "+1";
    setBusy(true);
    setError("");
    try {
      const contact = await add(toE164(dial, national), nickname.trim() || undefined);
      push(`${contact.display_name} added to contacts.`);
      setNational("");
      setNickname("");
      setMode("list");
    } catch (e) {
      setError(e instanceof ApiError ? (ADD_ERRORS[e.status] ?? e.detail) : "Couldn't add that contact. Try again.");
    }
    setBusy(false);
  };

  if (mode === "add") {
    return (
      <Modal
        title="Add contact"
        onClose={close}
        actions={
          <>
            <Button variant="secondary" onClick={() => setMode("list")} disabled={busy}>
              Back
            </Button>
            <Button onClick={() => void submit()} disabled={busy || !national.trim()}>
              {busy ? <Spinner size={16} inherit /> : null}
              Add
            </Button>
          </>
        }
      >
        <form
          className={styles.stack}
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <PhoneInput
            country={country}
            onCountryChange={setCountry}
            value={national}
            onChange={(v) => {
              setNational(v);
              setError("");
            }}
            error={error}
            autoFocus
            disabled={busy}
            onEnter={() => void submit()}
          />
          <TextField
            label="Nickname (optional)"
            placeholder="How you want to see them"
            value={nickname}
            maxLength={40}
            onChange={(e) => setNickname(e.target.value)}
          />
        </form>
      </Modal>
    );
  }

  return (
    <Modal
      title="Contacts"
      onClose={close}
      actions={
        <Button onClick={() => setMode("add")} icon="plus">
          Add contact
        </Button>
      }
    >
      <div className={styles.stack}>
        <SearchField placeholder="Search contacts" value={query} onChange={(e) => setQuery(e.target.value)} onClear={() => setQuery("")} />
        <ul className={styles.list}>
          {shown.map((c) => (
            <ContactRow key={c.user.id} contact={c} disabled={busy} onClick={() => void message(c.user.id)} />
          ))}
        </ul>
        {!shown.length ? (
          <p className={styles.empty}>{contacts.length ? "No contacts match your search." : "No contacts yet. Add someone by phone number."}</p>
        ) : null}
      </div>
    </Modal>
  );
}
