# Figma MCP Wrapper — 아키텍처 설계

> **버전**: v0.2.0
> **최종 업데이트**: 2026-03-10

---

## 1. 개요

72개 MCP Tool로 Figma를 완전 제어하는 MCP 서버.
기존 TalkToFigma를 완전 대체하며, Figma REST API + Plugin API 전체를 커버한다.

- **stdio / HTTP 듀얼 모드** 지원
- **pm2**로 HTTP 데몬 상시 운영
- **멀티 레포**에서 `.mcp.json`만 추가하면 사용 가능

---

## 2. 시스템 구성도

```
┌──────────────────────────────────────────────────────────────────┐
│                    figma-mcp-wrapper (v0.2.0)                 │
│                                                                  │
│  ┌──────────────┐   ┌────────────────┐   ┌───────────────────┐  │
│  │  MCP Server   │   │  Tool Registry  │   │  Shared Schemas   │  │
│  │  (server.ts)  │──▶│  (72 tools)     │──▶│  (color, enum)    │  │
│  │  stdio / HTTP │   │  _registry.ts   │   │  src/schemas/     │  │
│  └──────┬────────┘   └────────┬───────┘   └───────────────────┘  │
│         │                     │                                   │
│         │            ┌────────┴────────┐                          │
│         │            ▼                 ▼                          │
│  ┌──────┴──────┐  ┌───────────────┐  ┌────────────────────────┐  │
│  │ Error Layer  │  │ Plugin Bridge │  │     REST Client        │  │
│  │ (4 classes)  │  │ (WebSocket)   │  │ retry + rate-limit     │  │
│  │ src/errors/  │  │               │  │ + cache                │  │
│  └─────────────┘  └───────┬───────┘  └───────────┬────────────┘  │
│                           │                       │               │
│                    ┌──────┴──────┐          ┌─────┴──────┐       │
│                    │  WS Relay   │          │ Figma API  │       │
│                    │  :3055      │          │ REST v1    │       │
│                    │  heartbeat  │          └────────────┘       │
│                    └──────┬──────┘                                │
└───────────────────────────┼──────────────────────────────────────┘
                            │ WebSocket
                     ┌──────┴──────┐
                     │ Figma Plugin│
                     │ (브라우저)   │
                     └─────────────┘
```

---

## 3. 레이어 구조

### 3.1 서버 레이어 (server.ts, config.ts)

| 모드 | 전송 | 세션 | 사용 시나리오 |
|------|------|------|-------------|
| stdio | StdioServerTransport | 단일 | Claude가 자식 프로세스로 실행 |
| HTTP | StreamableHTTPServerTransport (:3056) | 다중 | 데몬으로 상시 실행, 여러 Claude 세션 동시 접속 |

- SIGTERM/SIGINT graceful shutdown 지원
- Health check: `GET http://localhost:3056/health`

### 3.2 Tool 레이어 (src/tools/)

72개 도구, 12개 카테고리. `pluginTool()` 헬퍼로 보일러플레이트 최소화.

| 카테고리 | 수 | 타입 | 주요 Tool |
|---------|---|------|----------|
| Connection | 1 | Plugin | join_channel |
| Document | 6 | Plugin | get_document_info, read_my_design, scan_nodes_by_types |
| Node | 19 | Plugin | create_frame, create_text, move_node, boolean_operation |
| Style | 9 | Plugin | set_fill_color, set_effect, set_gradient |
| Text | 5 | Plugin | scan_text_nodes, set_text_style, set_text_range_style |
| Layout | 7 | Plugin | set_layout_mode, set_padding, set_constraints |
| Component | 8 | Plugin | create_component, create_component_set |
| Annotation | 3 | Plugin | get_annotations, set_annotation |
| Export | 4 | Plugin | export_node_as_image, get_reactions |
| Variable | 2 | Plugin | bind_variable, unbind_variable |
| Batch | 1 | Plugin | batch_execute |
| REST API | 8 | REST | get_file, get_variables, set_variables |

### 3.3 Transport 레이어 (src/transport/)

```
cachedGet → retriedGet → rawGet
                            ├── ensureToken()
                            ├── rateLimiter.acquire()
                            ├── fetch()
                            └── handleResponse() → Error 분류
```

| 모듈 | 역할 |
|------|------|
| **PluginBridge** | UUID 기반 요청/응답 매칭, progress 업데이트, timeout |
| **WsRelay** | 내장 WebSocket 서버 (:3055), 채널 관리, 30s ping/pong heartbeat |
| **RestClient** | Figma REST API v1, 레이어 구조 cachedGet → retriedGet → rawGet |
| **TtlCache** | TTL + 크기 제한 (60s, 100 entries), 패턴 기반 invalidation |
| **RateLimiter** | 토큰 버킷 (60 req/min) |
| **withRetry** | 지수 백오프 + jitter, RateLimitError 대응, AuthError 즉시 throw |

#### 캐시 정책

| 메서드 | 캐시 | TTL |
|--------|------|-----|
| getFile | O | 60s |
| getFileNodes | O | 60s |
| getFileComponents | O | 60s |
| getFileStyles | O | 60s |
| getPublishedVariables | O | 60s |
| getImages | X | — |
| getLocalVariables | X | — |
| postVariables | X + invalidate | — |

### 3.4 에러 계층 (src/errors/)

```
FigmaMcpError (base)
├── AuthError           — 401/403, non-retryable
├── RateLimitError      — 429, retryable, retryAfterMs
├── PluginTimeoutError  — retryable
└── PluginDisconnectedError — non-retryable
```

### 3.5 공유 스키마 (src/schemas/)

| 파일 | 스키마 |
|------|--------|
| color.ts | ColorRGB, ColorRGBA, ColorFull |
| enums.ts | LayoutMode, LayoutSizing, PrimaryAxisAlign, CounterAxisAlign, TextDecoration, SpacingUnit, ImageFormatPlugin, ImageFormatRest, CrudAction |

---

## 4. 프로젝트 구조

```
src/
├── server.ts                     # MCP 서버 (stdio/HTTP 듀얼)
├── config.ts                     # CLI + 환경변수 설정
├── schemas/                      # 공유 Zod 스키마
│   ├── color.ts
│   ├── enums.ts
│   └── index.ts
├── errors/                       # 에러 계층
│   ├── base.ts
│   ├── auth.ts
│   ├── rate-limit.ts
│   ├── plugin.ts
│   └── index.ts
├── transport/                    # 통신 레이어
│   ├── plugin-bridge.ts
│   ├── ws-relay.ts
│   ├── rest-client.ts
│   ├── retry.ts
│   ├── rate-limiter.ts
│   ├── cache.ts
│   └── __tests__/               # 35 tests
│       ├── cache.test.ts
│       ├── rate-limiter.test.ts
│       ├── retry.test.ts
│       ├── plugin-bridge.test.ts
│       └── rest-client.test.ts
├── tools/                        # 72 MCP Tools
│   ├── _registry.ts
│   ├── types.ts
│   ├── connection/
│   ├── document/
│   ├── node/
│   │   ├── shapes.ts
│   │   ├── queries.ts
│   │   ├── manipulation.ts
│   │   └── index.ts
│   ├── style/
│   ├── text/
│   ├── layout/
│   ├── component/
│   ├── annotation/
│   ├── export/
│   ├── variable/
│   ├── batch/
│   └── rest/
└── utils/
    └── logger.ts

figma-plugin/                     # Figma Plugin
├── src/
│   ├── code.ts                   # Plugin 진입점
│   └── handlers/                 # 핸들러 모듈 (10개)
├── manifest.json
└── package.json
```

---

## 5. 기술 스택

| 영역 | 선택 | 버전 |
|------|------|------|
| Runtime | Node.js | 20+ |
| Language | TypeScript (strict) | 5.9 |
| MCP SDK | @modelcontextprotocol/sdk | 1.27 |
| Schema | Zod | 4.3 |
| WebSocket | ws | 8.19 |
| Build | tsup (ESM, node20) | 8.5 |
| Test | Vitest | 4.0 |
| Lint | Biome | 2.4 |
| Process Manager | pm2 | — |

---

## 6. 운영

### pm2 (추천)

```bash
# 최초 설정
npm run build
pm2 start dist/server.js --name figma-mcp -- --mode=http
pm2 save && pm2 startup

# 일상 관리
pm2 status                          # 상태
pm2 logs figma-mcp                  # 로그
pm2 restart figma-mcp               # 재시작

# 코드 수정 후
npm run build && pm2 restart figma-mcp
```

### 멀티 레포 사용

서버 하나를 pm2로 띄워두면, 다른 프로젝트에서 `.mcp.json`만 추가:

```json
{
  "mcpServers": {
    "TalkToFigma": {
      "type": "http",
      "url": "http://localhost:3056/mcp"
    }
  }
}
```

### 환경변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| FIGMA_ACCESS_TOKEN | (없음) | Figma PAT |
| MCP_MODE | stdio | `http`으로 데몬 모드 |
| MCP_HTTP_PORT | 3056 | HTTP 서버 포트 |
| FIGMA_WS_PORT | 3055 | WebSocket 릴레이 포트 |
| REQUEST_TIMEOUT_MS | 30000 | Plugin 응답 타임아웃 |
| DEBUG | (없음) | 디버그 로그 활성화 |

### Health Check

```bash
curl http://localhost:3056/health
# → {"status":"ok","sessions":1,"tools":72,"wsPort":3055}
```

---

## 7. Phase 이력

| Phase | 내용 | Tools | 상태 |
|-------|------|-------|------|
| 1 | TalkToFigma 동등 대체 | 45 | ✅ 완료 |
| 2 | 갭 해소 (이펙트, 텍스트 스타일, Constraints) | 62 | ✅ 완료 |
| 3 | Variables, Component 생성, Batch | 72 | ✅ 완료 |
| 4 | 코드 품질, 복원력, 테스트 (35 tests) | 72 | ✅ 완료 |

---

*이전 버전 (2025-08-14)은 자동동기화 데몬 설계로, 현재 MCP 서버 구현과 무관합니다.*
