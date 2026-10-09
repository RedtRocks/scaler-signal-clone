"use client";
import { avatarKind } from "@/lib/conversationKind";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Ref,
  type UIEvent,
} from "react";
import {
  Avatar,
  Button,
  DateDivider,
  EncryptionNotice,
  Modal,
  ScrollToBottom,
  Spinner,
  SystemNotice,
  TypingIndicator,
  type MenuEntry,
} from "@/components/ui";
import { formatDayDivider, systemEventText } from "@/lib/format";
import type { TimelineItem } from "@/lib/timeline";
import type { ConversationSummary, Id, Message } from "@/lib/types";
import {
  useAuthStore,
  useConversationDetail,
  useMessageStore,
  usePresenceStore,
  useThreadStatus,
  useTimeline,
  useToastStore,
} from "@/store";
import { ApiError } from "@/lib/api";
import { useDialogStore } from "@/features/dialogs/dialogStore";
import { canDeleteForEveryone, firstUnreadMessageId, myReaction } from "./chatLogic";
import { EditMessageModal } from "./EditMessageModal";
import { useChatNames } from "./useChatNames";
import { MessageContextMenu } from "./MessageContextMenu";
import { messageMenu, type MessageHandlers } from "./messageMenu";
import { chatColorHex } from "@/lib/chatColors";
import { MessageRow } from "./MessageRow";
import styles from "./Timeline.module.css";

const STICK_PX = 80;
const LOAD_OLDER_PX = 320;
const NO_IDS: Id[] = [];

export interface TimelineHandle {
  /** Scrolls a message into view and flashes it. Returns false if it is not loaded. */
  jumpTo: (messageId: Id) => boolean;
}

interface TimelineProps {
  conversation: ConversationSummary;
  /** Unread count when the conversation was opened; drives the divider. */
  unreadAtOpen: number;
  /** A message kept highlighted, e.g. the current search hit. */
  pinnedHighlight: Id | null;
  onReply: (message: Message) => void;
  ref?: Ref<TimelineHandle>;
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof ApiError && error.detail ? error.detail : fallback;
}

/** The scrolling message list: grouping, dividers, infinite scroll up, stick-to-bottom. */
export function Timeline({ conversation, unreadAtOpen, pinnedHighlight, onReply, ref }: TimelineProps) {
  const id = conversation.id;
  const isGroup = conversation.kind === "group";
  const items = useTimeline(id);
  const { hasMore, loading, loaded } = useThreadStatus(id);
  const meId = useAuthStore((state) => state.me?.id);
  const { nameOf, userElsewhere } = useChatNames(id);
  const detail = useConversationDetail(id);
  const typingIds = usePresenceStore((state) => state.typing[id] ?? NO_IDS);
  const push = useToastStore((state) => state.push);

  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const stuck = useRef(true);
  const previous = useRef<{ first?: string; last?: string; height: number; typing: number } | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const [flashId, setFlashId] = useState<Id | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [menu, setMenu] = useState<{ message: Message; at: { x: number; y: number }; items: MenuEntry[] } | null>(null);
  const [reactionsOf, setReactionsOf] = useState<Message | null>(null);
  const [deleting, setDeleting] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);

  // The unread divider is fixed when the first page arrives, so later messages do not move it.
  const [dividerId, setDividerId] = useState<Id | null | undefined>(undefined);
  if (dividerId === undefined && loaded) {
    const messages = items.flatMap((item) => (item.kind === "day" ? [] : [item.message]));
    setDividerId(firstUnreadMessageId(messages, meId, unreadAtOpen) ?? null);
  }

  const userOf = useMemo(() => {
    const users = new Map((detail?.members ?? []).map((member) => [member.user.id, member.user]));
    if (conversation.peer) users.set(conversation.peer.id, conversation.peer);
    return (userId: Id) => users.get(userId) ?? userElsewhere(userId);
  }, [detail?.members, conversation.peer, userElsewhere]);

  const typist = typingIds.length > 0 ? userOf(typingIds[0]) : undefined;
  const typingCount = typingIds.length;

  const scrollToBottom = useCallback((smooth = false) => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  const flash = useCallback((messageId: Id) => {
    clearTimeout(flashTimer.current);
    setFlashId(messageId);
    flashTimer.current = setTimeout(() => setFlashId(null), 1_600);
  }, []);

  const jumpTo = useCallback(
    (messageId: Id) => {
      const target = scroller.current?.querySelector<HTMLElement>(`#m-${messageId}`);
      if (!target) return false;
      target.scrollIntoView({ block: "center", behavior: "smooth" });
      flash(messageId);
      return true;
    },
    [flash],
  );
  useImperativeHandle(ref, () => ({ jumpTo }), [jumpTo]);

  // Keep the viewport steady: stay at the bottom, keep the reading position when older
  // pages are prepended, and count messages that arrive while scrolled up.
  const firstKey = items.find((item) => item.kind !== "day")?.key;
  const lastItem = items.findLast((item) => item.kind !== "day");
  const lastKey = lastItem?.key;
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || !loaded) return;
    const before = previous.current;
    if (!before) {
      const divider = el.querySelector<HTMLElement>("[data-unread-divider]");
      if (divider) {
        const offset = divider.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop;
        el.scrollTop = Math.max(0, offset - 56);
      } else {
        el.scrollTop = el.scrollHeight;
      }
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
      stuck.current = dist < STICK_PX;
      setAtBottom(stuck.current);
    } else if (before.first !== firstKey && before.last === lastKey) {
      el.scrollTop += el.scrollHeight - before.height;
    } else if (before.last !== lastKey || before.typing !== typingCount) {
      const mine = lastItem?.kind === "bubble" && lastItem.direction === "outgoing";
      if (stuck.current || mine) {
        el.scrollTop = el.scrollHeight;
      } else if (before.last !== lastKey && lastItem?.kind === "bubble") {
        setNewCount((count) => count + 1);
      }
    }
    previous.current = { first: firstKey, last: lastKey, height: el.scrollHeight, typing: typingCount };
  }, [loaded, firstKey, lastKey, lastItem, typingCount]);

  // The composer grows (reply strip, long text) and late layout shifts happen; stay glued to the bottom.
  useEffect(() => {
    const el = scroller.current;
    const inner = content.current;
    if (!el || !inner || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (stuck.current) el.scrollTop = el.scrollHeight;
    });
    observer.observe(el);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [loaded]);

  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_PX;
    stuck.current = near;
    setAtBottom(near);
    if (near) setNewCount(0);
    if (el.scrollTop < LOAD_OLDER_PX && hasMore && !loading && loaded) {
      useMessageStore.getState().loadOlder(id).catch(() => push("Couldn't load older messages."));
    }
  };

  const handlers: MessageHandlers = useMemo(() => {
    const base: MessageHandlers = {
      reply: onReply,
      react: (message, emoji) => {
        const store = useMessageStore.getState();
        const mine = myReaction(message.reactions, meId);
        const request = mine === emoji ? store.removeReaction(message.id) : store.react(message.id, emoji);
        request.catch((error) => push(errorText(error, "Couldn't send your reaction.")));
      },
      copy: (message) => {
        navigator.clipboard
          ?.writeText(message.body)
          .then(() => push("Copied to clipboard"))
          .catch(() => push("Couldn't copy the text."));
      },
      forward: (message) => useDialogStore.getState().forward(message),
      edit: setEditing,
      remove: setDeleting,
      retry: (message) => {
        if (message.client_id) void useMessageStore.getState().retry(id, message.client_id);
      },
      notify: push,
      showReactions: setReactionsOf,
      jumpTo: (messageId) => {
        if (!jumpTo(messageId)) push("That message isn't loaded yet.");
      },
      openMenu: (message, at) => setMenu({ message, at, items: messageMenu(message, base, meId) }),
    };
    return base;
  }, [id, meId, onReply, push, jumpTo]);

  const confirmDelete = (everyone: boolean) => {
    const message = deleting;
    setDeleting(null);
    if (!message) return;
    const store = useMessageStore.getState();
    const request = everyone ? store.deleteForEveryone(message.id) : store.deleteForMe(message);
    request.catch((error) => push(errorText(error, "Couldn't delete the message.")));
  };

  const renderItem = (item: TimelineItem) => {
    if (item.kind === "day") return <DateDivider key={item.key} label={formatDayDivider(item.at)} />;
    if (item.kind === "system") {
      const { message } = item;
      const event = message.system_event;
      if (!event || meId === undefined) return null;
      return (
        <SystemNotice key={item.key} icon={event.type === "timer_changed" ? "timer" : undefined}>
          {systemEventText(event, message.sender_id, meId, nameOf)}
        </SystemNotice>
      );
    }
    const unreadLabel =
      item.message.id === dividerId ? (
        <div key={`${item.key}:unread`} data-unread-divider>
          <DateDivider label={unreadAtOpen === 1 ? "1 unread message" : `${unreadAtOpen} unread messages`} />
        </div>
      ) : null;
    return [
      unreadLabel,
      <MessageRow
        key={item.key}
        item={item}
        meId={meId}
        isGroup={isGroup}
        nameOf={nameOf}
        userOf={userOf}
        handlers={handlers}
        highlighted={item.message.id === flashId || item.message.id === pinnedHighlight}
        chatColor={chatColorHex(conversation.chat_color)}
      />,
    ];
  };

  const title = conversation.title;
  const heroSubtitle = isGroup
    ? `${conversation.member_count} ${conversation.member_count === 1 ? "member" : "members"}`
    : conversation.peer?.phone;

  return (
    <div className={styles.wrap}>
      <div ref={scroller} className={styles.scroller} onScroll={onScroll} role="log" aria-label="Messages">
        <div ref={content}>
          {loaded && !hasMore ? (
            <EncryptionNotice
              name={title}
              subtitle={heroSubtitle}
              avatarSrc={conversation.avatar_url ?? undefined}
              kind={avatarKind(conversation)}
            />
          ) : loading ? (
            <div className={styles.loadingOlder}>
              <Spinner size={22} label="Loading earlier messages" />
            </div>
          ) : null}
          {items.map(renderItem)}
          {typingCount > 0 ? (
            <TypingIndicator
              avatar={isGroup ? <Avatar name={typist?.display_name ?? "?"} src={typist?.avatar_url ?? undefined} size={28} /> : undefined}
            />
          ) : null}
        </div>
      </div>
      <ScrollToBottom
        visible={!atBottom}
        count={newCount}
        onClick={() => {
          scrollToBottom(true);
          setNewCount(0);
        }}
        className={styles.toBottom}
      />

      <MessageContextMenu
        position={menu?.at ?? null}
        items={menu?.items ?? []}
        selectedReaction={menu ? myReaction(menu.message.reactions, meId) : undefined}
        onReact={(emoji) => menu && handlers.react(menu.message, emoji)}
        onClose={() => setMenu(null)}
      />

      <Modal
        title="Reactions"
        open={reactionsOf !== null}
        onClose={() => setReactionsOf(null)}
        actions={
          <Button variant="secondary" onClick={() => setReactionsOf(null)}>
            Close
          </Button>
        }
      >
        <ul className={styles.reactionList}>
          {reactionsOf?.reactions.map((reaction) => {
            const user = userOf(reaction.user_id);
            const name = reaction.user_id === meId ? "You" : nameOf(reaction.user_id);
            return (
              <li key={reaction.user_id} className={styles.reactionItem}>
                <Avatar name={name} src={user?.avatar_url ?? undefined} size={32} />
                <span className={styles.reactionName}>{name}</span>
                <span className={styles.reactionEmoji}>{reaction.emoji}</span>
              </li>
            );
          })}
        </ul>
      </Modal>

      <Modal
        title="Delete message?"
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant={deleting && canDeleteForEveryone(deleting, meId) ? "secondary" : "destructive"} onClick={() => confirmDelete(false)}>
              Delete for me
            </Button>
            {deleting && canDeleteForEveryone(deleting, meId) ? (
              <Button variant="destructive" onClick={() => confirmDelete(true)}>
                Delete for everyone
              </Button>
            ) : null}
          </>
        }
      >
        <p className={styles.confirmText}>
          {deleting && canDeleteForEveryone(deleting, meId)
            ? "Delete for me removes it from this device only. Delete for everyone removes it for everyone in this chat, and they will see that you deleted a message."
            : "This message will be removed from your chat history. Others in the chat will still see it."}
        </p>
      </Modal>

      {editing ? <EditMessageModal key={editing.id} message={editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}
