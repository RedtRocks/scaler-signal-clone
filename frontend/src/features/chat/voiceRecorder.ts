"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { withDuration } from "@/lib/attachments";

/** Recording formats the server accepts, best first. Safari only does mp4, the rest webm. */
const FORMATS: { mime: string; type: string; extension: string }[] = [
  { mime: "audio/webm;codecs=opus", type: "audio/webm", extension: "weba" },
  { mime: "audio/webm", type: "audio/webm", extension: "weba" },
  { mime: "audio/mp4", type: "audio/mp4", extension: "m4a" },
];

export const MAX_VOICE_MS = 5 * 60 * 1000;
const MIN_VOICE_MS = 500;

export type RecorderState =
  | { status: "idle" }
  | { status: "recording"; elapsedMs: number };

export class MicrophoneError extends Error {}

interface RecorderHandlers {
  /** A finished recording to send. */
  onRecorded: (file: File) => void;
  /** The user stopped before half a second. */
  onTooShort: () => void;
}

/** Records a voice message from the microphone. `stop(true)` hands the file to `onRecorded`; `stop(false)` discards. */
export function useVoiceRecorder(handlers: RecorderHandlers) {
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });
  const [state, setState] = useState<RecorderState>({ status: "idle" });
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const format = useRef(FORMATS[0]);
  const keep = useRef(true);

  const release = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    recorder.current?.stream.getTracks().forEach((track) => track.stop());
    recorder.current = null;
    setState({ status: "idle" });
  }, []);

  const start = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      throw new MicrophoneError("Voice messages aren't supported in this browser.");
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      throw new MicrophoneError("Allow microphone access to record a voice message.");
    }
    format.current = FORMATS.find((f) => MediaRecorder.isTypeSupported(f.mime)) ?? FORMATS[0];
    const next = new MediaRecorder(stream, { mimeType: format.current.mime });
    chunks.current = [];
    keep.current = true;
    next.ondataavailable = (event) => event.data.size > 0 && chunks.current.push(event.data);
    next.onstop = () => {
      const elapsed = Date.now() - startedAt.current;
      const blob = new Blob(chunks.current, { type: format.current.type });
      release();
      if (!keep.current) return;
      if (elapsed < MIN_VOICE_MS || blob.size === 0) return handlersRef.current.onTooShort();
      const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
      const file = new File([blob], `Voice message ${stamp}.${format.current.extension}`, { type: format.current.type });
      handlersRef.current.onRecorded(withDuration(file, elapsed));
    };
    recorder.current = next;
    startedAt.current = Date.now();
    next.start();
    setState({ status: "recording", elapsedMs: 0 });
    timer.current = setInterval(() => {
      const elapsedMs = Date.now() - startedAt.current;
      setState({ status: "recording", elapsedMs });
      if (elapsedMs >= MAX_VOICE_MS && next.state === "recording") next.stop();
    }, 200);
  }, [release]);

  const stop = useCallback((send: boolean) => {
    const active = recorder.current;
    if (!active || active.state === "inactive") return;
    keep.current = send;
    active.stop();
  }, []);

  // Leaving the chat while recording throws the recording away.
  useEffect(
    () => () => {
      keep.current = false;
      if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );

  return { state, start, stop };
}
