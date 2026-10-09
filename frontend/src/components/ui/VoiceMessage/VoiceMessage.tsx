"use client";

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import styles from "./VoiceMessage.module.css";

export interface VoiceMessageProps {
  src: string;
  durationMs: number;
  /** Seeds the waveform shape so each voice message always looks the same. */
  seed: number;
  /** Incoming ones show a dot until they were played once. */
  incoming?: boolean;
  /** "1:32" formatter (injected so the component stays free of app code). */
  formatClock: (ms: number) => string;
  /** 0..1 while the file is still uploading. */
  uploading?: boolean;
}

const BARS = 44;

/** Same input, same bars: a small deterministic generator (mulberry32). */
export function waveform(seed: number, count = BARS): number[] {
  let a = (seed * 2654435761) >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let level = 0.5;
  return Array.from({ length: count }, () => {
    // A random walk reads like speech: swells and pauses instead of noise.
    level = Math.min(1, Math.max(0.12, level + (next() - 0.5) * 0.7));
    return level;
  });
}

// Only one voice message plays at a time.
let playing: HTMLAudioElement | null = null;

/** A Signal voice message: round play button, waveform that fills as it plays, length and time. */
export function VoiceMessage({ src, durationMs, seed, incoming, formatClock, uploading }: VoiceMessageProps) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [active, setActive] = useState(false);
  const [position, setPosition] = useState(0); // ms
  const [heard, setHeard] = useState(false);
  const bars = waveform(seed);

  useEffect(
    () => () => {
      const el = audio.current;
      if (el) {
        el.pause();
        if (playing === el) playing = null;
      }
    },
    [],
  );

  const toggle = () => {
    if (uploading) return;
    let el = audio.current;
    if (!el) {
      el = new Audio(src);
      el.preload = "metadata";
      el.addEventListener("timeupdate", () => setPosition(el!.currentTime * 1000));
      el.addEventListener("ended", () => {
        setActive(false);
        setPosition(0);
        if (playing === el) playing = null;
      });
      el.addEventListener("pause", () => setActive(false));
      el.addEventListener("play", () => setActive(true));
      audio.current = el;
    }
    if (el.paused) {
      if (playing && playing !== el) playing.pause();
      playing = el;
      setHeard(true);
      void el.play().catch(() => setActive(false));
    } else {
      el.pause();
    }
  };

  const seek = (event: React.MouseEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    const el = audio.current;
    if (el && Number.isFinite(el.duration)) el.currentTime = fraction * el.duration;
    else setPosition(fraction * durationMs);
  };

  const progress = durationMs > 0 ? Math.min(1, position / durationMs) : 0;
  const shown = active || position > 0 ? durationMs - position : durationMs;

  return (
    <div className={styles.root}>
      <button
        type="button"
        className={styles.play}
        aria-label={active ? "Pause voice message" : "Play voice message"}
        onClick={toggle}
        disabled={uploading}
      >
        {active ? (
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
            <rect x="3.5" y="2.5" width="3.8" height="13" rx="1" fill="currentColor" />
            <rect x="10.7" y="2.5" width="3.8" height="13" rx="1" fill="currentColor" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
            <path d="M5 2.8v12.4a.8.8 0 0 0 1.2.7l9.4-6.2a.8.8 0 0 0 0-1.4L6.2 2.1A.8.8 0 0 0 5 2.8z" fill="currentColor" />
          </svg>
        )}
      </button>
      <div className={styles.body}>
        <div
          className={styles.wave}
          role="slider"
          aria-label="Voice message position"
          aria-valuemin={0}
          aria-valuemax={Math.round(durationMs / 1000)}
          aria-valuenow={Math.round(position / 1000)}
          onClick={seek}
        >
          {bars.map((height, index) => (
            <span
              key={index}
              className={clsx(styles.bar, index / bars.length < progress && styles.played)}
              style={{ height: `${Math.round(height * 100)}%` }}
            />
          ))}
          <span className={styles.head} style={{ left: `${progress * 100}%` }} />
        </div>
        <span className={styles.clock}>
          {formatClock(shown)}
          {incoming && !heard ? <span className={styles.dot} aria-label="Not played yet" /> : null}
        </span>
      </div>
    </div>
  );
}
