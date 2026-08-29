import { describe, it, expect } from "vitest";
import { isKidFriendly } from "@/lib/certs";

describe("isKidFriendly", () => {
  it("treats a missing cert as not kid-friendly", () => {
    expect(isKidFriendly(undefined)).toBe(false);
  });

  it("accepts G / PG / 12A (and bare 12), case-insensitively", () => {
    expect(isKidFriendly("G")).toBe(true);
    expect(isKidFriendly("PG")).toBe(true);
    expect(isKidFriendly("12A")).toBe(true);
    expect(isKidFriendly("12")).toBe(true);
    expect(isKidFriendly("pg")).toBe(true);
  });

  it("rejects 15A and above", () => {
    expect(isKidFriendly("15A")).toBe(false);
    expect(isKidFriendly("16")).toBe(false);
    expect(isKidFriendly("18")).toBe(false);
    expect(isKidFriendly("TBC")).toBe(false);
  });
});
