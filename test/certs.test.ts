import { describe, it, expect } from "vitest";
import { isKidFriendly, normaliseCert } from "@/lib/certs";

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

describe("normaliseCert", () => {
  it("keeps an IFCO cert or TBC, upper-cased", () => {
    expect(normaliseCert("15A")).toEqual({ cert: "15A" });
    expect(normaliseCert("pg")).toEqual({ cert: "PG" });
    expect(normaliseCert("TBC")).toEqual({ cert: "TBC" });
  });

  it("shows Light House's club licence as 18", () => {
    expect(normaliseCert("CLUB 18+")).toEqual({ cert: "18" });
  });

  it("drops what isn't a certificate, and hands it back for the report", () => {
    expect(normaliseCert("LIVE")).toEqual({ unrecognised: "LIVE" });
    expect(normaliseCert("ENCORE")).toEqual({ unrecognised: "ENCORE" });
    expect(normaliseCert(undefined)).toEqual({});
  });
});
