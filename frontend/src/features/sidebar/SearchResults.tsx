"use client";

import { ConversationRow, Spinner } from "@/components/ui";
import { mediaUrl } from "@/lib/config";
import { messageSummary } from "@/lib/attachments";
import { formatListTime } from "@/lib/format";
import type { Contact, Id, SearchResults as Results } from "@/lib/types";
import styles from "./Sidebar.module.css";

/** Contacts and message hits for the current query. Chats are rendered by the Sidebar itself. */
export function SearchSections({
  query,
  results,
  loading,
  hasChats,
  onOpenContact,
  onOpenMessage,
}: {
  query: string;
  results: Results | null;
  loading: boolean;
  hasChats: boolean;
  onOpenContact: (contact: Contact) => void;
  onOpenMessage: (conversationId: Id) => void;
}) {
  const contacts = results?.contacts ?? [];
  const messages = results?.messages ?? [];

  if (!results && loading) {
    return (
      <div className={styles.center}>
        <Spinner />
      </div>
    );
  }
  if (!results && !hasChats) return null;
  const nothing = results && !contacts.length && !messages.length && !hasChats;

  return (
    <>
      {contacts.length ? (
        <>
          <h2 className={styles.heading}>Contacts</h2>
          <ul className={styles.list}>
            {contacts.map((c) => (
              <li key={c.user.id}>
                <ConversationRow
                  name={c.display_name}
                  avatarSrc={mediaUrl(c.user.avatar_url) ?? undefined}
                  time=""
                  preview={c.user.phone}
                  onClick={() => onOpenContact(c)}
                />
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {messages.length ? (
        <>
          <h2 className={styles.heading}>Messages</h2>
          <ul className={styles.list}>
            {messages.map((hit) => (
              <li key={hit.message.id}>
                <ConversationRow
                  name={hit.conversation_title}
                  time={formatListTime(hit.message.created_at)}
                  preview={messageSummary(hit.message)}
                  onClick={() => onOpenMessage(hit.conversation_id)}
                />
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {nothing ? (
        <div className={styles.center}>
          <p className={styles.centerTitle}>No results</p>
          <p className={styles.centerCopy}>No chats, contacts or messages match “{query.trim()}”.</p>
        </div>
      ) : null}
    </>
  );
}

