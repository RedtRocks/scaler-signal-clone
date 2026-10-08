"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Toast } from "../Toast/Toast";
import styles from "./ToastViewport.module.css";

export interface ToastMessage {
  /** Unique per show; a new id restarts the timer. */
  id: string | number;
  message: string;
  action?: string;
  onAction?: () => void;
}

export interface ToastViewportProps {
  /** The one toast to show (null = none). */
  toast: ToastMessage | null;
  /** Called after `duration` ms, or after the action is clicked. */
  onDismiss: (id: ToastMessage["id"]) => void;
  duration?: number;
}

/** Fixed bottom-centre slot showing one toast at a time; auto-dismisses after ~4s (paused on hover). */
export function ToastViewport({ toast, onDismiss, duration = 4000 }: ToastViewportProps) {
  const [paused, setPaused] = useState(false);
  const dismissRef = useRef(onDismiss);
  useEffect(() => {
    dismissRef.current = onDismiss;
  });

  useEffect(() => {
    if (!toast || paused) return;
    const t = window.setTimeout(() => dismissRef.current(toast.id), duration);
    return () => window.clearTimeout(t);
  }, [toast, paused, duration]);

  return (
    <div
      className={styles.viewport}
      aria-live="polite"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {toast ? (
        <div key={toast.id} className={styles.slot}>
          <Toast
            action={toast.action}
            onAction={() => {
              toast.onAction?.();
              onDismiss(toast.id);
            }}
          >
            {toast.message}
          </Toast>
        </div>
      ) : null}
    </div>
  );
}

/** Local convenience state for a ToastViewport (a store can replace it). */
export function useToast() {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const seq = useRef(0);
  const show = useCallback((message: string, opts?: Pick<ToastMessage, "action" | "onAction">) => {
    seq.current += 1;
    setToast({ id: seq.current, message, ...opts });
  }, []);
  const dismiss = useCallback((id?: ToastMessage["id"]) => {
    setToast((t) => (id === undefined || t?.id === id ? null : t));
  }, []);
  return { toast, show, dismiss };
}
