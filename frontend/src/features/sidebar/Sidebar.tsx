"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { ChatListHeader, SearchField, Spinner, type MenuEntry } from "@/components/ui";
import { useDialogStore } from "@/features/dialogs/dialogStore";
import { mediaUrl } from "@/lib/config";
import type { Contact, Id } from "@/lib/types";
import {
  logout,
  useAuthStore,
  useContactStore,
  useConversationList,
  useConversationStore,
  useSearchStore,
  useSocketStatus,
  useToastStore,
  type ConversationFilter,
} from "@/store";
import { ConversationItem } from "./ConversationItem";
import { GetStartedRow } from "./GetStartedRow";
import { SearchSections } from "./SearchResults";
import styles from "./Sidebar.module.css";

const FILTERS: [ConversationFilter, string][] = [
  ["inbox", "All"],
  ["unread", "Unread"],
  ["archived", "Archived"],
];

function selectedIdOf(pathname: string): Id | null {
  const match = /^\/c\/(\d+)/.exec(pathname);
  return match ? Number(match[1]) : null;
}

/** Conversation list column: header, search, filters, rows. */
export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const me = useAuthStore((s) => s.me);
  const status = useSocketStatus();
  const showDialog = useDialogStore((s) => s.show);
  const push = useToastStore((s) => s.push);
  const [filter, setFilter] = useState<ConversationFilter>("inbox");
  const { query, results, loading, setQuery } = useSearchStore();
  const searching = query.trim() !== "";
  const conversations = useConversationList(searching ? "inbox" : filter);
  const loaded = useConversationStore((s) => s.loaded);
  const totalCount = useConversationStore((s) => s.order.length);
  const contacts = useContactStore((s) => s.contacts);
  const openDirect = useConversationStore((s) => s.openDirect);
  const details = useConversationStore((s) => s.details);
  const selectedId = selectedIdOf(pathname);

  const open = useCallback((id: Id) => router.push(`/c/${id}`), [router]);

  // Names for "Kai: " prefixes: my contacts first, then members of conversations I have opened.
  const nameIndex = useMemo(() => {
    const names = new Map<Id, string>();
    for (const detail of Object.values(details)) for (const m of detail.members) names.set(m.user.id, m.user.display_name);
    for (const c of contacts) names.set(c.user.id, c.display_name);
    return names;
  }, [contacts, details]);
  const nameOf = useCallback((userId: Id) => nameIndex.get(userId) ?? "", [nameIndex]);

  const openContact = async (contact: Contact) => {
    try {
      open(await openDirect(contact.user.id));
    } catch {
      push("Couldn't open that chat.");
    }
  };

  const menuItems: MenuEntry[] = [
    { label: "New group", onSelect: () => showDialog("newGroup") },
    { label: "Contacts", onSelect: () => showDialog("contacts") },
    { label: "Settings", icon: "settings", onSelect: () => router.push("/settings") },
    "separator",
    {
      label: "Log out",
      icon: "leave-group",
      destructive: true,
      onSelect: () => {
        void logout().then(() => router.replace("/login"));
      },
    },
  ];

  const meName = me?.display_name || me?.phone;
  const listEmpty = loaded && conversations.length === 0;

  return (
    <div className={styles.sidebar}>
      <ChatListHeader
        selfName={meName}
        selfAvatar={mediaUrl(me?.avatar_url ?? null) ?? undefined}
        menuItems={menuItems}
        onCompose={() => showDialog("newChat")}
        onProfile={() => router.push("/settings/profile")}
        onCamera={() => push("Camera is coming soon.")}
      />
      <div className={styles.search}>
        <SearchField
          placeholder="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onClear={() => setQuery("")}
        />
      </div>
      {!searching ? (
        <div className={styles.filters} role="group" aria-label="Filter chats">
          {FILTERS.map(([id, label]) => (
            <button key={id} type="button" className={styles.filter} aria-pressed={filter === id} onClick={() => setFilter(id)}>
              {label}
            </button>
          ))}
        </div>
      ) : null}
      {status === "connecting" ? (
        <div className={styles.banner} role="status">
          <Spinner size={14} label="Connecting" />
          Connecting…
        </div>
      ) : null}

      <div className={styles.scroll}>
        {!loaded ? (
          <div className={styles.center}>
            <Spinner />
          </div>
        ) : (
          <>
            {searching && conversations.length ? <h2 className={styles.heading}>Chats</h2> : null}
            <ul className={styles.list} aria-label="Chats">
              {conversations.map((c) => (
                <ConversationItem
                  key={c.id}
                  conversation={c}
                  meId={me?.id ?? 0}
                  nameOf={nameOf}
                  selected={c.id === selectedId}
                  onOpen={open}
                />
              ))}
            </ul>
            {searching ? (
              <SearchSections
                query={query}
                results={results}
                loading={loading}
                hasChats={conversations.length > 0}
                onOpenContact={(c) => void openContact(c)}
                onOpenMessage={open}
              />
            ) : null}
            {listEmpty && !searching ? <EmptyState filter={filter} hasAny={totalCount > 0} /> : null}
            {!searching && filter === "inbox" ? (
              totalCount === 0 ? (
                <GetStartedRow />
              ) : (
                <div className={styles.phoneOnly}>
                  <GetStartedRow />
                </div>
              )
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState({ filter, hasAny }: { filter: ConversationFilter; hasAny: boolean }) {
  if (filter === "unread") {
    return (
      <div className={styles.center}>
        <p className={styles.centerTitle}>No unread chats</p>
        <p className={styles.centerCopy}>You&apos;re all caught up.</p>
      </div>
    );
  }
  if (filter === "archived") {
    return (
      <div className={styles.center}>
        <p className={styles.centerTitle}>No archived chats</p>
        <p className={styles.centerCopy}>Archive a chat from its menu to tidy up your list.</p>
      </div>
    );
  }
  return (
    <div className={styles.center}>
      <p className={styles.centerTitle}>{hasAny ? "All chats are archived" : "No chats yet"}</p>
      <p className={styles.centerCopy}>
        {hasAny ? "Switch to Archived to see them." : "Start a conversation with the compose button, or make a group."}
      </p>
    </div>
  );
}
