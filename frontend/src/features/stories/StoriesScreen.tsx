"use client";

import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import { Avatar, DropdownMenu, Spinner } from "@/components/ui";
import { mediaUrl } from "@/lib/config";
import type { Story } from "@/lib/types";
import { useAuthStore, useStoryStore, useToastStore } from "@/store";
import { StoryComposer } from "./StoryComposer";
import { StoryViewer } from "./StoryViewer";
import { groupStories, storyAge, type StoryGroup } from "./storyLogic";
import styles from "./Stories.module.css";

const REFRESH_MS = 30_000;

/** The Stories tab: My Stories, then other people's stories (unviewed first), a viewer and a text-story composer. */
export function StoriesScreen() {
  const me = useAuthStore((s) => s.me);
  const { stories, loaded, load } = useStoryStore();
  const push = useToastStore((s) => s.push);
  const [composing, setComposing] = useState<"text" | "photo" | null>(null);
  const [playing, setPlaying] = useState<{ queue: Story[][]; group: number } | null>(null);

  useEffect(() => {
    const refresh = () => load().catch(() => push("Couldn't load stories."));
    void refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load, push]);

  const { mine, unviewed, viewed } = useMemo(() => groupStories(stories, me?.id), [stories, me?.id]);
  const others = [...unviewed, ...viewed];

  // Playing one person's stories continues into the next person's, like Signal.
  const play = (group: StoryGroup) => {
    const queue = others.map((g) => g.stories);
    setPlaying({ queue, group: others.indexOf(group) });
  };

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>Stories</h1>
        <DropdownMenu
          label="Add a story"
          icon="edit"
          items={[
            { label: "Photo story", icon: "camera", onSelect: () => setComposing("photo") },
            { label: "Text story", icon: "edit", onSelect: () => setComposing("text") },
          ]}
        />
      </header>

      <div className={styles.scroll}>
        <button
          type="button"
          className={styles.row}
          onClick={() => (mine.length ? setPlaying({ queue: [mine], group: 0 }) : setComposing("text"))}
        >
          <span className={clsx(styles.ring, mine.length > 0 && styles.ringViewed)}>
            <Avatar name={me?.display_name ?? "Me"} src={mediaUrl(me?.avatar_url ?? null) ?? undefined} size={48} />
            {mine.length === 0 ? (
              <span className={styles.addBadge} aria-hidden>
                +
              </span>
            ) : null}
          </span>
          <span className={styles.text}>
            <span className={styles.name}>My Stories</span>
            <span className={styles.sub}>
              {mine.length ? `${mine.length} ${mine.length === 1 ? "story" : "stories"} · ${storyAge(mine[mine.length - 1].created_at)}` : "Tap to add a story"}
            </span>
          </span>
        </button>

        {!loaded ? (
          <div className={styles.center}>
            <Spinner size={24} />
          </div>
        ) : null}

        {unviewed.length ? <h2 className={styles.section}>Recent</h2> : null}
        {unviewed.map((group) => (
          <StoryRow key={group.author.id} group={group} onOpen={() => play(group)} />
        ))}

        {viewed.length ? <h2 className={styles.section}>Viewed</h2> : null}
        {viewed.map((group) => (
          <StoryRow key={group.author.id} group={group} onOpen={() => play(group)} />
        ))}

        {loaded && others.length === 0 ? (
          <p className={styles.empty}>No recent stories. Stories from people you chat with appear here for 24 hours.</p>
        ) : null}
      </div>

      {composing ? <StoryComposer mode={composing} onClose={() => setComposing(null)} /> : null}
      {playing ? (
        <StoryViewer
          queue={playing.queue}
          startGroup={playing.group}
          meId={me?.id}
          onClose={() => setPlaying(null)}
        />
      ) : null}
    </div>
  );
}

function StoryRow({ group, onOpen }: { group: StoryGroup; onOpen: () => void }) {
  const name = group.author.display_name || group.author.phone;
  const latest = group.stories[group.stories.length - 1];
  return (
    <button type="button" className={styles.row} onClick={onOpen}>
      <span className={clsx(styles.ring, group.viewed ? styles.ringViewed : styles.ringUnviewed)}>
        <Avatar name={name} src={mediaUrl(group.author.avatar_url) ?? undefined} size={48} />
      </span>
      <span className={styles.text}>
        <span className={styles.name}>{name}</span>
        <span className={styles.sub}>{storyAge(latest.created_at)}</span>
      </span>
      <span className={clsx(styles.thumb, styles[`bg_${latest.background}`])} aria-hidden>
        {latest.media_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- story pictures come from the API origin
          <img className={styles.thumbPhoto} src={mediaUrl(latest.media_url) ?? ""} alt="" />
        ) : (
          Array.from(latest.body).slice(0, 24).join("")
        )}
      </span>
    </button>
  );
}
