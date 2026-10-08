import Link from "next/link";
import { EmptyChatPane } from "@/components/ui";

/** Placeholder until the app screens land. */
export default function Home() {
  return (
    <main style={{ height: "100dvh", display: "flex" }}>
      <EmptyChatPane>
        <Link href="/dev/ui">Open the UI gallery</Link>
      </EmptyChatPane>
    </main>
  );
}
