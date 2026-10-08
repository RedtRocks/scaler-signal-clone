"use client";

import { useLayoutEffect, useRef, useState } from "react";
import {
  ChatHeader,
  ChatListHeader,
  Composer,
  ConversationRow,
  DateDivider,
  EncryptionNotice,
  GetStartedCard,
  MessageActions,
  MessageBubble,
  QuoteBlock,
  ScrollToBottom,
  SearchField,
  SystemNotice,
  TypingIndicator,
  type MenuEntry,
  type MessageStatus,
  type ReactionSummary,
} from "@/components/ui";
import styles from "./page.module.css";

export const CONVERSATIONS = [
  { id: "maya", name: "Maya Johnson", time: "9:41 AM", preview: "Perfect, see you at 7 then 🎉", unread: 2, online: true },
  { id: "family", name: "Family", kind: "group" as const, time: "20m", sender: "Mom", preview: "Who's bringing dessert on Sunday?", unread: 12 },
  { id: "paige", name: "Paige Hall", time: "40m", preview: "Sounds good — I'll send the doc over tonight.", status: "read" as MessageStatus },
  { id: "note", name: "Note to Self", kind: "note" as const, time: "Thu", preview: "Passport renewal: bring 2 photos" },
  { id: "kai", name: "Kai Nakamura", time: "Wed", preview: "", typing: true },
  { id: "book", name: "Book Club", kind: "group" as const, time: "Tue", sender: "You", preview: "Next pick: Tomorrow, and Tomorrow, and Tomorrow", status: "delivered" as MessageStatus, muted: true },
  { id: "julian", name: "Julian Smith", time: "Oct 2", preview: "Thanks for the help with the move!", status: "sent" as MessageStatus },
];

const MENU = (onAction: (label: string) => void): MenuEntry[] => [
  { label: "Reply", icon: "reply", onSelect: () => onAction("Reply") },
  { label: "Copy text", icon: "copy", onSelect: () => onAction("Copied") },
  { label: "Info", icon: "info", onSelect: () => onAction("Info") },
  "separator",
  { label: "Delete for me", icon: "trash", onSelect: () => onAction("Deleted for you") },
  { label: "Delete for everyone", icon: "trash", destructive: true, onSelect: () => onAction("Deleted for everyone") },
];

export function ListColumn({
  selected,
  onSelect,
  showGetStarted,
  onToast,
}: {
  selected?: string;
  onSelect: (id: string) => void;
  showGetStarted?: boolean;
  onToast: (m: string) => void;
}) {
  const [q, setQ] = useState("");
  const rows = CONVERSATIONS.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <ChatListHeader
        selfName="Alex Rivera"
        onCompose={() => onToast("New chat")}
        onCamera={() => onToast("Camera is coming soon")}
        menuItems={[
          { label: "New group", icon: "add-member", onSelect: () => onToast("New group") },
          { label: "Mark all read", icon: "check", onSelect: () => onToast("Marked all read") },
          { label: "Settings", icon: "settings", onSelect: () => onToast("Settings") },
        ]}
      />
      <div className={styles.searchWrap}>
        <SearchField value={q} onChange={(e) => setQ(e.target.value)} onClear={() => setQ("")} />
      </div>
      <div className={styles.rows}>
        {rows.map((c) => (
          <ConversationRow
            key={c.id}
            name={c.name}
            time={c.time}
            preview={c.preview}
            sender={"sender" in c ? c.sender : undefined}
            unread={"unread" in c ? c.unread : undefined}
            status={"status" in c ? c.status : undefined}
            kind={"kind" in c ? c.kind : undefined}
            typing={"typing" in c ? c.typing : undefined}
            online={"online" in c ? c.online : undefined}
            muted={"muted" in c ? c.muted : undefined}
            selected={selected === c.id}
            onClick={() => onSelect(c.id)}
          />
        ))}
        {showGetStarted ? (
          <div className={styles.getStarted}>
            <h3>Get started</h3>
            <div className={styles.cards}>
              <GetStartedCard label="New group" image="/illustrations/get-started-new-group.svg" onDismiss={() => {}} />
              <GetStartedCard label="Invite friends" image="/illustrations/get-started-invite-friends.svg" onDismiss={() => {}} />
              <GetStartedCard label="Appearance" image="/illustrations/get-started-appearance.svg" onDismiss={() => {}} />
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}

type Msg = {
  id: string;
  dir: "incoming" | "outgoing";
  text: string;
  time: string;
  status?: MessageStatus;
  quote?: { author: string; text: string };
  reactions?: ReactionSummary[];
  sender?: string;
};

const INITIAL: Msg[] = [
  { id: "1", dir: "incoming", text: "Hey! Are we still on for dinner tonight?", time: "9:30 AM" },
  { id: "2", dir: "incoming", text: "I found a new ramen place near the station 🍜", time: "9:30 AM" },
  { id: "3", dir: "outgoing", text: "Yes! Ramen sounds amazing", time: "9:32 AM", status: "read" },
  { id: "4", dir: "outgoing", text: "What time works for you?", time: "9:32 AM", status: "read", reactions: [{ emoji: "👍", count: 1 }] },
  { id: "5", dir: "incoming", text: "How about 7? They don't take reservations so earlier is better.", time: "9:40 AM", quote: { author: "You", text: "What time works for you?" } },
  { id: "6", dir: "outgoing", text: "Perfect, see you at 7 then 🎉", time: "9:41 AM", status: "delivered", reactions: [{ emoji: "❤️", count: 1 }, { emoji: "😂", count: 1, mine: true }] },
  { id: "7", dir: "outgoing", text: "I'll grab us a table if I get there first", time: "Now", status: "sending" },
];

function position(list: Msg[], i: number) {
  const prev = list[i - 1]?.dir === list[i].dir;
  const next = list[i + 1]?.dir === list[i].dir;
  return prev && next ? "middle" : prev ? "last" : next ? "first" : "single";
}

export function ChatPane({
  layout,
  onBack,
  onToast,
}: {
  layout: "desktop" | "mobile";
  onBack?: () => void;
  onToast: (m: string) => void;
}) {
  const [messages, setMessages] = useState(INITIAL);
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = timelineRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);
  const react = (id: string, emoji: string) =>
    setMessages((ms) =>
      ms.map((m) => {
        if (m.id !== id) return m;
        const others = (m.reactions ?? []).filter((r) => !r.mine);
        const had = m.reactions?.find((r) => r.mine)?.emoji === emoji;
        return { ...m, reactions: had ? others : [...others, { emoji, count: 1, mine: true }] };
      }),
    );
  return (
    <>
      <ChatHeader
        name="Maya Johnson"
        subtitle={layout === "mobile" ? undefined : "online"}
        verified={layout === "mobile"}
        compact={layout === "mobile"}
        onBack={onBack}
        onTitleClick={() => onToast("Contact details")}
        moreItems={[
          { label: "Disappearing messages", icon: "timer", onSelect: () => onToast("Disappearing messages") },
          { label: "View safety number", icon: "safety-number", onSelect: () => onToast("Safety number") },
          "separator",
          { label: "Delete chat", icon: "trash", destructive: true, onSelect: () => onToast("Chat deleted") },
        ]}
      />
      <div className={styles.timelineWrap}>
        <div className={styles.timeline} ref={timelineRef}>
          <EncryptionNotice name="Maya Johnson" subtitle="+1 555-000-0002 · Maya is in your contacts" />
          <DateDivider label="Yesterday" />
          <SystemNotice icon="disappearing">You set disappearing message time to 1 day.</SystemNotice>
          <DateDivider label="Today" />
          {messages.map((m, i) => (
            <MessageBubble
              key={m.id}
              direction={m.dir}
              time={m.time}
              status={m.status}
              position={position(messages, i)}
              quote={m.quote}
              reactions={m.reactions}
              actions={
                <MessageActions
                  direction={m.dir}
                  selectedReaction={m.reactions?.find((r) => r.mine)?.emoji}
                  onReact={(e) => react(m.id, e)}
                  onReply={() => setReplyTo(m)}
                  menuItems={MENU(onToast)}
                />
              }
            >
              {m.text}
            </MessageBubble>
          ))}
          <TypingIndicator />
        </div>
        <ScrollToBottom count={3} onClick={() => onToast("Scrolled")} />
      </div>
      <Composer
        layout={layout}
        onTyping={() => {}}
        quote={
          replyTo ? (
            <QuoteBlock
              author={replyTo.dir === "outgoing" ? "You" : "Maya Johnson"}
              text={replyTo.text}
              onClose={() => setReplyTo(null)}
            />
          ) : null
        }
        onSend={(text) => {
          setMessages((ms) => [
            ...ms,
            { id: String(ms.length + 1), dir: "outgoing", text, time: "Now", status: "sent", quote: replyTo ? { author: replyTo.dir === "outgoing" ? "You" : "Maya Johnson", text: replyTo.text } : undefined },
          ]);
          setReplyTo(null);
        }}
      />
    </>
  );
}

/** Group chat sample: sender names, avatars, colours. */
export function GroupSample() {
  return (
    <div className={styles.timelineStatic}>
      <SystemNotice>Julian Smith made you an admin.</SystemNotice>
      <MessageBubble direction="incoming" sender="Julian Smith" senderColor="green" position="first" time="10:02 AM">
        Who&apos;s in for the hike on Saturday?
      </MessageBubble>
      <MessageBubble direction="incoming" sender="Julian Smith" senderColor="green" position="last" time="10:02 AM">
        Trailhead at 8, bring water 💧
      </MessageBubble>
      <MessageBubble direction="incoming" sender="Kai Nakamura" senderColor="crimson" time="10:05 AM" reaction="🙏">
        Count me in!
      </MessageBubble>
      <MessageBubble direction="outgoing" time="10:06 AM" status="read" expires quote={{ author: "Julian Smith", text: "Trailhead at 8, bring water 💧" }}>
        I&apos;ll bring snacks
      </MessageBubble>
      <MessageBubble direction="incoming" sender="Paige Hall" senderColor="teal" time="10:08 AM" deleted>
        x
      </MessageBubble>
      <TypingIndicator avatar={<span style={{ width: 28 }} />} />
    </div>
  );
}
