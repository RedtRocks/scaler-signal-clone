import { Suspense } from "react";
import { LoginFlow } from "@/features/auth/LoginFlow";
import { SessionGate } from "@/features/shell/SessionGate";
import { Splash } from "@/features/shell/Splash";

export default function LoginPage() {
  return (
    <Suspense fallback={<Splash />}>
      <SessionGate requireAuth={false}>
        <LoginFlow />
      </SessionGate>
    </Suspense>
  );
}
