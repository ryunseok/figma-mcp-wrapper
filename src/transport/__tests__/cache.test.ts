import { describe, expect, it, vi } from "vitest";
import { TtlCache } from "../cache.js";

describe("TtlCache", () => {
  it("stores and retrieves values", () => {
    const cache = new TtlCache();
    cache.set("key1", { data: "hello" });
    expect(cache.get("key1")).toEqual({ data: "hello" });
  });

  it("returns undefined for missing keys", () => {
    const cache = new TtlCache();
    expect(cache.get("nope")).toBeUndefined();
  });

  it("expires entries after TTL", () => {
    const cache = new TtlCache(100); // 100ms TTL
    cache.set("key1", "value");

    expect(cache.get("key1")).toBe("value");

    vi.useFakeTimers();
    vi.advanceTimersByTime(150);
    expect(cache.get("key1")).toBeUndefined();
    vi.useRealTimers();
  });

  it("respects per-entry TTL override", () => {
    const cache = new TtlCache(60_000);
    cache.set("short", "data", 50);

    vi.useFakeTimers();
    vi.advanceTimersByTime(100);
    expect(cache.get("short")).toBeUndefined();
    vi.useRealTimers();
  });

  it("evicts oldest entry when maxEntries exceeded", () => {
    const cache = new TtlCache(60_000, 3);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    cache.set("d", 4); // evicts "a"

    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe(2);
    expect(cache.get("d")).toBe(4);
  });

  it("invalidate() clears all entries", () => {
    const cache = new TtlCache();
    cache.set("x", 1);
    cache.set("y", 2);
    cache.invalidate();

    expect(cache.get("x")).toBeUndefined();
    expect(cache.get("y")).toBeUndefined();
  });

  it("invalidate(pattern) clears matching entries only", () => {
    const cache = new TtlCache();
    cache.set("file:abc123", "fileData");
    cache.set("components:abc123", "compData");
    cache.set("file:xyz789", "otherFile");

    cache.invalidate("abc123");

    expect(cache.get("file:abc123")).toBeUndefined();
    expect(cache.get("components:abc123")).toBeUndefined();
    expect(cache.get("file:xyz789")).toBe("otherFile");
  });
});
