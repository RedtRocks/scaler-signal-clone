"use client";

import clsx from "clsx";
import {
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from "react";
import { Button } from "../Button/Button";
import { Icon } from "../Icon/Icon";
import styles from "./Composer.module.css";

export interface ComposerProps {
  /** desktop: emoji · [Message] · sticker · mic · attach. mobile: + · [Message ☺] · camera · mic. */
  layout?: "desktop" | "mobile";
  placeholder?: string;
  defaultValue?: string;
  /** Controlled mode (e.g. per-conversation drafts). Pair with onChange. */
  value?: string;
  onChange?: (text: string) => void;
  /** Called with the trimmed text; the composer clears itself in uncontrolled mode. */
  onSend?: (text: string) => void;
  /** Throttled: at most once every `typingThrottleMs` while the user types. */
  onTyping?: () => void;
  typingThrottleMs?: number;
  /** Slot above the input row: the QuoteBlock "Replying to" bar. */
  quote?: ReactNode;
  /** Slot above the quote and the input row: files waiting to be sent (StagedAttachments). */
  staged?: ReactNode;
  /** Sending is allowed with an empty text box (there is something staged). */
  canSendEmpty?: boolean;
  /** Paste into the input; the host can take files out of `event.clipboardData`. */
  onPaste?: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  onAttach?: () => void;
  onEmoji?: () => void;
  onSticker?: () => void;
  onVoice?: () => void;
  onCamera?: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
  /** true (default): Enter sends, Shift+Enter breaks the line. false: Enter breaks the line, Ctrl/Cmd+Enter sends. */
  enterSends?: boolean;
  inputRef?: Ref<HTMLTextAreaElement>;
}

const MAX_HEIGHT = 160;

export function Composer({
  layout = "desktop",
  placeholder = "Message",
  defaultValue = "",
  value: controlled,
  onChange,
  onSend,
  onTyping,
  typingThrottleMs = 2000,
  quote,
  staged,
  canSendEmpty,
  onPaste,
  onAttach,
  onEmoji,
  onSticker,
  onVoice,
  onCamera,
  disabled,
  autoFocus,
  enterSends = true,
  inputRef,
}: ComposerProps) {
  const [internal, setInternal] = useState(defaultValue);
  const value = controlled ?? internal;
  const lastTyping = useRef(0);
  const areaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-grow the textarea up to MAX_HEIGHT.
  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, [value, layout]);

  const setValue = (v: string) => {
    if (controlled === undefined) setInternal(v);
    onChange?.(v);
  };

  const send = () => {
    const text = value.trim();
    if ((!text && !canSendEmpty) || disabled) return;
    onSend?.(text);
    setValue("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    const wantsSend = enterSends ? !e.shiftKey : e.ctrlKey || e.metaKey;
    if (wantsSend) {
      e.preventDefault();
      send();
    }
  };

  useImperativeHandle(inputRef, () => areaRef.current as HTMLTextAreaElement, []);

  const input = (
    <textarea
      ref={areaRef}
      rows={1}
      className={styles.input}
      placeholder={placeholder}
      aria-label="Message"
      value={value}
      disabled={disabled}
      autoFocus={autoFocus}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      onChange={(e) => {
        setValue(e.target.value);
        const now = Date.now();
        if (onTyping && e.target.value && now - lastTyping.current > typingThrottleMs) {
          lastTyping.current = now;
          onTyping();
        }
      }}
    />
  );

  const hasText = value.trim().length > 0 || Boolean(canSendEmpty);
  const sendBtn = (
    <button type="button" className={styles.send} aria-label="Send" onClick={send} disabled={disabled}>
      <Icon name="send" size={layout === "mobile" ? 32 : 36} />
    </button>
  );

  return (
    <div className={clsx(styles.composer, layout === "mobile" && styles.mobile)}>
      {staged}
      {quote ? <div className={styles.quote}>{quote}</div> : null}
      {layout === "mobile" ? (
        <div className={styles.row}>
          <Button variant="icon" icon="plus" iconSize={22} aria-label="Attach" onClick={onAttach} />
          <div className={styles.field}>
            {input}
            <Button variant="icon" icon="sticker" iconSize={20} className={styles.inner} aria-label="Stickers" onClick={onSticker} />
          </div>
          {hasText ? (
            sendBtn
          ) : (
            <>
              <Button variant="icon" icon="camera-composer" iconSize={26} aria-label="Camera" onClick={onCamera} />
              <Button variant="icon" icon="mic" iconSize={26} aria-label="Voice message" onClick={onVoice} />
            </>
          )}
        </div>
      ) : (
        <div className={styles.row}>
          <Button variant="icon" icon="smile" aria-label="Emoji" onClick={onEmoji} />
          <div className={styles.field}>{input}</div>
          {hasText ? (
            sendBtn
          ) : (
            <>
              <Button variant="icon" icon="sticker" iconSize={22} aria-label="Stickers" onClick={onSticker} />
              <Button variant="icon" icon="mic" iconSize={26} aria-label="Voice message" onClick={onVoice} />
            </>
          )}
          <Button variant="icon" icon="plus" iconSize={22} aria-label="Attach" onClick={onAttach} />
        </div>
      )}
    </div>
  );
}
