import { AuthError } from "../errors/auth.js";
import { FigmaMcpError } from "../errors/base.js";
import { RateLimitError } from "../errors/rate-limit.js";
import { logger } from "../utils/logger.js";
import { TtlCache } from "./cache.js";
import { RateLimiter } from "./rate-limiter.js";
import { withRetry } from "./retry.js";

const FIGMA_API_BASE = "https://api.figma.com/v1";

export class RestClient {
  private rateLimiter = new RateLimiter(60);
  private cache = new TtlCache(60_000, 100);

  constructor(private token: string | null) {}

  get isAvailable(): boolean {
    return this.token !== null;
  }

  async getFile(fileKey: string, params?: Record<string, string>): Promise<unknown> {
    return this.cachedGet(`file:${fileKey}`, `/files/${fileKey}`, params);
  }

  async getFileNodes(fileKey: string, nodeIds: string[]): Promise<unknown> {
    const key = `nodes:${fileKey}:${nodeIds.join(",")}`;
    return this.cachedGet(key, `/files/${fileKey}/nodes`, { ids: nodeIds.join(",") });
  }

  async getFileComponents(fileKey: string): Promise<unknown> {
    return this.cachedGet(`components:${fileKey}`, `/files/${fileKey}/components`);
  }

  async getFileStyles(fileKey: string): Promise<unknown> {
    return this.cachedGet(`styles:${fileKey}`, `/files/${fileKey}/styles`);
  }

  async getImages(fileKey: string, nodeIds: string[], format = "png", scale = 2): Promise<unknown> {
    // No cache — each call triggers a render
    return this.retriedGet(`/images/${fileKey}`, {
      ids: nodeIds.join(","),
      format,
      scale: String(scale),
    });
  }

  // --- Variables API (Phase 3) ---

  async getLocalVariables(fileKey: string): Promise<unknown> {
    // No cache — variables can change frequently
    return this.retriedGet(`/files/${fileKey}/variables/local`);
  }

  async getPublishedVariables(fileKey: string): Promise<unknown> {
    return this.cachedGet(`pub-vars:${fileKey}`, `/files/${fileKey}/variables/published`);
  }

  async postVariables(fileKey: string, body: Record<string, unknown>): Promise<unknown> {
    const result = await this.retriedPost(`/files/${fileKey}/variables`, body);
    this.cache.invalidate(fileKey);
    return result;
  }

  private async cachedGet(
    cacheKey: string,
    path: string,
    params?: Record<string, string>,
  ): Promise<unknown> {
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) {
      logger.debug(`CACHE HIT ${cacheKey}`);
      return cached;
    }
    const result = await this.retriedGet(path, params);
    this.cache.set(cacheKey, result);
    return result;
  }

  private retriedGet(path: string, params?: Record<string, string>): Promise<unknown> {
    return withRetry(() => this.rawGet(path, params));
  }

  private retriedPost(path: string, body: Record<string, unknown>): Promise<unknown> {
    return withRetry(() => this.rawPost(path, body));
  }

  private async rawPost(path: string, body: Record<string, unknown>): Promise<unknown> {
    this.ensureToken();
    await this.rateLimiter.acquire();
    const url = `${FIGMA_API_BASE}${path}`;
    logger.debug(`REST POST ${path}`);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "X-Figma-Token": this.token!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    return this.handleResponse(res, `POST ${path}`);
  }

  private async rawGet(path: string, params?: Record<string, string>): Promise<unknown> {
    this.ensureToken();
    await this.rateLimiter.acquire();
    const url = new URL(`${FIGMA_API_BASE}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
      }
    }

    logger.debug(`REST GET ${path}`);
    const res = await fetch(url.toString(), {
      headers: { "X-Figma-Token": this.token! },
    });

    return this.handleResponse(res, `GET ${path}`);
  }

  private async handleResponse(res: Response, operation: string): Promise<unknown> {
    if (res.ok) return res.json();

    const body = await res.text();
    switch (res.status) {
      case 401:
      case 403:
        throw new AuthError(`${operation}: ${body}`);
      case 429: {
        const retryAfter = Number(res.headers.get("Retry-After") ?? 60) * 1000;
        throw new RateLimitError(retryAfter);
      }
      default:
        throw new FigmaMcpError(
          `Figma API ${res.status} (${operation}): ${body}`,
          "API_ERROR",
          res.status >= 500,
        );
    }
  }

  private ensureToken(): void {
    if (!this.token) {
      throw new AuthError();
    }
  }
}
