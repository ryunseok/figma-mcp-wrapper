import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError } from "../../errors/auth.js";
import { FigmaMcpError } from "../../errors/base.js";
import { RateLimitError } from "../../errors/rate-limit.js";
import { RestClient } from "../rest-client.js";

vi.mock("../../utils/logger.js", () => ({
  logger: { warn: vi.fn(), debug: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    headers: new Headers(),
  };
}

function errorResponse(status: number, body: string, headers?: Record<string, string>) {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(body),
    headers: new Headers(headers),
  };
}

describe("RestClient", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("isAvailable returns false when no token", () => {
    const client = new RestClient(null);
    expect(client.isAvailable).toBe(false);
  });

  it("isAvailable returns true when token set", () => {
    const client = new RestClient("test-token");
    expect(client.isAvailable).toBe(true);
  });

  it("throws AuthError when no token is configured", async () => {
    const client = new RestClient(null);
    await expect(client.getFile("abc")).rejects.toThrow(AuthError);
  });

  it("getFile fetches from Figma API with token header", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ name: "My File" }));
    const client = new RestClient("my-token");

    const result = await client.getFile("fileKey123");

    expect(result).toEqual({ name: "My File" });
    expect(mockFetch).toHaveBeenCalledOnce();

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.toString()).toContain("/files/fileKey123");
    expect(opts.headers["X-Figma-Token"]).toBe("my-token");
  });

  it("getFile returns cached result on second call", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ name: "Cached" }));
    const client = new RestClient("token");

    await client.getFile("key1");
    const second = await client.getFile("key1");

    expect(second).toEqual({ name: "Cached" });
    expect(mockFetch).toHaveBeenCalledOnce(); // only 1 fetch
  });

  it("getImages is NOT cached (each call fetches)", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ images: { "1": "url1" } }))
      .mockResolvedValueOnce(jsonResponse({ images: { "1": "url2" } }));

    const client = new RestClient("token");

    await client.getImages("key", ["1"]);
    await client.getImages("key", ["1"]);

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("throws AuthError on 401 response", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(401, "Unauthorized"));
    const client = new RestClient("bad-token");

    await expect(client.getFile("key")).rejects.toThrow(AuthError);
  });

  it("throws AuthError on 403 response", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(403, "Forbidden"));
    const client = new RestClient("token");

    await expect(client.getFile("key")).rejects.toThrow(AuthError);
  });

  it("throws RateLimitError on 429 response", async () => {
    vi.useFakeTimers();
    // All 4 attempts (initial + 3 retries) return 429
    for (let i = 0; i < 4; i++) {
      mockFetch.mockResolvedValueOnce(
        errorResponse(429, "Too Many Requests", { "Retry-After": "1" }),
      );
    }
    const client = new RestClient("token");

    // Capture rejection immediately to avoid unhandled rejection
    const promise = client.getFile("key").catch((e: unknown) => e);
    await vi.runAllTimersAsync();

    const err = await promise;
    expect(err).toBeInstanceOf(RateLimitError);
    expect((err as RateLimitError).retryAfterMs).toBe(1_000);
    vi.useRealTimers();
  });

  it("throws retryable FigmaMcpError on 500 response", async () => {
    vi.useFakeTimers();
    // Will retry 3 times, so mock 4 responses (initial + 3 retries)
    for (let i = 0; i < 4; i++) {
      mockFetch.mockResolvedValueOnce(errorResponse(500, "Internal Server Error"));
    }
    const client = new RestClient("token");

    const promise = client.getFile("key").catch((e: unknown) => e);
    await vi.runAllTimersAsync();

    const err = await promise;
    expect(err).toBeInstanceOf(FigmaMcpError);
    expect((err as FigmaMcpError).retryable).toBe(true);
    vi.useRealTimers();
  });

  it("throws non-retryable FigmaMcpError on 400 response", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(400, "Bad Request"));
    const client = new RestClient("token");

    try {
      await client.getFile("key");
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(FigmaMcpError);
      expect((err as FigmaMcpError).retryable).toBe(false);
    }
  });

  it("postVariables invalidates cache for the file", async () => {
    // First: cache a getFile result
    mockFetch.mockResolvedValueOnce(jsonResponse({ name: "File" }));
    const client = new RestClient("token");
    await client.getFile("fk1");

    // POST variables — should invalidate cache
    mockFetch.mockResolvedValueOnce(jsonResponse({ status: 200 }));
    await client.postVariables("fk1", { variableCollections: [] });

    // getFile again — should fetch anew (cache invalidated)
    mockFetch.mockResolvedValueOnce(jsonResponse({ name: "File Updated" }));
    const result = await client.getFile("fk1");

    expect(result).toEqual({ name: "File Updated" });
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});