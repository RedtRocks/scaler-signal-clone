"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar, Button, Modal, SearchField, Spinner, TextField } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { mediaUrl } from "@/lib/config";
import { useContactStore, useConversationStore } from "@/store";
import { useDialogStore } from "./dialogStore";
import { ContactRow } from "./PersonRow";
import styles from "./Dialogs.module.css";

const NAME_MAX = 60;

/** Step 1: pick Members. Step 2: name the group. */
export function NewGroupDialog() {
  const router = useRouter();
  const { close, show } = useDialogStore();
  const contacts = useContactStore((s) => s.contacts);
  const createGroup = useConversationStore((s) => s.createGroup);
  const [step, setStep] = useState<"members" | "name">("members");
  const [picked, setPicked] = useState<number[]>([]);
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const needle = query.trim().toLowerCase();
  const shown = contacts.filter((c) => !needle || c.display_name.toLowerCase().includes(needle));
  const toggle = (id: number) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const chosen = contacts.filter((c) => picked.includes(c.user.id));

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Group name is required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const id = await createGroup(trimmed, picked);
      close();
      router.push(`/c/${id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Couldn't create the group. Try again.");
      setBusy(false);
    }
  };

  if (step === "name") {
    return (
      <Modal
        title="Name this group"
        onClose={close}
        actions={
          <>
            <Button variant="secondary" onClick={() => setStep("members")} disabled={busy}>
              Back
            </Button>
            <Button onClick={() => void create()} disabled={busy || !name.trim()}>
              {busy ? <Spinner size={16} inherit /> : null}
              Create
            </Button>
          </>
        }
      >
        <form
          className={styles.stack}
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <div className={styles.hero}>
            <Avatar name={name || "Group"} kind="group" size={80} />
          </div>
          <TextField
            label="Group name"
            placeholder="Group name (required)"
            value={name}
            maxLength={NAME_MAX}
            autoFocus
            error={error}
            trailing={`${name.length}/${NAME_MAX}`}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
          />
          <div className={styles.chips}>
            {chosen.map((c) => (
              <span key={c.user.id} className={styles.chip}>
                <Avatar name={c.display_name} src={mediaUrl(c.user.avatar_url) ?? undefined} size={22} />
                <span>{c.display_name}</span>
              </span>
            ))}
          </div>
        </form>
      </Modal>
    );
  }

  return (
    <Modal
      title="New group"
      onClose={close}
      actions={
        <>
          <Button variant="secondary" onClick={() => show("newChat")}>
            Back
          </Button>
          <Button onClick={() => setStep("name")} disabled={!picked.length}>
            Next{picked.length ? ` (${picked.length})` : ""}
          </Button>
        </>
      }
    >
      <div className={styles.stack}>
        <SearchField placeholder="Search contacts" value={query} autoFocus onChange={(e) => setQuery(e.target.value)} onClear={() => setQuery("")} />
        {chosen.length ? (
          <div className={styles.chips}>
            {chosen.map((c) => (
              <button key={c.user.id} type="button" className={styles.chip} aria-label={`Remove ${c.display_name}`} onClick={() => toggle(c.user.id)}>
                <Avatar name={c.display_name} src={mediaUrl(c.user.avatar_url) ?? undefined} size={22} />
                <span>{c.display_name}</span>
              </button>
            ))}
          </div>
        ) : null}
        <ul className={styles.list} role="group" aria-label="Contacts">
          {shown.map((c) => (
            <ContactRow key={c.user.id} contact={c} selected={picked.includes(c.user.id)} onClick={() => toggle(c.user.id)} />
          ))}
        </ul>
        {!shown.length ? (
          <p className={styles.empty}>{contacts.length ? "No contacts match your search." : "Add some contacts first to make a group."}</p>
        ) : null}
      </div>
    </Modal>
  );
}
