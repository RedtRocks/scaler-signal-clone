"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GetStartedCard } from "@/components/ui";
import { useToastStore } from "@/store";
import { useDialogStore } from "@/features/dialogs/dialogStore";
import styles from "./Sidebar.module.css";

const KEY = "signal.getStartedDismissed";

function readDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

/** The "Get started" card carousel. Cards can be dismissed; that is remembered per browser. */
export function GetStartedRow() {
  const router = useRouter();
  const showDialog = useDialogStore((s) => s.show);
  const push = useToastStore((s) => s.push);
  const [dismissed, setDismissed] = useState<string[]>(() => (typeof window === "undefined" ? [] : readDismissed()));

  const dismiss = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Dismissal then only lasts for this page view.
    }
  };

  const invite = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      push("Invite link copied.");
    } catch {
      push("Share this page's address to invite friends.");
    }
  };

  const cards = [
    { id: "group", label: "New group", image: "/illustrations/get-started-new-group.svg", run: () => showDialog("newGroup") },
    { id: "invite", label: "Invite friends", image: "/illustrations/get-started-invite-friends.svg", run: () => void invite() },
    { id: "appearance", label: "Appearance", image: "/illustrations/get-started-appearance.svg", run: () => router.push("/settings") },
  ].filter((card) => !dismissed.includes(card.id));

  if (!cards.length) return null;
  return (
    <section aria-label="Get started">
      <h2 className={styles.startedTitle}>Get started</h2>
      <div className={styles.started}>
        {cards.map((card) => (
          <GetStartedCard key={card.id} label={card.label} image={card.image} onClick={card.run} onDismiss={() => dismiss(card.id)} />
        ))}
      </div>
    </section>
  );
}
