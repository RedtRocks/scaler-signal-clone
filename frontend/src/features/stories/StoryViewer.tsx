"use client";

import clsx from "clsx";
import { useCallback, useEffect, useState } from "react";
import { Avatar, Icon } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { mediaUrl } from "@/lib/config";
import type { Id, Story } from "@/lib/types";
import { useStoryStore, useToastStore } from "@/store";
import { firstUnviewedIndex, STORY_DURATION_MS, storyAge } from "./storyLogic";
import styles from "./Stories.module.css";

interface StoryViewerProps {
  /** Each entry is one author's stories, oldest first. */
  queue: Story[][];
  startGroup: number;
  meId: Id | undefined;
  onClose: () => void;
}

/** Full-screen player: progress bars, tap or arrow keys to step, Space to pause, Esc to close. */
export function StoryViewer({ queue, startGroup, meId, onClose }: StoryViewerProps) {
  const markViewed = useStoryStore((s) => s.markViewed);
  const remove = useStoryStore((s) => s.remove);
  const push = useToastStore((s) => s.push);
  const [group, setGroup] = useState(startGroup);
  const [index, setIndex] = useState(() => firstUnviewedIndex(queue[startGroup] ?? []));
  const [paused, setPaused] = useState(false);
  const [showViews, setShowViews] = useState(false);

  const stories = queue[group] ?? [];
  const story = stories[index];
  const mine = story?.author.id === meId;

  const next = useCallback(() => {
    if (index + 1 < stories.length) return setIndex(index + 1);
    if (group + 1 < queue.length) {
      setGroup(group + 1);
      setIndex(firstUnviewedIndex(queue[group + 1]));
      return;
    }
    onClose();
  }, [index, stories.length, group, queue, onClose]);

  const previous = useCallback(() => {
    if (index > 0) return setIndex(index - 1);
    if (group > 0) {
      setGroup(group - 1);
      setIndex(queue[group - 1].length - 1);
    }
  }, [index, group, queue]);

  useEffect(() => {
    if (story && !mine) markViewed(story.id);
  }, [story, mine, markViewed]);

  useEffect(() => {
    if (paused || showViews || !story) return;
    const timer = setTimeout(next, STORY_DURATION_MS);
    return () => clearTimeout(timer);
  }, [story, paused, showViews, next]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowRight") next();
      else if (event.key === "ArrowLeft") previous();
      else if (event.key === " ") {
        event.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, previous, onClose]);

  if (!story) return null;
  const name = mine ? "My Stories" : story.author.display_name || story.author.phone;

  const deleteStory = () => {
    remove(story.id)
      .then(() => (stories.length > 1 ? setIndex(Math.max(0, index - 1)) : onClose()))
      .catch((error) => push(error instanceof ApiError && error.detail ? error.detail : "Couldn't delete the story."));
  };

  return (
    <div className={styles.viewer} role="dialog" aria-label={`Story from ${name}`}>
      <div className={clsx(styles.card, styles[`bg_${story.background}`])}>
        <div className={styles.progress}>
          {stories.map((s, i) => (
            <span key={s.id} className={styles.track}>
              <span
                key={`${s.id}-${i === index ? "now" : "idle"}`}
                className={clsx(styles.fill, i < index && styles.fillDone, i === index && styles.fillRunning, i === index && (paused || showViews) && styles.fillPaused)}
                style={i === index ? { animationDuration: `${STORY_DURATION_MS}ms` } : undefined}
              />
            </span>
          ))}
        </div>

        <div className={styles.viewerHeader}>
          <Avatar name={story.author.display_name || story.author.phone} src={mediaUrl(story.author.avatar_url) ?? undefined} size={32} />
          <span className={styles.viewerName}>{name}</span>
          <span className={styles.viewerAge}>{storyAge(story.created_at)}</span>
          <span className={styles.spacer} />
          <button type="button" className={styles.viewerButton} aria-label={paused ? "Play" : "Pause"} onClick={() => setPaused((p) => !p)}>
            {paused ? "▶" : "❚❚"}
          </button>
          {mine ? (
            <button type="button" className={styles.viewerButton} aria-label="Delete story" onClick={deleteStory}>
              <Icon name="trash" size={20} />
            </button>
          ) : null}
          <button type="button" className={styles.viewerButton} aria-label="Close" onClick={onClose}>
            <Icon name="close" size={22} />
          </button>
        </div>

        <button type="button" className={styles.tapLeft} aria-label="Previous story" onClick={previous} />
        <p className={styles.storyText}>{story.body}</p>
        <button type="button" className={styles.tapRight} aria-label="Next story" onClick={next} />

        {mine ? (
          <button type="button" className={styles.viewsButton} onClick={() => setShowViews((v) => !v)}>
            {story.views?.length ?? 0} {story.views?.length === 1 ? "view" : "views"}
          </button>
        ) : null}

        {mine && showViews ? (
          <div className={styles.viewsSheet}>
            <h2 className={styles.viewsTitle}>Viewed by</h2>
            {story.views?.length ? (
              <ul className={styles.viewsList}>
                {story.views.map((view) => (
                  <li key={view.user.id} className={styles.viewsRow}>
                    <Avatar name={view.user.display_name || view.user.phone} src={mediaUrl(view.user.avatar_url) ?? undefined} size={32} />
                    <span>{view.user.display_name || view.user.phone}</span>
                    <span className={styles.viewerAge}>{storyAge(view.viewed_at)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.viewsEmpty}>No views yet.</p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
