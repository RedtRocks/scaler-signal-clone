"use client";

import { useState, type Ref } from "react";
import { Composer, QuoteBlock, useIsPhone } from "@/components/ui";
import type { Id, Message } from "@/lib/types";
import { notifyTyping, sendMessage, stopTyping, useToastStore } from "@/store";
import { senderColor } from "./chatLogic";
import { getDraft, setDraft } from "./drafts";

interface ChatComposerProps {
  conversationId: Id;
  isGroup: boolean;
  replyTo: Message | null;
  /** Display name of whoever wrote `replyTo` ("You" for my own). */
  replyAuthor: string;
  onCancelReply: () => void;
  inputRef: Ref<HTMLTextAreaElement>;
}

/** The message box for one conversation: draft per conversation, typing signals, reply strip. */
export function ChatComposer({ conversationId, isGroup, replyTo, replyAuthor, onCancelReply, inputRef }: ChatComposerProps) {
  const phone = useIsPhone();
  const push = useToastStore((state) => state.push);
  const [text, setText] = useState(() => getDraft(conversationId));

  const update = (next: string) => {
    setText(next);
    setDraft(conversationId, next);
  };

  return (
    <div onBlurCapture={() => stopTyping(conversationId)}>
      <Composer
        layout={phone ? "mobile" : "desktop"}
        value={text}
        onChange={update}
        onTyping={() => notifyTyping(conversationId)}
        inputRef={inputRef}
        autoFocus={!phone}
        onSend={(body) => {
          const reply = replyTo;
          onCancelReply();
          void sendMessage(conversationId, body, reply);
        }}
        onAttach={() => push("Attachments are coming soon")}
        onEmoji={() => push("Emoji picker is coming soon")}
        onSticker={() => push("Stickers are coming soon")}
        onVoice={() => push("Voice messages are coming soon")}
        onCamera={() => push("Camera is coming soon")}
        quote={
          replyTo ? (
            <QuoteBlock
              author={replyAuthor}
              text={replyTo.deleted ? "This message was deleted." : replyTo.body}
              color={isGroup && replyAuthor !== "You" ? senderColor(replyTo.sender_id) : undefined}
              onClose={onCancelReply}
            />
          ) : null
        }
      />
    </div>
  );
}
