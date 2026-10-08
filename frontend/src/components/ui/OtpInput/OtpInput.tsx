"use client";

import clsx from "clsx";
import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import styles from "./OtpInput.module.css";

export interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Fired when all digits are filled (typing or paste). */
  onComplete?: (value: string) => void;
  length?: number;
  error?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function OtpInput({ value, onChange, onComplete, length = 6, error, disabled, autoFocus }: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  // The value we just committed. `value` is stale until the parent re-renders, but focus moves first.
  const committed = useRef(value);
  useEffect(() => {
    committed.current = value;
  }, [value]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  const commit = (next: string, focusIndex: number) => {
    const clean = next.replace(/\D/g, "").slice(0, length);
    committed.current = clean;
    onChange(clean);
    refs.current[Math.min(focusIndex, length - 1)]?.focus();
    if (clean.length === length) onComplete?.(clean);
  };

  const setAt = (i: number, d: string) => {
    const arr = digits.slice();
    arr[i] = d;
    return arr.join("");
  };

  const onKeyDown = (i: number) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[i]) commit(setAt(i, ""), i);
      else if (i > 0) commit(setAt(i - 1, ""), i - 1);
    } else if (e.key === "ArrowLeft" && i > 0) {
      refs.current[i - 1]?.focus();
    } else if (e.key === "ArrowRight" && i < length - 1) {
      refs.current[i + 1]?.focus();
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!text) return;
    e.preventDefault();
    commit(text, text.length);
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.boxes} role="group" aria-label="Verification code">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            className={clsx(styles.box, error && styles.invalid, i === 2 && length === 6 && styles.gapAfter)}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            pattern="[0-9]*"
            maxLength={length}
            aria-label={`Digit ${i + 1}`}
            aria-invalid={error ? true : undefined}
            value={d}
            disabled={disabled}
            autoFocus={autoFocus && i === 0}
            onFocus={(e) => {
              // Keep digits contiguous: jump to the first empty box.
              if (i > committed.current.length) refs.current[committed.current.length]?.focus();
              else e.currentTarget.select();
            }}
            onKeyDown={onKeyDown(i)}
            onPaste={onPaste}
            onChange={(e) => {
              const typed = e.target.value.replace(/\D/g, "");
              if (!typed) return;
              if (typed.length > 1) {
                // autofill / fast typing into one box
                commit(value.slice(0, i) + typed, i + typed.length);
              } else {
                commit(setAt(i, typed), i + 1);
              }
            }}
          />
        ))}
      </div>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
