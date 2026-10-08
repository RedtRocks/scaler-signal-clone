"use client";

import { useRef, useState } from "react";
import {
  Avatar,
  Button,
  ContextMenu,
  ProfileHeader,
  QuickActions,
  SettingsGroup,
  SettingsRow,
  Switch,
  useIsPhone,
  type MenuEntry,
  type QuickAction,
} from "@/components/ui";
import { ApiError } from "@/lib/api";
import { formatLastSeen, formatTimer } from "@/lib/format";
import type { ConversationDetail, ConversationSummary, Member } from "@/lib/types";
import { useAuthStore, useConversationStore, usePresence, useToastStore } from "@/store";
import { useChatNames } from "./useChatNames";
import { AddMembersModal, ConfirmModal, EditGroupModal, SafetyNumberModal, TimerModal } from "./ChatModals";
import styles from "./InfoPanel.module.css";

interface InfoPanelProps {
  conversation: ConversationSummary;
  detail: ConversationDetail | undefined;
  onClose: () => void;
  onSearch: () => void;
  /** Open straight into a dialog, e.g. from the header menu. */
  initialDialog?: Dialog;
}

export type Dialog = "timer" | "edit" | "add" | "leave" | "safety" | { remove: Member } | null;

/** Chat settings: right-hand drawer on desktop, the whole pane on a phone. */
export function InfoPanel({ conversation, detail, onClose, onSearch, initialDialog = null }: InfoPanelProps) {
  const phone = useIsPhone();
  const push = useToastStore((state) => state.push);
  const meId = useAuthStore((state) => state.me?.id);
  const { nameOf } = useChatNames(conversation.id);
  const peerPresence = usePresence(conversation.peer?.id);
  const [dialog, setDialog] = useState<Dialog>(initialDialog);
  // SettingsRow's onClick carries no event, so remember where the pointer last went down.
  const pointer = useRef({ x: 0, y: 0 });
  const [memberMenu, setMemberMenu] = useState<{ member: Member; at: { x: number; y: number } } | null>(null);

  const isGroup = conversation.kind === "group";
  const isAdmin = conversation.my_role === "admin" && !conversation.left;
  const members = detail?.members ?? [];
  const peer = conversation.peer;
  const store = useConversationStore.getState;

  const run = (task: Promise<unknown>, fallback: string) =>
    task.catch((error) => push(error instanceof ApiError && error.detail ? error.detail : fallback));

  const toggleMute = () => run(store().updateSettings(conversation.id, { muted: !conversation.muted }), "Couldn't change notifications.");

  const quickActions: QuickAction[] = [
    ["video", "video"],
    ...(isGroup ? [] : ([["phone", "audio"]] as QuickAction[])),
    ["muted", conversation.muted ? "unmute" : "mute"],
    ["search-action", "search"],
  ];
  const onQuickAction = (label: string) => {
    if (label === "video" || label === "audio") push("Calls are coming soon");
    else if (label === "search") onSearch();
    else void toggleMute();
  };

  const memberMenuItems = (member: Member): MenuEntry[] => [
    member.role === "admin"
      ? {
          label: "Remove admin",
          onSelect: () => void run(store().setRole(conversation.id, member.user.id, "member"), "Couldn't change the role."),
        }
      : {
          label: "Make admin",
          onSelect: () => void run(store().setRole(conversation.id, member.user.id, "admin"), "Couldn't change the role."),
        },
    {
      label: "Remove from group",
      destructive: true,
      onSelect: () => setDialog({ remove: member }),
    },
  ];

  const subtitle = isGroup
    ? `Group · ${conversation.member_count} ${conversation.member_count === 1 ? "member" : "members"}`
    : peer?.phone;
  const presenceLine = peer ? formatLastSeen(peerPresence?.online ?? peer.online, peerPresence?.last_seen_at ?? peer.last_seen_at) : null;

  return (
    <aside className={styles.panel} aria-label={isGroup ? "Group settings" : "Chat settings"}>
      <header className={styles.header}>
        <Button
          variant="icon"
          icon={phone ? "back" : "close"}
          iconSize={phone ? 22 : 20}
          aria-label={phone ? "Back" : "Close"}
          onClick={onClose}
        />
        <h2 className={styles.title}>{isGroup ? "Group settings" : "Chat settings"}</h2>
        {isGroup && isAdmin ? (
          <Button variant="link" onClick={() => setDialog("edit")}>
            Edit
          </Button>
        ) : null}
      </header>

      <div className={styles.body}>
        <ProfileHeader
          name={conversation.title}
          subtitle={subtitle}
          avatarSrc={conversation.avatar_url ?? undefined}
          kind={isGroup ? "group" : undefined}
        >
          {presenceLine ? <div className={styles.presence}>{presenceLine}</div> : null}
          {isGroup && detail?.description ? <p className={styles.description}>{detail.description}</p> : null}
          {!isGroup && peer?.about ? <p className={styles.description}>{peer.about}</p> : null}
        </ProfileHeader>

        <div className={styles.quick}>
          <QuickActions items={quickActions} onAction={onQuickAction} />
        </div>

        <SettingsGroup>
          <SettingsRow
            icon="disappearing"
            label="Disappearing Messages"
            sublabel={formatTimer(conversation.disappearing_seconds)}
            onClick={conversation.left ? undefined : () => setDialog("timer")}
            chevron={!conversation.left}
          />
          <SettingsRow
            icon="muted"
            label="Mute Notifications"
            control={<Switch label="Mute notifications" checked={conversation.muted} onChange={() => void toggleMute()} />}
          />
          {!isGroup && peer && meId !== undefined ? (
            <SettingsRow icon="safety-number" label="View Safety Number" onClick={() => setDialog("safety")} />
          ) : null}
        </SettingsGroup>

        {isGroup ? (
          <div onPointerDownCapture={(e) => (pointer.current = { x: e.clientX, y: e.clientY })}>
            <SettingsGroup title={`${members.length || conversation.member_count} members`}>
              {isAdmin ? <SettingsRow icon="add-member" label="Add Members" chevron={false} onClick={() => setDialog("add")} /> : null}
              {members.map((member) => {
                const self = member.user.id === meId;
                const canManage = isAdmin && !self;
                const label = self ? "You" : nameOf(member.user.id);
                return (
                  <SettingsRow
                    key={member.user.id}
                    avatar={<Avatar name={label} src={member.user.avatar_url ?? undefined} size={36} />}
                    label={label}
                    sublabel={member.user.about || member.user.phone}
                    value={member.role === "admin" ? "Admin" : undefined}
                    chevron={false}
                    onClick={canManage ? () => setMemberMenu({ member, at: { ...pointer.current } }) : undefined}
                  />
                );
              })}
            </SettingsGroup>
          </div>
        ) : null}

        {isGroup && !conversation.left ? (
          <SettingsGroup>
            <SettingsRow icon="leave-group" label="Leave Group" destructive onClick={() => setDialog("leave")} />
          </SettingsGroup>
        ) : null}
      </div>

      <ContextMenu
        position={memberMenu?.at ?? null}
        items={memberMenu ? memberMenuItems(memberMenu.member) : []}
        onClose={() => setMemberMenu(null)}
        label="Member actions"
      />

      {dialog === "timer" ? (
        <TimerModal conversationId={conversation.id} current={conversation.disappearing_seconds} onClose={() => setDialog(null)} />
      ) : null}
      {dialog === "edit" && detail ? <EditGroupModal detail={detail} onClose={() => setDialog(null)} /> : null}
      {dialog === "add" && detail ? <AddMembersModal detail={detail} onClose={() => setDialog(null)} /> : null}
      {dialog === "safety" && peer && meId !== undefined ? (
        <SafetyNumberModal meId={meId} peerId={peer.id} name={conversation.title} onClose={() => setDialog(null)} />
      ) : null}
      {dialog === "leave" ? (
        <ConfirmModal
          title="Leave group?"
          confirmLabel="Leave"
          destructive
          onClose={() => setDialog(null)}
          onConfirm={() => {
            setDialog(null);
            void run(store().leave(conversation.id), "Couldn't leave the group.");
          }}
        >
          You will no longer be able to send or receive messages in this group.
        </ConfirmModal>
      ) : null}
      {typeof dialog === "object" && dialog ? (
        <ConfirmModal
          title="Remove from group?"
          confirmLabel="Remove"
          destructive
          onClose={() => setDialog(null)}
          onConfirm={() => {
            const target = dialog.remove;
            setDialog(null);
            void run(store().removeMember(conversation.id, target.user.id), "Couldn't remove the member.");
          }}
        >
          {nameOf(dialog.remove.user.id)} will be removed from this group.
        </ConfirmModal>
      ) : null}
    </aside>
  );
}
