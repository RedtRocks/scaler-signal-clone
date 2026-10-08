"use client";

import clsx from "clsx";
import { useState } from "react";
import { Button, Icon } from "@/components/ui";
import { ApiError } from "@/lib/api";
import type { StoryBackground } from "@/lib/types";
import { useStoryStore, useToastStore } from "@/store";
import { STORY_BACKGROUNDS, STORY_MAX_LENGTH } from "./storyLogic";
import styles from "./Stories.module.css";

/** Text story editor: type on a coloured card, pick a background, send to My Stories. */
export function StoryComposer({ onClose }: { onClose: () => void }) {
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
