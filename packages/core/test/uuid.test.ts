import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { COPY_NAMESPACE, copyId, isUuid, uuidV5 } from "../src";

/** Reference UUIDv5 built on Node's own SHA-1, to check ours against. */
function referenceV5(name: string, namespace: string): string {
  const ns = Buffer.from(namespace.replace(/-/g, ""), "hex");
  const hash = createHash("sha1").update(Buffer.concat([ns, Buffer.from(name, "utf8")])).digest();
  hash[6] = (hash[6]! & 0x0f) | 0x50;
  hash[8] = (hash[8]! & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

describe("uuidV5", () => {
  it("matches a reference implementation", () => {
    const dns = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
    for (const name of ["", "www.example.com", "gym/2026-11-05/1", "Café ☕ 日本 🏋️", "x".repeat(200)]) {
      expect(uuidV5(name, dns)).toBe(referenceV5(name, dns));
      expect(uuidV5(name, COPY_NAMESPACE)).toBe(referenceV5(name, COPY_NAMESPACE));
    }
  });

  it("gives every routine copy a stable id: entry + date + slot", () => {
    const a = copyId("gym", "2026-11-05", 1);
    expect(isUuid(a)).toBe(true);
    expect(copyId("gym", "2026-11-05", 1)).toBe(a);
    expect(copyId("gym", "2026-11-05", 2)).not.toBe(a);
    expect(copyId("gym", "2026-11-06", 1)).not.toBe(a);
  });
});
