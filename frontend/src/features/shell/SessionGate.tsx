"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Splash } from "./Splash";
import { bootstrap, useSession } from "@/store";

/**
 * Restores the saved session once per page load and keeps people on the right side of login:
 * signed out -> /login, signed in without a profile -> /login (profile step).
 */
export function SessionGate({ children, requireAuth }: { children: ReactNode; requireAuth: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const { status, needsProfile } = useSession();

  useEffect(() => {
    if (status === "unknown") void bootstrap();
  }, [status]);

  useEffect(() => {
    if (requireAuth && (status === "signedOut" || (status === "signedIn" && needsProfile))) {
      router.replace("/login");
    }
  }, [requireAuth, status, needsProfile, router, pathname]);

  if (requireAuth && status !== "signedIn") {
    return <Splash />;
  }
  return <>{children}</>;
}
