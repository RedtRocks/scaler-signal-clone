"use client";

import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import { Avatar, useIsPhone } from "@/components/ui";
import { mediaUrl } from "@/lib/config";
import { callClock, callTitle, gridColumns, type Participant } from "@/lib/calls";
import { useCallStore, useToastStore } from "@/store";
import { CallIcon } from "./CallIcons";
import styles from "./CallScreen.module.css";

const RING_MS = 2200;
const JOIN_EVERY_MS = 1100;

/**
 * The call screen, full window over the app. There is no real audio or video between people
 * (the assignment lists calls as a placeholder): ringing, joining and speaking are simulated,
 * and the self-view is the viewer's own camera when they allow it.
 */
export function CallScreen() {
  const call = useCallStore((s) => s.active);
  if (!call) return null;
  return <ActiveCallScreen key={call.startedIso} />;
}

/** A person's photo filling the tile; initials when there is no photo or it fails to load. */
function TilePicture({ person, size }: { person: Participant; size: number }) {
  const [failed, setFailed] = useState(false);
  const src = mediaUrl(person.avatarUrl);
  if (!src || failed) return <Avatar name={person.name} size={size} />;
  // eslint-disable-next-line @next/next/no-img-element -- stock/profile photos from arbitrary hosts
  return <img className={styles.photo} src={src} alt="" draggable={false} onError={() => setFailed(true)} />;
}

function ActiveCallScreen() {
  const call = useCallStore((s) => s.active)!;
  const { connect, join, end } = useCallStore.getState();
  const phone = useIsPhone();
  const push = useToastStore((s) => s.push);
  const [camera, setCamera] = useState(call.kind === "video");
  const [muted, setMuted] = useState(false);
  const [hand, setHand] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [speaking, setSpeaking] = useState<number | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Ring, then everyone picks up one after another.
  useEffect(() => {
    const ring = setTimeout(connect, RING_MS);
    return () => clearTimeout(ring);
  }, [connect]);
  useEffect(() => {
    if (call.phase !== "connected") return;
    const pending = call.participants.filter((p) => !call.joined.includes(p.id));
    if (pending.length === 0) return;
    const timer = setTimeout(() => join(pending[0].id), call.joined.length === 0 ? 300 : JOIN_EVERY_MS);
    return () => clearTimeout(timer);
  }, [call.phase, call.participants, call.joined, join]);

  // Running clock and a speaker that moves around.
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);
  const joinedCount = call.joined.length;
  useEffect(() => {
    if (joinedCount === 0) return;
    const move = setInterval(() => setSpeaking(Math.floor(Math.random() * joinedCount)), 2200);
    return () => clearInterval(move);
  }, [joinedCount]);

  // Own camera for the self-view.
  useEffect(() => {
    if (!camera) return;
    let cancelled = false;
    let opened: MediaStream | null = null;
    navigator.mediaDevices
      ?.getUserMedia({ video: true })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        opened = s;
        setStream(s);
      })
      .catch(() => {
        if (cancelled) return;
        setCamera(false);
        push("Camera isn't available. Allow camera access to turn video on.");
      });
    return () => {
      cancelled = true;
      opened?.getTracks().forEach((t) => t.stop());
      setStream(null);
    };
  }, [camera, push]);

  // Esc hangs up, like leaving a call window.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && end();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [end]);

  const people = call.participants;
  const present = useMemo(() => people.filter((p) => call.joined.includes(p.id)), [people, call.joined]);
  const connected = call.phase === "connected";
  const seconds = call.connectedAt ? (now - call.connectedAt) / 1000 : 0;
  const status = !connected
    ? "Ringing…"
    : present.length === 0
      ? "Connecting…"
      : call.isGroup
        ? `${present.length + 1} ${present.length + 1 === 1 ? "person" : "people"}`
        : callClock(seconds);
  // Until anyone answers, show who is being called.
  const tiles: (Participant & { waiting?: boolean })[] = present.length > 0 ? present : people.map((p) => ({ ...p, waiting: true }));
  const columns = gridColumns(tiles.length, phone);
  const title = call.isGroup ? call.title : callTitle(people.map((p) => p.name)) || call.title;

  const controls = (
    <>
      {phone ? (
        <button type="button" className={styles.round} aria-label="Flip camera" onClick={() => push("This device has one camera.")}>
          <CallIcon name="flip" size={26} />
        </button>
      ) : null}
      <button
        type="button"
        className={clsx(styles.round, camera && styles.on)}
        aria-label={camera ? "Turn video off" : "Turn video on"}
        aria-pressed={camera}
        onClick={() => setCamera((v) => !v)}
      >
        <CallIcon name={camera ? "video" : "video-off"} size={phone ? 30 : 24} />
      </button>
      <button
        type="button"
        className={clsx(styles.round, muted && styles.on)}
        aria-label={muted ? "Unmute microphone" : "Mute microphone"}
        aria-pressed={muted}
        onClick={() => setMuted((v) => !v)}
      >
        <CallIcon name={muted ? "mic-off" : "mic"} size={phone ? 30 : 24} />
      </button>
      {!phone ? (
        <>
          <button
            type="button"
            className={clsx(styles.round, hand && styles.on)}
            aria-label={hand ? "Lower hand" : "Raise hand"}
            aria-pressed={hand}
            onClick={() => setHand((v) => !v)}
          >
            <CallIcon name="hand" />
          </button>
          <button type="button" className={styles.round} aria-label="Share screen" onClick={() => push("Screen sharing isn't available in this demo.")}>
            <CallIcon name="share" />
          </button>
          <button type="button" className={styles.round} aria-label="React" onClick={() => push("❤️ Reaction sent")}>
            <CallIcon name="react" />
          </button>
        </>
      ) : null}
    </>
  );

  const selfView = (
    <div className={styles.self} aria-label="You">
      {stream && camera ? (
        <video
          className={styles.video}
          autoPlay
          muted
          playsInline
          ref={(el) => {
            if (el && el.srcObject !== stream) el.srcObject = stream;
          }}
        />
      ) : (
        <Avatar name="You" size={phone ? 44 : 56} />
      )}
    </div>
  );

  return (
    <div className={clsx(styles.screen, phone && styles.phone)} role="dialog" aria-modal="true" aria-label={`${call.kind === "video" ? "Video" : "Voice"} call with ${title}`}>
      {phone ? (
        <header className={styles.phoneHeader}>
          <button type="button" className={styles.back} aria-label="Back to chat" onClick={end}>
            ‹
          </button>
          <span className={styles.phoneTitle}>{title}</span>
          <span className={styles.count}>
            <CallIcon name="people" size={22} />
            {present.length + 1}
          </span>
        </header>
      ) : (
        <header className={styles.topRight}>
          <button type="button" className={styles.round} aria-label="Layout" onClick={() => push("Grid layout")}>
            <CallIcon name="grid" size={22} />
          </button>
          <button type="button" className={styles.round} aria-label="Call settings" onClick={() => push("Call settings aren't available in this demo.")}>
            <CallIcon name="settings" size={22} />
          </button>
          <button type="button" className={styles.round} aria-label="Pop out" onClick={() => push("Pop-out isn't available in this demo.")}>
            <CallIcon name="screen" size={22} />
          </button>
        </header>
      )}

      <div className={styles.stage}>
        <div className={styles.grid} style={{ ["--cols" as string]: columns, ["--rows" as string]: Math.max(1, Math.ceil(tiles.length / columns)) }} data-count={tiles.length}>
          {tiles.map((person, index) => (
            <div key={person.id} className={clsx(styles.tile, !person.waiting && speaking === index && styles.speaking, person.waiting && styles.waiting)}>
              <TilePicture person={person} size={phone ? 72 : 96} />
              <span className={styles.name}>{person.name}</span>
              {!person.waiting && speaking === index ? (
                <span className={styles.speakBadge} aria-label="Speaking">
                  <CallIcon name="waveform" size={18} />
                </span>
              ) : null}
            </div>
          ))}
        </div>
        {tiles.length === 0 ? <p className={styles.alone}>Waiting for others to join…</p> : null}
      </div>

      {phone ? (
        <>
          <div className={styles.controlsPhone}>
            {controls}
            <button type="button" className={clsx(styles.round, styles.leave)} aria-label="Leave call" onClick={end}>
              <CallIcon name="hangup" size={30} />
            </button>
          </div>
          <div className={styles.selfPhone}>{selfView}</div>
        </>
      ) : (
        <div className={styles.bottom}>
          <div className={styles.bar}>
            <div className={styles.meta}>
              <span className={styles.callTitle}>{title}</span>
              <span className={styles.callStatus}>{status}</span>
            </div>
            <div className={styles.controls}>{controls}</div>
            <button type="button" className={styles.leaveBtn} onClick={end}>
              Leave
            </button>
          </div>
          {selfView}
        </div>
      )}
    </div>
  );
}
