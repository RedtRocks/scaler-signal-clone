import { describe, expect, it } from "vitest";
import type { UserPublic } from "@/lib/types";
import { resolveName } from "./names";

const user = (id: number, display_name: string): UserPublic => ({ id, display_name, phone: `+1555000000${id}` }) as UserPublic;

describe("resolveName", () => {
  it("falls back to former members so old messages keep a name", () => {
    expect(resolveName(7, { contacts: [], members: [], former: [user(7, "Maya")] })).toBe("Maya");
  });

  it("says Unknown only when nobody knows the user", () => {
    expect(resolveName(9, { contacts: [], members: [], former: [] })).toBe("Unknown");
  });
});
