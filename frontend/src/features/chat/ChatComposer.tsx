"use client";

import { useRef, useState, type ClipboardEvent, type Ref } from "react";
import { readPreference, usePreference } from "@/features/settings/preferences";
import { Composer, QuoteBlock, StagedAttachments, useIsPhone } from "@/components/ui";
import { FILE_PICKER_ACCEPT, formatFileSize, messageSummary } from "@/lib/attachments";
import { mediaUrl } from "@/lib/config";
import type { Id, Message } from "@/lib/types";
import { notifyTyping, sendMessage, stopTyping, useToastStore } from "@/store";
import { senderColor } from "./chatLogic";
import { getDraft, setDraft } from "./drafts";
import { AttachTray, type AttachChoice } from "./AttachTray";
import { VoiceRecorderBar } from "./VoiceRecorderBar";
import { MicrophoneError, useVoiceRecorder } from "./voiceRecorder";
import { useStaged, useStagingStore } from "./staging";

interface ChatComposerProps {
  conversationId: Id;
  isGroup: boolean;
  replyTo: Message | null;
  /** Display name of whoever wrote `replyTo` ("You" for my own). */
  replyAuthor: string;
  onCancelReply: () => void;
  inputRef: Ref<HTMLTextAreaElement>;
}

/** The message box for one conversation: draft per conversation, staged files, typing signals, reply strip. */
export function ChatComposer({ conversationId, isGroup, replyTo, replyAuthor, onCancelReply, inputRef }: ChatComposerProps) {
  const phone = useIsPhone();
  const [enterSends] = usePreference("enterSends");
  const push = useToastStore((state) => state.push);
  const [text, setText] = useState(() => getDraft(conversationId));
  const staged = useStaged(conversationId);
  const picker = useRef<HTMLInputElement>(null);
  const [trayOpen, setTrayOpen] = useState(false);

  const update = (next: string) => {
    setText(next);
    setDraft(conversationId, next);
  };

  const stage = (files: File[]) => useStagingStore.getState().add(conversationId, files);

  // Pasting an image (screenshot, copied picture) stages it; pasting text behaves as usual.
  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData.files);
    if (files.length === 0) return;
    event.preventDefault();
    stage(files);
  };

  const recorder = useVoiceRecorder({
    onRecorded: (file) => {
      const reply = replyTo;
      onCancelReply();
      void sendMessage(conversationId, "", reply, [file]);
    },
    onTooShort: () => push("Voice message too short. Hold on a little longer."),
  });

  const startRecording = () => {
    recorder.start().catch((error) => push(error instanceof MicrophoneError ? error.message : "Couldn't start recording."));
  };

  const choose = (choice: AttachChoice) => {
    setTrayOpen(false);
    if (choice === "contact" || choice === "location") return push(`Sharing a ${choice} isn't available in this demo.`);
    const input = picker.current;
    if (!input) return;
    input.accept = choice === "photos" ? "image/*" : choice === "gif" ? "image/gif" : FILE_PICKER_ACCEPT;
    input.click();
  };

  const quotedImage = replyTo?.attachments.find((attachment) => attachment.content_type.startsWith("image/"));

  return (
    <div onBlurCapture={() => stopTyping(conversationId)}>
      <input
        ref={picker}
        type="file"
        multiple
        hidden
        accept={FILE_PICKER_ACCEPT}
        aria-label="Choose files to attach"
        data-testid="file-input"
        onChange={(event) => {
          stage(Array.from(event.target.files ?? []));
          event.target.value = ""; // picking the same file twice must fire again
        }}
      />
      <Composer
        layout={phone ? "mobile" : "desktop"}
        value={text}
        onChange={update}
        onTyping={() => {
          if (readPreference("typingIndicators")) notifyTyping(conversationId);
        }}
        inputRef={inputRef}
        autoFocus={!phone}
        enterSends={enterSends}
        canSendEmpty={staged.length > 0}
        onPaste={onPaste}
        onSend={(body) => {
          const reply = replyTo;
          onCancelReply();
          const files = useStagingStore.getState().take(conversationId);
          void sendMessage(conversationId, body, reply, files);
        }}
        onAttach={() => (phone ? setTrayOpen((open) => !open) : picker.current?.click())}
        tray={phone && trayOpen ? <AttachTray onChoose={choose} /> : undefined}
        onEmoji={() => push("Emoji picker is coming soon")}
        onSticker={() => push("Stickers are coming soon")}
        onVoice={startRecording}
        recording={
          recorder.state.status === "recording" ? (
            <VoiceRecorderBar
              elapsedMs={recorder.state.elapsedMs}
              onCancel={() => recorder.stop(false)}
              onSend={() => recorder.stop(true)}
            />
          ) : undefined
        }
        onCamera={() => push("Camera is coming soon")}
        staged={
          <StagedAttachments
            items={staged.map(({ id, file, previewUrl }) => ({
              key: id,
              name: file.name,
              previewSrc: previewUrl ?? undefined,
              detail: formatFileSize(file.size),
            }))}
            onRemove={(key) => useStagingStore.getState().remove(conversationId, String(key))}
          />
        }
        quote={
          replyTo ? (
            <QuoteBlock
              author={replyAuthor}
              text={replyTo.deleted ? "This message was deleted." : messageSummary(replyTo)}
              thumbnail={replyTo.deleted || !quotedImage ? undefined : (mediaUrl(quotedImage.url) ?? undefined)}
              color={isGroup && replyAuthor !== "You" ? senderColor(replyTo.sender_id) : undefined}
              onClose={onCancelReply}
            />
          ) : null
        }
      />
    </div>
  );
}
