"use client";

import { useState, type ReactNode } from "react";
import { Avatar, Button, Modal, RadioGroup, SettingsGroup, SettingsRow, Switch, TextField } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { formatTimer } from "@/lib/format";
import type { ConversationDetail, Id } from "@/lib/types";
import { useContactStore, useConversationStore, useToastStore } from "@/store";
import { safetyNumber, TIMER_CHOICES } from "./chatLogic";
import styles from "./ChatModals.module.css";

function failure(error: unknown, fallback: string): string {
  return error instanceof ApiError && error.detail ? error.detail : fallback;
}

interface ConfirmProps {
  title: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children: ReactNode;
}

export function ConfirmModal({ title, confirmLabel, destructive, onConfirm, onClose, children }: ConfirmProps) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={destructive ? "destructive" : "primary"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className={styles.text}>{children}</p>
    </Modal>
  );
}

/** Disappearing messages: pick how long new messages stay. */
export function TimerModal({ conversationId, current, onClose }: { conversationId: Id; current: number | null; onClose: () => void }) {
  const push = useToastStore((state) => state.push);
  const [value, setValue] = useState(String(current ?? "off"));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const seconds = value === "off" ? null : Number(value);
    if (seconds === current) return onClose();
    setSaving(true);
    try {
      await useConversationStore.getState().update(conversationId, { disappearing_seconds: seconds });
      onClose();
    } catch (error) {
      setSaving(false);
      push(failure(error, "Couldn't change the disappearing message time."));
    }
  };

  return (
    <Modal
      title="Disappearing messages"
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            Save
          </Button>
        </>
      }
    >
      <p className={styles.text}>When turned on, new messages sent and received in this chat will disappear after the time you choose.</p>
      <RadioGroup
        value={value}
        onChange={setValue}
        options={TIMER_CHOICES.map((seconds) => ({
          value: String(seconds ?? "off"),
          label: seconds === null ? "Off" : formatTimer(seconds),
        }))}
      />
    </Modal>
  );
}

/** Group name and description (admins only; the server enforces it too). */
export function EditGroupModal({ detail, onClose }: { detail: ConversationDetail; onClose: () => void }) {
  const push = useToastStore((state) => state.push);
  const [name, setName] = useState(detail.title);
  const [description, setDescription] = useState(detail.description ?? "");
  const [saving, setSaving] = useState(false);
  const trimmed = name.trim();

  const save = async () => {
    const patch: { name?: string; description?: string } = {};
    if (trimmed !== detail.title) patch.name = trimmed;
    if (description.trim() !== (detail.description ?? "")) patch.description = description.trim();
    if (Object.keys(patch).length === 0) return onClose();
    setSaving(true);
    try {
      await useConversationStore.getState().update(detail.id, patch);
      await useConversationStore.getState().loadDetail(detail.id);
      onClose();
    } catch (error) {
      setSaving(false);
      push(failure(error, "Couldn't save the group."));
    }
  };

  return (
    <Modal
      title="Edit group"
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !trimmed}>
            Save
          </Button>
        </>
      }
    >
      <div className={styles.fields}>
        <TextField label="Group name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        <TextField
          label="Group description"
          value={description}
          maxLength={200}
          placeholder="Add a description"
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
    </Modal>
  );
}

/** Pick Contacts who are not Members yet. */
export function AddMembersModal({ detail, onClose }: { detail: ConversationDetail; onClose: () => void }) {
  const push = useToastStore((state) => state.push);
  const contacts = useContactStore((state) => state.contacts);
  const [picked, setPicked] = useState<Set<Id>>(new Set());
  const [saving, setSaving] = useState(false);
  const memberIds = new Set(detail.members.map((member) => member.user.id));
  const candidates = contacts.filter((contact) => !memberIds.has(contact.user.id));

  const toggle = (userId: Id, on: boolean) =>
    setPicked((current) => {
      const next = new Set(current);
      if (on) next.add(userId);
      else next.delete(userId);
      return next;
    });

  const add = async () => {
    setSaving(true);
    try {
      await useConversationStore.getState().addMembers(detail.id, [...picked]);
      onClose();
    } catch (error) {
      setSaving(false);
      push(failure(error, "Couldn't add members."));
    }
  };

  return (
    <Modal
      title="Add members"
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={add} disabled={saving || picked.size === 0}>
            Add{picked.size ? ` (${picked.size})` : ""}
          </Button>
        </>
      }
    >
      {candidates.length === 0 ? (
        <p className={styles.text}>Everyone in your contacts is already in this group.</p>
      ) : (
        <div className={styles.pickList}>
          <SettingsGroup>
            {candidates.map((contact) => (
              <SettingsRow
                key={contact.user.id}
                label={contact.display_name}
                sublabel={contact.user.phone}
                avatar={<Avatar name={contact.display_name} src={contact.user.avatar_url ?? undefined} size={36} />}
                control={
                  <Switch
                    label={`Add ${contact.display_name}`}
                    checked={picked.has(contact.user.id)}
                    onChange={(on) => toggle(contact.user.id, on)}
                  />
                }
              />
            ))}
          </SettingsGroup>
        </div>
      )}
    </Modal>
  );
}

/** Mocked: a stable number per pair, with the usual explanation. */
export function SafetyNumberModal({ meId, peerId, name, onClose }: { meId: Id; peerId: Id; name: string; onClose: () => void }) {
  return (
    <Modal
      title="Safety number"
      onClose={onClose}
      actions={
        <Button variant="secondary" onClick={onClose}>
          Done
        </Button>
      }
    >
      <p className={styles.text}>
        Compare this number with {name} on their device to verify that your messages and calls with them are end-to-end encrypted.
      </p>
      <div className={styles.safety} aria-label="Safety number">
        {safetyNumber(meId, peerId).map((group, index) => (
          <span key={index}>{group}</span>
        ))}
      </div>
    </Modal>
  );
}
