"use client";

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { Button, Icon } from "@/components/ui";
import { ApiError } from "@/lib/api";
import type { StoryBackground } from "@/lib/types";
import { useStoryStore, useToastStore } from "@/store";
import { STORY_BACKGROUNDS, STORY_MAX_LENGTH, STORY_PHOTO_TYPES, storyPhotoProblem } from "./storyLogic";
import styles from "./Stories.module.css";

/** Story editor: a text card (pick a background) or a photo with a caption. Sends to My Stories. */
export function StoryComposer({ mode, onClose }: { mode: "text" | "photo"; onClose: () => void }) {
  return mode === "photo" ? <PhotoStoryComposer onClose={onClose} /> : <TextStoryComposer onClose={onClose} />;
}

/** Opens the file picker at once; the editor appears once a picture is chosen, closing if none is. */
function PhotoStoryComposer({ onClose }: { onClose: () => void }) {
  const postPhoto = useStoryStore((s) => s.postPhoto);
  const push = useToastStore((s) => s.push);
  const picker = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<{ file: File; preview: string } | null>(null);
  const [caption, setCaption] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const input = picker.current;
    input?.addEventListener("cancel", onClose); // the picker was dismissed without a choice
    input?.click();
    return () => input?.removeEventListener("cancel", onClose);
  }, [onClose]);
  const previewUrl = picked?.preview;
  useEffect(() => () => (previewUrl ? URL.revokeObjectURL(previewUrl) : undefined), [previewUrl]);

  const choose = (chosen: File | undefined) => {
    if (!chosen) return onClose();
    const problem = storyPhotoProblem(chosen);
    if (problem) {
      push(problem);
      return onClose();
    }
    setPicked({ file: chosen, preview: URL.createObjectURL(chosen) });
  };

  const send = async () => {
    if (!picked) return;
    setSending(true);
    try {
      await postPhoto(picked.file, caption.trim());
      push("Story sent");
      onClose();
    } catch (error) {
      setSending(false);
      push(error instanceof ApiError && error.detail ? error.detail : "Couldn't send the story.");
    }
  };

  return (
    <>
      <input
        ref={picker}
        type="file"
        hidden
        accept={STORY_PHOTO_TYPES.join(",")}
        aria-label="Choose a picture for your story"
        data-testid="story-photo-input"
        onChange={(e) => choose(e.target.files?.[0])}
      />
      {picked ? (
        <div className={styles.viewer} role="dialog" aria-label="New photo story">
          <div className={clsx(styles.backdrop)} style={{ backgroundImage: `url(${picked.preview})` }} />
          <div className={clsx(styles.card, styles.bg_ink)}>
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
            <img className={styles.storyPhoto} src={picked.preview} alt="Your story" />
            <div className={styles.viewerHeader}>
              <span className={styles.viewerName}>Photo story</span>
              <span className={styles.spacer} />
              <button type="button" className={styles.viewerButton} aria-label="Close" onClick={onClose}>
                <Icon name="close" size={22} />
              </button>
            </div>
            <span className={styles.spacer} />
            <div className={styles.captionBar}>
              <input
                className={styles.captionInput}
                placeholder="Add a caption"
                aria-label="Caption"
                value={caption}
                maxLength={STORY_MAX_LENGTH}
                autoFocus
                onChange={(e) => setCaption(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void send();
                  if (e.key === "Escape") onClose();
                }}
              />
              <Button onClick={() => void send()} disabled={sending}>
                Send to My Stories
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function TextStoryComposer({ onClose }: { onClose: () => void }) {
  const post = useStoryStore((s) => s.post);
  const push = useToastStore((s) => s.push);
  const [text, setText] = useState("");
  const [background, setBackground] = useState<StoryBackground>("ultramarine");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      await post(text.trim(), background);
      push("Story sent");
      onClose();
    } catch (error) {
      setSending(false);
      push(error instanceof ApiError && error.detail ? error.detail : "Couldn't send the story.");
    }
  };

  return (
    <div className={styles.viewer} role="dialog" aria-label="New text story">
      <div className={clsx(styles.card, styles[`bg_${background}`])}>
        <div className={styles.viewerHeader}>
          <span className={styles.viewerName}>Text story</span>
          <span className={styles.spacer} />
          <button type="button" className={styles.viewerButton} aria-label="Close" onClick={onClose}>
            <Icon name="close" size={22} />
          </button>
        </div>
        <textarea
          className={styles.storyInput}
          placeholder="Add text"
          value={text}
          autoFocus
          maxLength={STORY_MAX_LENGTH}
          aria-label="Story text"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send();
          }}
        />
        <div className={styles.composerBar}>
          <div className={styles.swatches} role="radiogroup" aria-label="Background">
            {STORY_BACKGROUNDS.map((name) => (
              <button
                key={name}
                type="button"
                role="radio"
                aria-checked={background === name}
                aria-label={name}
                className={clsx(styles.swatch, styles[`bg_${name}`], background === name && styles.swatchActive)}
                onClick={() => setBackground(name)}
              />
            ))}
          </div>
          <Button onClick={() => void send()} disabled={sending || !text.trim()}>
            Send to My Stories
          </Button>
        </div>
      </div>
    </div>
  );
}
