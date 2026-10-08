"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Avatar, Button, Icon, SettingsGroup, TextField } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { mediaUrl } from "@/lib/config";
import { useAuthStore, useToastStore, useSession } from "@/store";
import styles from "./SettingsScreen.module.css";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const NAME_MAX = 50;
const ABOUT_MAX = 140;

export function ProfileSection() {
  const { me } = useSession();
  const setMe = useAuthStore((s) => s.setMe);
  const toast = useToastStore((s) => s.push);
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(me?.display_name ?? "");
  const [about, setAbout] = useState(me?.about ?? "");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  if (!me) return null;
  const trimmed = name.trim();
  const dirty = trimmed !== me.display_name || about.trim() !== (me.about ?? "");

  async function onAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast("Choose an image file.");
    if (file.size > MAX_AVATAR_BYTES) return toast("Photos can be up to 2 MB.");
    setBusy(true);
    try {
      setMe(await api.uploadAvatar(file));
      toast("Photo updated");
    } catch (e) {
      toast(e instanceof ApiError ? e.detail : "Couldn't upload the photo.");
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!trimmed) return setError("Enter your name.");
    setError(undefined);
    setBusy(true);
    try {
      setMe(await api.updateMe({ display_name: trimmed, about: about.trim() }));
      toast("Profile saved");
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Couldn't save your profile.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <button type="button" className={styles.avatarButton} onClick={() => fileRef.current?.click()} aria-label="Change photo">
        <Avatar name={me.display_name || me.phone} src={mediaUrl(me.avatar_url) ?? undefined} size={96} />
        <span className={styles.avatarBadge}>
          <Icon name="camera" size={18} />
        </span>
      </button>
      <input ref={fileRef} type="file" accept="image/*" className={styles.hidden} onChange={onAvatar} aria-label="Upload photo" />
      <SettingsGroup>
        <div className={styles.form}>
          <TextField
            label="Name"
            value={name}
            maxLength={NAME_MAX}
            autoComplete="name"
            error={error}
            onChange={(e) => setName(e.target.value)}
          />
          <TextField
            label="About"
            value={about}
            maxLength={ABOUT_MAX}
            placeholder="Say something about yourself"
            onChange={(e) => setAbout(e.target.value)}
          />
          <div className={styles.phone}>{me.phone}</div>
        </div>
      </SettingsGroup>
      <div className={styles.actions}>
        <Button type="submit" disabled={busy || !dirty}>
          Save
        </Button>
      </div>
    </form>
  );
}
