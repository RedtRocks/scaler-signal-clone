"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { Button, ChatHeader, EmptyChatPane, Lightbox, useIsPhone, type MenuEntry } from "@/components/ui";
import { mediaUrl } from "@/lib/config";
import { ApiError } from "@/lib/api";
import type { Id, Message } from "@/lib/types";
import {
  closeConversation,
  openConversation,
  useAuthStore,
  useConversation,
  useConversationDetail,
  useConversationStore,
  usePresence,
  useToastStore,
  useTypingNames,
} from "@/store";
import styles from "./ChatScreen.module.css";
import { useChatNames } from "./useChatNames";
import { ChatComposer } from "./ChatComposer";
import { headerSubtitle, typingText } from "./chatLogic";
import { ChatSearch } from "./ChatSearch";
import { downloadAttachment } from "./download";
import { useLightboxStore } from "./lightbox";
import { useStagingStore } from "./staging";
import { InfoPanel, type Dialog } from "./InfoPanel";
import { Timeline, type TimelineHandle } from "./Timeline";

/** The open conversation: header, timeline, composer, info panel. */
export function ChatScreen({ conversationId }: { conversationId: number }) {
  const conversation = useConversation(conversationId);
  const [failure, setFailure] = useState<number | null>(null);

  useEffect(() => {
    openConversation(conversationId).catch((error) => setFailure(error instanceof ApiError ? error.status : 0));
    return closeConversation;
  }, [conversationId]);

  if (conversation) return <ChatView conversation={conversation} />;
  if (failure !== null) return <Unavailable notFound={failure === 403 || failure === 404} />;
  return <ChatSkeleton />;
}

function ChatView({ conversation }: { conversation: NonNullable<ReturnType<typeof useConversation>> }) {
  const id: Id = conversation.id;
  const router = useRouter();
  const phone = useIsPhone();
  const push = useToastStore((state) => state.push);
  const meId = useAuthStore((state) => state.me?.id);
  const detail = useConversationDetail(id);
  const { nameOf } = useChatNames(id);
  const presence = usePresence(conversation.peer?.id);
  const typingNames = useTypingNames(id);

  const timeline = useRef<TimelineHandle>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const [unreadAtOpen] = useState(conversation.unread_count);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [searching, setSearching] = useState(false);
  const [hit, setHit] = useState<Id | null>(null);
  const [info, setInfo] = useState<{ nonce: number; dialog: Dialog } | null>(null);
  const [dragging, setDragging] = useState(false);
  // dragenter/leave also fire for every child element, so count them instead of toggling.
  const dragDepth = useRef(0);

  const isGroup = conversation.kind === "group";
  const peer = conversation.peer;
  const online = presence?.online ?? peer?.online ?? false;
  const typing = typingText(typingNames, isGroup);
  const subtitle = headerSubtitle({
    isGroup,
    memberCount: conversation.member_count,
    left: conversation.left,
    online,
    lastSeenAt: presence?.last_seen_at ?? peer?.last_seen_at ?? null,
    typing,
    timerSeconds: conversation.disappearing_seconds,
  });

  const openInfo = (dialog: Dialog = null) => setInfo((current) => ({ nonce: (current?.nonce ?? 0) + 1, dialog }));
  const startSearch = () => {
    setInfo(null);
    setSearching(true);
  };
  const stopSearch = () => {
    setSearching(false);
    setHit(null);
  };
  const jump = (messageId: Id | null) => {
    setHit(messageId);
    if (messageId !== null) timeline.current?.jumpTo(messageId);
  };
  const reply = useCallback((message: Message) => {
    setReplyTo(message);
    input.current?.focus();
  }, []);
  const comingSoon = () => push("Calls are coming soon");
  const toggleMute = () =>
    useConversationStore
      .getState()
      .updateSettings(id, { muted: !conversation.muted })
      .catch(() => push("Couldn't change notifications."));

  const menu: MenuEntry[] = [
    { label: isGroup ? "Group settings" : "Chat settings", icon: "info", onSelect: () => openInfo() },
    { label: "Search in chat", icon: "search", onSelect: startSearch },
    { label: conversation.muted ? "Unmute notifications" : "Mute notifications", icon: "muted", onSelect: toggleMute },
    ...(conversation.left
      ? []
      : ([{ label: "Disappearing messages", icon: "timer", onSelect: () => openInfo("timer") }] as MenuEntry[])),
    ...(isGroup && !conversation.left
      ? ([
          "separator",
          { label: "Leave group", icon: "leave-group", destructive: true, onSelect: () => openInfo("leave") },
        ] as MenuEntry[])
      : []),
  ];

  const canDrop = !conversation.left;
  const carriesFiles = (event: DragEvent<HTMLElement>) => Array.from(event.dataTransfer.types).includes("Files");
  const dropHandlers = canDrop
    ? {
        onDragEnter: (event: DragEvent<HTMLElement>) => {
          if (!carriesFiles(event)) return;
          dragDepth.current += 1;
          setDragging(true);
        },
        onDragOver: (event: DragEvent<HTMLElement>) => {
          if (carriesFiles(event)) event.preventDefault(); // required for drop to fire
        },
        onDragLeave: (event: DragEvent<HTMLElement>) => {
          if (!carriesFiles(event)) return;
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setDragging(false);
        },
        onDrop: (event: DragEvent<HTMLElement>) => {
          if (!carriesFiles(event)) return;
          event.preventDefault();
          dragDepth.current = 0;
          setDragging(false);
          useStagingStore.getState().add(id, Array.from(event.dataTransfer.files));
          input.current?.focus();
        },
      }
    : {};

  return (
    <div className={styles.screen}>
      <div className={styles.main} {...dropHandlers}>
        {dragging ? (
          <div className={styles.dropZone} aria-hidden="true">
            <span>Drop files to attach them</span>
          </div>
        ) : null}
        <ChatHeader
          name={conversation.title}
          subtitle={phone ? typing : subtitle}
          timer={!phone && !typing && conversation.disappearing_seconds !== null}
          isGroup={isGroup}
          compact={phone}
          kind={isGroup ? "group" : undefined}
          avatarSrc={conversation.avatar_url ?? undefined}
          avatarSize={phone ? 38 : 32}
          online={!isGroup && online}
          onBack={phone ? () => router.push("/") : undefined}
          onTitleClick={() => openInfo()}
          onVideoCall={comingSoon}
          onVoiceCall={comingSoon}
          onSearch={startSearch}
          moreItems={menu}
        />
        {searching ? <ChatSearch conversationId={id} onJump={jump} onClose={stopSearch} /> : null}
        <Timeline
          ref={timeline}
          conversation={conversation}
          unreadAtOpen={unreadAtOpen}
          pinnedHighlight={hit}
          onReply={reply}
        />
        {conversation.left ? (
          <p className={styles.left}>You can&apos;t send messages to this group because you&apos;re no longer a member.</p>
        ) : (
          <ChatComposer
            conversationId={id}
            isGroup={isGroup}
            replyTo={replyTo}
            replyAuthor={replyTo ? (replyTo.sender_id === meId ? "You" : nameOf(replyTo.sender_id ?? 0)) : ""}
            onCancelReply={() => setReplyTo(null)}
            inputRef={input}
          />
        )}
      </div>
      <LightboxHost onError={() => push("Couldn't download the file.")} />
      {info ? (
        <div className={styles.side}>
          <InfoPanel
            key={info.nonce}
            conversation={conversation}
            detail={detail}
            initialDialog={info.dialog}
            onClose={() => setInfo(null)}
            onSearch={startSearch}
          />
        </div>
      ) : null}
    </div>
  );
}

/** The image viewer, shown whenever a bubble has opened it. */
function LightboxHost({ onError }: { onError: () => void }) {
  const { items, index, setIndex, close } = useLightboxStore();
  useEffect(() => close, [close]); // leaving the conversation closes it
  if (items.length === 0) return null;
  return (
    <Lightbox
      items={items.map((attachment) => ({
        key: attachment.id,
        src: mediaUrl(attachment.url) ?? attachment.url,
        name: attachment.file_name,
      }))}
      index={index}
      onIndexChange={setIndex}
      onClose={close}
      onDownload={(item) => {
        const attachment = items.find((candidate) => candidate.id === item.key);
        if (attachment) downloadAttachment(attachment).catch(onError);
      }}
    />
  );
}

function ChatSkeleton() {
  return (
    <div className={styles.screen} aria-busy="true" aria-label="Loading conversation">
      <div className={styles.main}>
        <div className={styles.skelHeader}>
          <span className={styles.skelAvatar} />
          <span className={styles.skelLine} style={{ width: 140 }} />
        </div>
        <div className={styles.skelBody}>
          <span className={styles.skelBubbleIn} style={{ width: "42%" }} />
          <span className={styles.skelBubbleIn} style={{ width: "28%" }} />
          <span className={styles.skelBubbleOut} style={{ width: "36%" }} />
          <span className={styles.skelBubbleIn} style={{ width: "50%" }} />
          <span className={styles.skelBubbleOut} style={{ width: "24%" }} />
        </div>
      </div>
    </div>
  );
}

function Unavailable({ notFound }: { notFound: boolean }) {
  const router = useRouter();
  return (
    <EmptyChatPane title={notFound ? "Conversation not found" : "Couldn't load this conversation"}>
      <Button variant="secondary" onClick={() => router.push("/")}>
        Back to chats
      </Button>
    </EmptyChatPane>
  );
}
