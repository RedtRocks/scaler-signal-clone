import { Suspense, type ReactNode } from "react";
import { AppFrame } from "@/features/shell/AppFrame";
import { SessionGate } from "@/features/shell/SessionGate";
import { Splash } from "@/features/shell/Splash";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<Splash />}>
      <SessionGate requireAuth>
        <AppFrame>{children}</AppFrame>
      </SessionGate>
    </Suspense>
  );
}
