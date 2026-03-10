# Phase 4 — 코드 품질 개선 + 프로덕션 복원력 확보

> **목표**: 72개 Tool 기반 MCP 서버의 DRY 위반 해소, 통신 복원력 강화, 테스트 인프라 구축
> **상태**: ✅ 구현 완료 (Phase 4-A/B/C 전체)
> **작성일**: 2026-03-10
> **작성자**: 금희 (기술 리드)
> **선행 조건**: Phase 3-B 완료 (72 Tools)
> **상위 문서**: [implementation-plan.md](./implementation-plan.md)

---

## 1. 현재 상태 평가

### 1.1 전체 코드 품질 점수

| 영역 | 점수 | 상태 | 핵심 이슈 |
|------|------|------|----------|
| 아키텍처 | 8/10 | ✅ 우수 | 3-Layer 분리, pluginTool 추상화 |
| 모듈성 | 7/10 | ⚠️ 양호 | _registry.ts 허브 안티패턴 |
| DRY 원칙 | 4/10 | ❌ 미흡 | 스키마/enum 10회+ 중복 |
| 타입 안전성 | 6/10 | ⚠️ 양호 | 타입 가드 부재, `as` 캐스팅 |
| 에러 복원력 | 3/10 | ❌ 미흡 | 재시도·레이트리밋·캐싱 전무 |
| 테스트 | 0/10 | ❌ 부재 | Vitest 설치만, 테스트 파일 0개 |
| 보안 | 7/10 | ✅ 해결 | SSE 모드 전환, `~/.envs` 참조 |

**종합: 5.0/10** — 아키텍처 기반 우수, 보안 해결 완료, 복원력·테스트 보강 필요

### 1.2 코드 규모 현황

```
총 TypeScript 파일: 30개+ (테스트 포함)
총 LOC: ~2,400줄
도구 수: 72개 (12개 카테고리)
빌드 산출물: 56 KB (dist/server.js)
테스트: 5파일, 35 tests (vitest)

node/index.ts → shapes.ts + queries.ts + manipulation.ts 분할 완료
schemas/ 공유 스키마 추출 완료 (color, enums)
errors/ 에러 계층 구현 완료 (4 classes)
transport/ retry + rate-limiter + cache 구현 완료
```

### 1.3 CRITICAL 이슈

#### ~~C-1. `.mcp.json`에 Figma API 토큰 하드코딩~~ ✅ 해결 완료

SSE 모드로 전환 완료. 토큰은 `~/.envs`에서 관리.

```jsonc
// 현재 — SSE 모드, 토큰 분리 완료
{
  "mcpServers": {
    "TalkToFigma": {
      "url": "http://localhost:3056/mcp",
      "type": "sse"
    }
  }
}
```

#### C-2. 이미지 포맷 enum 케이싱 불일치

```typescript
// export/index.ts:9 (Plugin API)
format: z.enum(["PNG", "JPG", "SVG", "PDF"])

// rest/index.ts:142 (REST API)
format: z.enum(["png", "jpg", "svg", "pdf"])
```

**수정**: API별 정확한 기대값 검증 후 통일. Plugin은 대문자, REST는 소문자가 Figma 공식 규격.

#### C-3. 통신 계층 복원력 전무

| | Timeout | Retry | Rate Limit | Cache | Circuit Breaker |
|---|:---:|:---:|:---:|:---:|:---:|
| WebSocket Relay | ❌ | N/A | ❌ | N/A | ❌ |
| Plugin Bridge | ✅ 30s | ❌ | ❌ | ❌ | ❌ |
| REST Client | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 2. 목표 구조 (리팩터링 후)

```
src/
├── server.ts                          # 유지 (69 LOC)
├── config.ts                          # 환경변수 검증 강화
│
├── schemas/                           # ✨ NEW — 공유 스키마
│   ├── color.ts                       #   ColorRGB, ColorRGBA
│   ├── enums.ts                       #   BlendMode, LayoutSizing, Alignment 등
│   ├── geometry.ts                    #   Position, Size, Bounds
│   └── index.ts                       #   re-export barrel
│
├── transport/                         # 복원력 계층 추가
│   ├── rest-client.ts                 #   + retry, rate-limit, error hierarchy
│   ├── plugin-bridge.ts              #   + request queue, dead-letter logging
│   ├── ws-relay.ts                    #   + ping/pong heartbeat, graceful shutdown
│   ├── retry.ts                       # ✨ NEW — 지수 백오프 + 지터
│   ├── rate-limiter.ts                # ✨ NEW — 토큰 버킷
│   └── cache.ts                       # ✨ NEW — TTL 기반 LRU 캐시
│
├── tools/
│   ├── _registry.ts                   # → 동적 import 리팩터링
│   ├── types.ts                       #   ToolDefinition, ToolContext
│   │
│   ├── node/                          # 🔧 분할 (292 → ~100 LOC × 3)
│   │   ├── shapes.ts                  #   create_rectangle, frame, ellipse, line, ...
│   │   ├── queries.ts                 #   get_node_info, get_nodes_info
│   │   ├── manipulation.ts            #   move, resize, clone, delete
│   │   └── index.ts                   #   re-export barrel
│   │
│   ├── style/index.ts                 # 기존 유지
│   ├── layout/index.ts
│   ├── text/index.ts
│   ├── component/index.ts
│   ├── rest/index.ts
│   ├── variable/index.ts
│   ├── annotation/index.ts
│   ├── export/index.ts
│   ├── document/index.ts
│   ├── batch/index.ts
│   └── connection/join-channel.ts
│
├── errors/                            # ✨ NEW — 에러 계층
│   ├── base.ts                        #   FigmaMcpError
│   ├── auth.ts                        #   AuthError (401)
│   ├── rate-limit.ts                  #   RateLimitError (429)
│   └── plugin.ts                      #   PluginTimeoutError, PluginDisconnectedError
│
├── utils/
│   └── logger.ts                      # → 구조화 로깅 (JSON + traceId)
│
└── __tests__/                         # ✨ NEW — 테스트
    ├── schemas/
    │   └── shared-schemas.test.ts
    ├── transport/
    │   ├── rest-client.test.ts
    │   ├── plugin-bridge.test.ts
    │   └── retry.test.ts
    ├── tools/
    │   ├── node.test.ts
    │   └── registry.test.ts
    └── integration/
        └── server.test.ts
```

---

## 3. 개선 항목 상세

### ~~Step 0 — 보안 즉시 조치~~ ✅ 해결 완료

SSE 모드(`http://localhost:3056/mcp`)로 전환 완료. 토큰은 `~/.envs`에서 환경변수로 관리.

---

### Step 1 — 공유 스키마 추출 (DRY 해소)

**범위**: Color, enum, geometry 스키마를 공유 모듈로 추출
**효과**: ~100 LOC 중복 제거, 유지보수 단일 지점

#### 1-1. `src/schemas/color.ts`

```typescript
import { z } from "zod";

/** RGB 색상 (alpha 없음 — Section fillColor 등) */
export const ColorRGB = z.object({
  r: z.number().min(0).max(1).describe("Red (0-1)"),
  g: z.number().min(0).max(1).describe("Green (0-1)"),
  b: z.number().min(0).max(1).describe("Blue (0-1)"),
});

/** RGBA 색상 (alpha 선택 — 대부분의 색상 파라미터) */
export const ColorRGBA = ColorRGB.extend({
  a: z.number().min(0).max(1).optional().describe("Alpha (0-1, 기본 1)"),
});

export type ColorRGBType = z.infer<typeof ColorRGB>;
export type ColorRGBAType = z.infer<typeof ColorRGBA>;
```

**적용 대상** (10개소):
| 파일 | 파라미터 | 교체 스키마 |
|------|---------|-----------|
| `node/index.ts:57` | createFrame.fillColor | `ColorRGBA.optional()` |
| `node/index.ts:61` | createFrame.strokeColor | `ColorRGBA.optional()` |
| `node/index.ts:94` | createText.fontColor | `ColorRGBA.optional()` |
| `node/index.ts:183` | createLine.strokeColor | `ColorRGBA.optional()` |
| `node/index.ts:263` | createSection.fillColor | `ColorRGB.optional()` |
| `style/index.ts:63` | setEffect.shadow.color | `ColorRGBA` |
| `style/index.ts:89` | setGradient.colorStop | `ColorRGBA` |
| `text/index.ts:66` | setTextStyle.color | `ColorRGBA.optional()` |
| `text/index.ts:84` | setTextRangeStyle.color | `ColorRGBA.optional()` |
| `layout/index.ts:96` | setGrid.color | `ColorRGBA.optional()` |

#### 1-2. `src/schemas/enums.ts`

```typescript
import { z } from "zod";

// ── Layout ──────────────────────────────────────────
export const LayoutMode = z.enum(["HORIZONTAL", "VERTICAL", "NONE"]);
export const LayoutSizing = z.enum(["FIXED", "HUG", "FILL"]);
export const PrimaryAxisAlign = z.enum(["MIN", "CENTER", "MAX", "SPACE_BETWEEN"]);
export const CounterAxisAlign = z.enum(["MIN", "CENTER", "MAX", "BASELINE"]);
export const ConstraintType = z.enum(["MIN", "CENTER", "MAX", "STRETCH", "SCALE"]);
export const GridAlign = z.enum(["MIN", "CENTER", "MAX", "STRETCH"]);

// ── Style ───────────────────────────────────────────
export const BlendMode = z.enum([
  "NORMAL", "DARKEN", "MULTIPLY", "COLOR_BURN",
  "LIGHTEN", "SCREEN", "COLOR_DODGE",
  "OVERLAY", "SOFT_LIGHT", "HARD_LIGHT",
  "DIFFERENCE", "EXCLUSION",
  "HUE", "SATURATION", "COLOR", "LUMINOSITY",
]);

// ── Text ────────────────────────────────────────────
export const TextDecoration = z.enum(["NONE", "UNDERLINE", "STRIKETHROUGH"]);
export const TextCase = z.enum(["ORIGINAL", "UPPER", "LOWER", "TITLE"]);
export const TextAlignH = z.enum(["LEFT", "CENTER", "RIGHT", "JUSTIFIED"]);
export const TextAlignV = z.enum(["TOP", "CENTER", "BOTTOM"]);
export const SpacingUnit = z.enum(["PIXELS", "PERCENT"]);

// ── Image / Export ──────────────────────────────────
/** Plugin API — 대문자 (Figma Plugin API 규격) */
export const ImageFormatPlugin = z.enum(["PNG", "JPG", "SVG", "PDF"]);
/** REST API — 소문자 (Figma REST API 규격) */
export const ImageFormatRest = z.enum(["png", "jpg", "svg", "pdf"]);

// ── CRUD ────────────────────────────────────────────
export const CrudAction = z.enum(["CREATE", "UPDATE", "DELETE"]);

// ── Effect ──────────────────────────────────────────
export const EffectType = z.enum([
  "DROP_SHADOW", "INNER_SHADOW", "LAYER_BLUR", "BACKGROUND_BLUR",
]);
```

**적용 대상** (9개소+):
| 중복 enum | 발생 횟수 | 교체 상수 |
|-----------|----------|----------|
| `["FIXED", "HUG", "FILL"]` | 4회 | `LayoutSizing` |
| `["MIN", "CENTER", "MAX", "BASELINE"]` | 2회 | `CounterAxisAlign` |
| `["NONE", "UNDERLINE", "STRIKETHROUGH"]` | 2회 | `TextDecoration` |
| `["PIXELS", "PERCENT"]` | 2회 | `SpacingUnit` |
| `["CREATE", "UPDATE", "DELETE"]` | 3회 | `CrudAction` |
| `["PNG", "JPG", "SVG", "PDF"]` vs 소문자 | 2회 | `ImageFormatPlugin` / `ImageFormatRest` |

#### 1-3. `src/schemas/geometry.ts`

```typescript
import { z } from "zod";

/** 위치 (x, y) */
export const Position = z.object({
  x: z.number().describe("X 좌표"),
  y: z.number().describe("Y 좌표"),
});

/** 크기 (width, height) */
export const Size = z.object({
  width: z.number().min(0.01).describe("너비"),
  height: z.number().min(0.01).describe("높이"),
});

/** 바운딩 박스 */
export const Bounds = Position.merge(Size);
```

#### 1-4. `src/schemas/index.ts` (barrel export)

```typescript
export * from "./color.js";
export * from "./enums.js";
export * from "./geometry.js";
```

---

### Step 2 — node/index.ts 분할

**범위**: 292 LOC, 19 tools → 3파일 (~100 LOC each)
**효과**: 인지 부하 감소, 카테고리별 독립 유지보수

#### 분할 계획

| 파일 | 포함 Tool | 예상 LOC |
|------|----------|---------|
| `node/shapes.ts` | create_rectangle, create_frame, create_text, create_ellipse, create_line, create_polygon, create_star, create_vector, create_group, create_section | ~150 |
| `node/queries.ts` | get_node_info, get_nodes_info | ~30 |
| `node/manipulation.ts` | move_node, resize_node, clone_node, delete_node, delete_multiple_nodes, reorder_child, boolean_operation | ~80 |
| `node/index.ts` | re-export barrel | ~10 |

```typescript
// node/index.ts (리팩터링 후)
export * from "./shapes.js";
export * from "./queries.js";
export * from "./manipulation.js";
```

---

### Step 3 — 레지스트리 동적 import

**범위**: _registry.ts 239 LOC → ~30 LOC
**효과**: 새 도구 추가 시 레지스트리 수정 불필요

```typescript
// tools/_registry.ts (리팩터링 후)
import type { ToolDefinition } from "./types.js";

const TOOL_MODULES = [
  "./connection/join-channel.js",
  "./document/index.js",
  "./node/index.js",
  "./style/index.js",
  "./text/index.js",
  "./layout/index.js",
  "./component/index.js",
  "./annotation/index.js",
  "./export/index.js",
  "./rest/index.js",
  "./variable/index.js",
  "./batch/index.js",
] as const;

function isToolDefinition(value: unknown): value is ToolDefinition {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    "handler" in value &&
    "schema" in value
  );
}

export async function loadAllTools(): Promise<ToolDefinition[]> {
  const modules = await Promise.all(
    TOOL_MODULES.map((path) => import(path))
  );
  return modules.flatMap((mod) =>
    Object.values(mod).filter(isToolDefinition)
  );
}
```

**server.ts 수정**:

```typescript
// 변경 전
import { allTools } from "./tools/_registry.js";
// ...
for (const tool of allTools) { ... }

// 변경 후
import { loadAllTools } from "./tools/_registry.js";
// ...
const allTools = await loadAllTools();
for (const tool of allTools) { ... }
```

---

### Step 4 — 에러 계층 구조

**범위**: 에러 타입 분류, REST 에러 세분화
**효과**: 디버깅 속도 향상, 조건부 재시도 가능

#### 4-1. `src/errors/base.ts`

```typescript
export class FigmaMcpError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = "FigmaMcpError";
  }
}
```

#### 4-2. `src/errors/auth.ts`

```typescript
import { FigmaMcpError } from "./base.js";

export class AuthError extends FigmaMcpError {
  constructor(message = "FIGMA_ACCESS_TOKEN이 설정되지 않았거나 만료됨") {
    super(message, "AUTH_ERROR", false); // 재시도 불가
  }
}
```

#### 4-3. `src/errors/rate-limit.ts`

```typescript
import { FigmaMcpError } from "./base.js";

export class RateLimitError extends FigmaMcpError {
  constructor(
    public readonly retryAfterMs: number,
    message = `Figma API rate limit 초과 (${retryAfterMs}ms 후 재시도)`,
  ) {
    super(message, "RATE_LIMIT", true); // 재시도 가능
  }
}
```

#### 4-4. `src/errors/plugin.ts`

```typescript
import { FigmaMcpError } from "./base.js";

export class PluginTimeoutError extends FigmaMcpError {
  constructor(command: string, timeoutMs: number) {
    super(
      `Figma Plugin이 ${command}에 ${timeoutMs / 1000}초 내 응답하지 않음`,
      "PLUGIN_TIMEOUT",
      true,
    );
  }
}

export class PluginDisconnectedError extends FigmaMcpError {
  constructor() {
    super(
      "Figma Plugin이 연결되지 않음. join_channel을 먼저 실행하세요",
      "PLUGIN_DISCONNECTED",
      false,
    );
  }
}
```

#### 4-5. REST Client 에러 매핑

```typescript
// transport/rest-client.ts — 개선
import { AuthError } from "../errors/auth.js";
import { RateLimitError } from "../errors/rate-limit.js";

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
        res.status >= 500, // 5xx만 재시도 가능
      );
  }
}
```

---

### Step 5 — 통신 복원력 강화

**범위**: retry, rate-limit, cache 유틸리티 + 기존 transport 통합
**효과**: Figma API 안정성 대폭 향상

#### 5-1. `src/transport/retry.ts` — 지수 백오프 + 지터

```typescript
import { FigmaMcpError } from "../errors/base.js";
import { AuthError } from "../errors/auth.js";
import { RateLimitError } from "../errors/rate-limit.js";
import { logger } from "../utils/logger.js";

export interface RetryOptions {
  maxRetries: number;    // 기본 3
  baseMs: number;        // 기본 1000
  maxMs: number;         // 기본 30000
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseMs: 1000,
  maxMs: 30000,
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      // 인증 에러는 재시도 불가
      if (err instanceof AuthError) throw err;

      // 재시도 불가능한 에러
      if (err instanceof FigmaMcpError && !err.retryable) throw err;

      // 마지막 시도 실패
      if (attempt === opts.maxRetries) throw err;

      // 대기 시간 계산
      let delayMs: number;
      if (err instanceof RateLimitError) {
        delayMs = err.retryAfterMs;
      } else {
        const jitter = Math.random() * 500;
        delayMs = Math.min(opts.baseMs * 2 ** attempt + jitter, opts.maxMs);
      }

      logger.warn(
        `Retry ${attempt + 1}/${opts.maxRetries} after ${Math.round(delayMs)}ms: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  throw new Error("unreachable");
}
```

#### 5-2. `src/transport/rate-limiter.ts` — 토큰 버킷

```typescript
/**
 * 토큰 버킷 레이트 리미터
 * Figma API 제한: Dev/Full = 분당 120, Starter = 분당 60
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private maxTokens: number = 60,       // 분당 최대 요청
    private refillIntervalMs: number = 60_000,  // 1분
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens > 0) {
      this.tokens--;
      return;
    }

    // 토큰 없으면 다음 리필까지 대기
    const waitMs = this.refillIntervalMs - (Date.now() - this.lastRefill);
    await new Promise((r) => setTimeout(r, Math.max(waitMs, 100)));
    this.refill();
    this.tokens--;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    if (elapsed >= this.refillIntervalMs) {
      this.tokens = this.maxTokens;
      this.lastRefill = now;
    }
  }
}
```

#### 5-3. `src/transport/cache.ts` — TTL 기반 LRU 캐시

```typescript
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * TTL 기반 LRU 캐시
 * 주 용도: get_file, get_file_components 등 읽기 전용 REST 호출 캐싱
 */
export class TtlCache {
  private store = new Map<string, CacheEntry<unknown>>();

  constructor(
    private defaultTtlMs: number = 60_000,    // 기본 1분
    private maxEntries: number = 100,
  ) {}

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    // LRU: 접근 시 맨 뒤로 이동
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs?: number): void {
    // 용량 초과 시 가장 오래된 항목 제거
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
    });
  }

  invalidate(pattern?: string): void {
    if (!pattern) {
      this.store.clear();
      return;
    }
    for (const key of this.store.keys()) {
      if (key.includes(pattern)) this.store.delete(key);
    }
  }
}
```

#### 5-4. REST Client 통합 적용

```typescript
// transport/rest-client.ts — retry + rate-limit + cache 통합
import { withRetry } from "./retry.js";
import { RateLimiter } from "./rate-limiter.js";
import { TtlCache } from "./cache.js";

export class RestClient {
  private rateLimiter = new RateLimiter(60); // 분당 60회 (안전 마진)
  private cache = new TtlCache(60_000, 100);

  async getFile(fileKey: string): Promise<unknown> {
    const cacheKey = `file:${fileKey}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const result = await withRetry(async () => {
      await this.rateLimiter.acquire();
      return this.request(`/files/${fileKey}`);
    });

    this.cache.set(cacheKey, result);
    return result;
  }

  // ... 다른 메서드도 동일 패턴 적용
}
```

#### 5-5. WebSocket Relay 안정화

```typescript
// transport/ws-relay.ts — 추가 사항

// 1. Ping/Pong heartbeat (30초 간격)
private startHeartbeat(): void {
  this.heartbeatInterval = setInterval(() => {
    for (const [channel, clients] of this.channels) {
      for (const ws of clients) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      }
    }
  }, 30_000);
}

// 2. Graceful shutdown
async shutdown(): Promise<void> {
  if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
  for (const [, clients] of this.channels) {
    for (const ws of clients) {
      ws.close(1000, "Server shutting down");
    }
  }
  this.wss?.close();
  logger.info("WebSocket relay shut down gracefully");
}
```

```typescript
// server.ts — graceful shutdown 등록
process.on("SIGINT", async () => {
  await pluginBridge.relay.shutdown();
  process.exit(0);
});
```

---

### Step 6 — 입력 검증 강화

**범위**: 누락된 범위 검증, XOR 파라미터 검증 추가
**효과**: 잘못된 입력에 대한 명확한 에러 메시지

#### 6-1. 숫자 범위 검증 누락 (3개소)

```typescript
// variable/index.ts:29 — 수정 전
fillIndex: z.number().optional()
// 수정 후
fillIndex: z.number().min(0).optional().describe("Fill 배열 인덱스 (0부터)")

// text/index.ts:78-79 — 수정 전
start: z.number()
end: z.number()
// 수정 후
start: z.number().min(0).describe("시작 인덱스 (0부터)"),
end: z.number().min(0).describe("종료 인덱스"),
```

#### 6-2. XOR 파라미터 검증 (component/index.ts)

```typescript
// create_component_instance — componentId XOR componentKey 중 하나 필수
// 현재: 둘 다 optional, 검증 없음
// 개선: Zod refinement 추가

const createInstanceSchema = z.object({
  x: z.number().describe("X position"),
  y: z.number().describe("Y position"),
  componentId: z.string().optional()
    .describe("Local component ID (get_local_components로 조회)"),
  componentKey: z.string().optional()
    .describe("Published component key (라이브러리 컴포넌트용)"),
  parentId: z.string().optional().describe("부모 노드 ID"),
}).refine(
  (data) => Boolean(data.componentId) !== Boolean(data.componentKey),
  { message: "componentId 또는 componentKey 중 정확히 하나를 지정해야 합니다" }
);
```

#### 6-3. Plugin Bridge 미연결 시 명확한 에러

```typescript
// transport/plugin-bridge.ts — sendCommand 시작부
async sendCommand(command: string, params: Record<string, unknown> = {}): Promise<unknown> {
  if (!this.currentChannel) {
    throw new PluginDisconnectedError();
    // 기존: "Not connected to any channel" (맥락 부족)
  }
  // ...
}
```

---

### Step 7 — 로깅 구조화

**범위**: stderr JSON 로깅, traceId 전파
**효과**: 요청 추적, 성능 모니터링 기반

```typescript
// utils/logger.ts — 구조화 로깅 (리팩터링 후)
import { randomUUID } from "node:crypto";

export interface LogContext {
  traceId?: string;
  tool?: string;
  duration?: number;
}

function write(level: string, msg: string, ctx?: LogContext): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...ctx,
  };
  process.stderr.write(JSON.stringify(entry) + "\n");
}

export const logger = {
  info: (msg: string, ctx?: LogContext) => write("INFO", msg, ctx),
  warn: (msg: string, ctx?: LogContext) => write("WARN", msg, ctx),
  error: (msg: string, ctx?: LogContext) => write("ERROR", msg, ctx),
  debug: (msg: string, ctx?: LogContext) => {
    if (process.env.DEBUG) write("DEBUG", msg, ctx);
  },
  newTraceId: () => randomUUID().slice(0, 8),
};
```

**서버 통합**:

```typescript
// server.ts — 도구 실행 시 traceId 부여
server.tool(tool.name, schema, async (params) => {
  const traceId = logger.newTraceId();
  const start = Date.now();
  try {
    const result = await tool.handler(params as Record<string, unknown>, ctx);
    logger.info(`${tool.name} OK`, { traceId, tool: tool.name, duration: Date.now() - start });
    return { content: [{ type: "text" as const, text: result }] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`${tool.name} FAIL: ${message}`, { traceId, tool: tool.name, duration: Date.now() - start });
    return { content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }], isError: true };
  }
});
```

---

### Step 8 — 테스트 인프라 구축

**범위**: Vitest 설정 + 핵심 모듈 테스트
**목표 커버리지**: 핵심 모듈 70%+

#### 8-1. `vitest.config.ts`

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["src/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/__tests__/**", "src/tools/**/index.ts"],
      thresholds: {
        statements: 50,
        branches: 40,
        functions: 50,
        lines: 50,
      },
    },
  },
});
```

#### 8-2. 우선 테스트 대상

| 모듈 | 테스트 항목 | 우선순위 |
|------|-----------|---------|
| `schemas/*` | 유효/무효 입력, 경계값 | P0 |
| `transport/retry.ts` | 지수 백오프, 에러 타입별 분기 | P0 |
| `transport/rate-limiter.ts` | 토큰 소진/리필 | P0 |
| `transport/cache.ts` | TTL 만료, LRU 축출 | P0 |
| `errors/*` | 에러 계층 속성 검증 | P1 |
| `transport/rest-client.ts` | 에러 매핑, 캐시 히트/미스 | P1 |
| `tools/_registry.ts` | 동적 로딩, 72개 도구 등록 확인 | P1 |
| `config.ts` | CLI 인자 파싱, 환경변수 기본값 | P2 |

#### 8-3. 테스트 예시 — `retry.test.ts`

```typescript
import { describe, it, expect, vi } from "vitest";
import { withRetry } from "../../transport/retry.js";
import { AuthError } from "../../errors/auth.js";
import { RateLimitError } from "../../errors/rate-limit.js";

describe("withRetry", () => {
  it("성공 시 즉시 반환", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    expect(await withRetry(fn)).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("일시적 에러 후 재시도 성공", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValue("ok");

    expect(await withRetry(fn, { baseMs: 10 })).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("AuthError는 재시도하지 않음", async () => {
    const fn = vi.fn().mockRejectedValue(new AuthError());
    await expect(withRetry(fn)).rejects.toThrow(AuthError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("RateLimitError는 retryAfterMs 대기 후 재시도", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new RateLimitError(100))
      .mockResolvedValue("ok");

    const start = Date.now();
    await withRetry(fn, { baseMs: 10 });
    expect(Date.now() - start).toBeGreaterThanOrEqual(90);
  });

  it("maxRetries 초과 시 마지막 에러 throw", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));
    await expect(withRetry(fn, { maxRetries: 2, baseMs: 10 })).rejects.toThrow("fail");
    expect(fn).toHaveBeenCalledTimes(3); // 초기 + 2회 재시도
  });
});
```

---

### Step 9 — CI/CD 파이프라인

**범위**: GitHub Actions — lint, typecheck, test, build
**효과**: PR 시 자동 품질 게이트

#### 9-1. `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type Check
        run: npx tsc --noEmit

      - name: Test
        run: npm test -- --run --coverage

      - name: Build
        run: npm run build

      - name: Bundle Size Check
        run: |
          SIZE=$(wc -c < dist/server.js)
          echo "Bundle size: $SIZE bytes"
          if [ "$SIZE" -gt 200000 ]; then
            echo "::warning::Bundle size exceeds 200KB"
          fi
```

---

## 4. 실행 로드맵

### Phase 4-A: 즉시 조치 + DRY 해소

| # | 작업 | Step | 예상 시간 | 영향 |
|---|------|------|----------|------|
| ~~1~~ | ~~`.mcp.json` 토큰 제거~~ | ~~Step 0~~ | - | ✅ 해결 (SSE + `~/.envs`) |
| ~~2~~ | ~~`.env.example` 생성~~ | ~~Step 0~~ | - | ✅ 해결 |
| 3 | `schemas/` 공유 스키마 추출 | Step 1 | 2시간 | ✅ 완료 |
| 4 | 이미지 포맷 enum 케이싱 정리 | Step 1 | 30분 | ✅ 완료 |
| 5 | `node/index.ts` 3파일 분할 | Step 2 | 1시간 | ✅ 완료 |

**Phase 4-A 완료 기준**: `npm run build` 성공, 72개 도구 동일 동작

### Phase 4-B: 복원력 + 에러 체계

| # | 작업 | Step | 예상 시간 | 영향 |
|---|------|------|----------|------|
| 6 | 에러 계층 구조 도입 | Step 4 | 1.5시간 | ✅ 완료 |
| 7 | `retry.ts` 지수 백오프 | Step 5-1 | 1시간 | ✅ 완료 |
| 8 | `rate-limiter.ts` 토큰 버킷 | Step 5-2 | 1시간 | ✅ 완료 |
| 9 | `cache.ts` TTL 캐시 | Step 5-3 | 1시간 | ✅ 완료 |
| 10 | REST Client 통합 적용 | Step 5-4 | 2시간 | ✅ 완료 |
| 11 | WS Relay heartbeat + shutdown | Step 5-5 | 1시간 | ✅ 완료 |
| 12 | 입력 검증 강화 | Step 6 | 30분 | ✅ 완료 |

**Phase 4-B 완료 기준**: REST API 429 응답 시 자동 재시도, 연속 실패 시 명확한 에러 메시지

### Phase 4-C: 테스트 + 자동화

| # | 작업 | Step | 예상 시간 | 영향 |
|---|------|------|----------|------|
| 13 | `vitest.config.ts` 구성 | Step 8-1 | 15분 | ✅ 완료 |
| 14 | 스키마 테스트 작성 | Step 8-2 | 1시간 | ✅ 완료 |
| 15 | 복원력 모듈 테스트 | Step 8-2 | 2시간 | ✅ 완료 |
| 16 | REST Client 테스트 | Step 8-2 | 1.5시간 | ✅ 완료 |
| 17 | 레지스트리 동적 import | Step 3 | 1시간 | ⏳ 미착수 |
| 18 | 구조화 로깅 | Step 7 | 1시간 | ⏳ 미착수 |
| 19 | GitHub Actions CI | Step 9 | 1시간 | ❌ 제외 |

**Phase 4-C 완료 기준**: `npm test` 통과, 핵심 모듈 커버리지 50%+, CI 파이프라인 동작

---

## 5. 예상 결과

### 코드 품질 점수 변화 (목표)

| 영역 | 현재 | Phase 4-A 후 | Phase 4-B 후 | Phase 4-C 후 |
|------|------|-------------|-------------|-------------|
| DRY | 4/10 | **8/10** | 8/10 | 8/10 |
| 타입 안전성 | 6/10 | 7/10 | **8/10** | 8/10 |
| 에러 복원력 | 3/10 | 3/10 | **8/10** | 8/10 |
| 테스트 | 0/10 | 0/10 | 0/10 | **6/10** |
| 보안 | 7/10 | 7/10 | 7/10 | 8/10 |
| **종합** | **5.0** | **6.3** | **7.3** | **8.0** |

### LOC 변화 (추정)

```
현재:    1,846 LOC (20 파일)
목표:   ~2,400 LOC (30 파일)
  신규:  +800 LOC (schemas, errors, retry, cache, tests)
  삭감:  -250 LOC (중복 스키마, _registry.ts 축소)
  순증:  +550 LOC (복원력·테스트 인프라 투자)
```

---

## 6. 리스크 및 대응

| 리스크 | 영향 | 확률 | 대응 |
|--------|------|------|------|
| 스키마 추출 시 기존 도구 동작 변경 | 72개 도구 깨짐 | 낮음 | 추출 전후 `npm run build` + 수동 검증 |
| 동적 import 시 번들 사이즈 변화 | 빌드 실패 | 낮음 | tsup 설정 조정 (splitting 옵션) |
| Rate Limiter 오탐 | 정상 요청 차단 | 중간 | 안전 마진 설정 (60/min), 수동 오버라이드 옵션 |
| 캐시 무효화 누락 | 오래된 데이터 반환 | 중간 | 쓰기 작업 후 관련 캐시 명시적 invalidate |
| 테스트 작성 시간 초과 | Phase 4-C 지연 | 중간 | P0 모듈만 우선 작성, 나머지 점진 추가 |

---

## 7. 참조

### 분석 에이전트 투입 결과

| 에이전트 | 분석 범위 | 핵심 발견 |
|---------|----------|----------|
| architecture-analyzer | 서버 전체 구조 | 3-Layer 우수, DRY 4/10 |
| tool-pattern-analyzer | 72개 Tool 정의 패턴 | 스키마 10회 중복, format enum 불일치 |
| communication-layer-analyzer | WebSocket + REST 통신 | 복원력 3/10, retry/cache 전무 |
| config-build-analyzer | 빌드·설정·보안 | 토큰 하드코딩, 테스트 0개 |

### 관련 문서

- [Phase 1 — 기반 구축](./phase-1-foundation.md) ✅
- [Phase 2 — 갭 해소](./phase-2-extended-tools.md) ✅
- [Phase 3 — 고급 기능](./phase-3-advanced.md) ✅
- [아키텍처 설계](../architecture/figma-mcp-server-architecture.md)

---

*다음 단계: Phase 4-A 즉시 조치부터 순차 진행*