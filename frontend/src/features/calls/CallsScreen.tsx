"use client";

import { useEffect } from "react";
import { Avatar, ComingSoon, Icon } from "@/components/ui";
import { mediaUrl } from "@/lib/config";
import { directionLabel, type CallRecord } from "@/lib/calls";
import { formatListTime } from "@/lib/format";
import { useAuthStore, useCallStore, useConversationStore } from "@/store";
import { CallIcon } from "./CallIcons";
import styles from "./CallsScreen.module.css";

/** The Calls tab: recent calls (outgoing, incoming, missed) with a button to call again. */
export function CallsScreen() {
  const meId = useAuthStore((s) => s.me?.id);
  const loaded = useConversationStore((s) => s.loaded);
  const history = useCallStore((s) => s.history);
  const start = useCallStore((s) => s.start);
  const clear = useCallStore((s) => s.clearHistory);

  useEffect(() => {
    if (meId === undefined || !loaded) return;
    useCallStore.getState().loadHistory(meId, Object.values(useConversationStore.getState().byId));
  }, [meId, loaded]);

  const callAgain = (record: CallRecord) => void start(record.conversationId, record.kind);

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>Calls</h1>
        {history.length > 0 && meId !== undefined ? (
          <button type="button" className={styles.link} onClick={() => clear(meId)}>
            Clear call history
          </button>
        ) : null}
      </header>
      {history.length === 0 ? (
        <ComingSoon icon="phone" title="No recent calls">
          Start a voice or video call from any chat. It will show up here.
        </ComingSoon>
      ) : (
        <ul className={styles.list} aria-label="Recent calls">
          {history.map((record) => (
            <li key={record.id} className={styles.row}>
              <Avatar
                name={record.title}
                src={mediaUrl(record.avatarUrl) ?? undefined}
                kind={record.isGroup && !record.avatarUrl ? "group" : undefined}
                size={48}
              />
              <span className={styles.text}>
                <span className={record.direction === "missed" ? styles.missed : styles.name}>{record.title}</span>
                <span className={styles.detail}>
                  <Icon name={record.direction === "outgoing" ? "forward" : "reply"} size={14} />
                  {directionLabel(record)}
                </span>
              </span>
              <span className={styles.when}>{formatListTime(record.at)}</span>
              <button
                type="button"
                className={styles.callBtn}
                aria-label={`${record.kind === "video" ? "Video" : "Voice"} call ${record.title}`}
                onClick={() => callAgain(record)}
              >
                {record.kind === "video" ? <CallIcon name="video" size={22} /> : <Icon name="phone" size={22} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
