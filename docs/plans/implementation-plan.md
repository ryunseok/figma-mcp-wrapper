# Figma MCP Wrapper 서버 구현 계획

> **목표**: cursor-talk-to-figma-mcp(TalkToFigma)를 완전 대체하는 자체 MCP 서버 구축
> **작성일**: 2026-03-09
> **최종 수정**: 2026-03-10 (Phase 4 구현 완료 반영)
> **작성자**: 금희 (기술 리드)

---

## 1. 왜 대체하는가

### TalkToFigma 한계 (실사용 기반)

| 문제 | 영향 | 빈도 |
|------|------|------|
| 도형 3종만 생성 (Rectangle, Frame, Text) | 아이콘/차트/복합 UI 구현 불가 | 매 작업 |
| 이펙트(Shadow, Blur) 없음 | 디자인 시스템 카드/모달 재현 불가 | 매 작업 |
| 텍스트 스타일 제어 불가 (font, size, weight 개별) | 생성 후 수동 조정 필요 | 매 작업 |
| 그라디언트/이미지 Fill 없음 | 배경, 버튼 스타일 제한 | 빈번 |
| Component/Variant 생성 불가 (인스턴스만) | 디자인 시스템 구축 불가 | 프로젝트 단위 |
| Variables 바인딩 없음 | 디자인 토큰 연결 불가 | 프로젝트 단위 |
| REST API 미통합 | 파일 메타/버전/변수 관리 불가 | 관리 작업 |
| WebSocket 불안정 (30초 고정 타임아웃) | 대량 작업 중 실패 | 간헐적 |
| 코드 품질 (`any` 남발, 모놀리식 2400줄) | 확장/디버깅 어려움 | 유지보수 시 |

### 자체 서버가 해결하는 것

- Figma Plugin API 전체 노드 타입 + 속성 커버
- Figma REST API 네이티브 통합 (읽기 + Variables/Webhooks 쓰기)
- 모듈화된 TypeScript 코드베이스
- 캐싱, 병렬 실행, 에러 복구

---

## 2. 아키텍처

```
┌─────────────────────────────────────────────────────┐
│            figma-mcp-wrapper                       │
│                                                       │
│  ┌────────────────┐     ┌──────────────────────────┐ │
│  │  REST Client    │     │  Plugin Bridge           │ │
│  │                 │     │  (WebSocket)             │ │
│  │  Files API      │     │                          │ │
│  │  Components API │     │  노드 CRUD (전 타입)     │ │
│  │  Styles API     │     │  스타일/이펙트/그라디언트 │ │
│  │  Variables API  │     │  텍스트 세밀 제어        │ │
│  │  Images API     │     │  Component/Variant 생성  │ │
│  │  Comments API   │     │  Variables 바인딩        │ │
│  │  Webhooks API   │     │  Boolean 연산/Mask       │ │
│  └────────┬────────┘     └────────────┬─────────────┘ │
│           │                           │               │
│           └─────────┬─────────────────┘               │
│                     ▼                                 │
│           ┌─────────────────┐                         │
│           │   Tool Registry  │  ← Zod 스키마 검증     │
│           │   (자동 라우팅)   │                         │
│           └────────┬────────┘                         │
│                    │                                  │
│       ┌────────────┼────────────┐                     │
│       ▼            ▼            ▼                     │
│    Cache       Validator     Logger                   │
│   (LRU)       (입력 검증)   (stderr)                  │
└───────────────────────┬───────────────────────────────┘
                        │ stdio (JSON-RPC)
                        ▼
                   Claude Code
```

### 핵심 설계 원칙

1. **읽기는 REST, 쓰기는 Plugin** — 자동 라우팅
2. **기존 WebSocket 프로토콜 호환** — 현재 Figma Plugin 재사용 가능
3. **카테고리 단위 모듈화** — 카테고리별 `index.ts` + `pluginTool` 헬퍼로 보일러플레이트 최소화
4. **Zod 스키마 필수** — 모든 파라미터 타입 안전
5. **점진적 Plugin 확장** — Phase 1에서는 기존 Plugin, Phase 2부터 확장 Plugin

---

## 3. 기술 스택

| 영역 | 선택 | 이유 |
|------|------|------|
| 런타임 | Node.js 20+ | MCP SDK 공식 지원 |
| 언어 | TypeScript (strict) | 타입 안전, Zod 연동 |
| MCP SDK | `@modelcontextprotocol/sdk` | 공식 SDK, McpServer + StdioServerTransport |
| 스키마 | `zod` | MCP SDK 네이티브 파라미터 검증 |
| WebSocket | `ws` | 경량, Node.js 표준 |
| HTTP | 내장 `fetch` (Node 20+) | 외부 의존성 최소화 |
| 빌드 | `tsup` | TypeScript → ESM 번들, 빠름 |
| 테스트 | `vitest` | TypeScript 네이티브, 빠름 |
| 린트 | `biome` | ESLint+Prettier 통합, 빠름 |

---

## 4. 프로젝트 구조 (Phase 1 구현 완료)

```
src/
├── server.ts                    # MCP 엔트리포인트 (McpServer + StdioServerTransport)
├── config.ts                    # CLI 인자(--server=, --port=) + 환경변수
│
├── transport/
│   ├── plugin-bridge.ts         # WebSocket ↔ Figma Plugin (TalkToFigma 호환)
│   └── rest-client.ts           # Figma REST API 클라이언트
│
├── tools/
│   ├── types.ts                 # ToolContext, ToolDefinition, pluginTool 헬퍼
│   ├── _registry.ts             # 전체 Tool import → allTools 배열 export
│   │
│   ├── connection/
│   │   └── join-channel.ts      # join_channel (1개)
│   ├── document/
│   │   └── index.ts             # 6개 Tool
│   ├── node/
│   │   └── index.ts             # 10개 Tool
│   ├── style/
│   │   └── index.ts             # 3개 Tool
│   ├── text/
│   │   └── index.ts             # 3개 Tool
│   ├── layout/
│   │   └── index.ts             # 5개 Tool
│   ├── component/
│   │   └── index.ts             # 5개 Tool
│   ├── annotation/
│   │   └── index.ts             # 3개 Tool
│   ├── export/
│   │   └── index.ts             # 4개 Tool
│   └── rest/
│       └── index.ts             # 5개 REST API Tool
│
└── utils/
    └── logger.ts                # stderr 로깅 (MCP stdout 보호)

# 향후 추가 예정
# ├── cache/lru-cache.ts         # Phase 3
# ├── prompts/                   # Phase 2
# └── utils/{color,error}.ts     # 필요 시
```

---

## 5. 페이즈 개요

### Phase 1 — 기반 구축 + TalkToFigma 동등 대체 ✅

**목표**: 기존 TalkToFigma 40개 Tool을 모듈화된 구조로 재구현하고, REST API 읽기 5개를 추가 (총 45개).
**완료 기준**: `.mcp.json`을 자체 서버로 교체해도 기존 워크플로우가 동일하게 작동.
**상태**: 구현 완료. 빌드 성공 (26KB ESM). `.mcp.json` 교체 완료. 통합 테스트 대기.

**상세**: [phase-1-foundation.md](./phase-1-foundation.md)

### Phase 2 — 갭 해소 (TalkToFigma 초월) ✅

**목표**: 누락 노드 타입, 이펙트, 그라디언트, 텍스트 스타일링, Constraints 등 Plugin API 확장.
**완료 기준**: 캠페인 프로토타입 배치 작업이 수동 조정 없이 MCP만으로 완결.
**상태**: ✅ 구현 완료. 17개 Tool 추가 (총 62개). 커스텀 Figma Plugin 구현.

**상세**: [phase-2-extended-tools.md](./phase-2-extended-tools.md)

### Phase 3 — 고급 기능 + 자동화 ✅

**목표**: Variables, Component/Variant 생성, Webhooks, 캐싱, 병렬 실행, 코드 생성 연동.
**완료 기준**: 디자인 시스템 구축과 Figma↔Code 양방향 동기화가 MCP로 가능.
**상태**: ✅ 구현 완료. Variables API + Component 생성 + Batch 실행 (총 72개).

**상세**: [phase-3-advanced.md](./phase-3-advanced.md)

### Phase 4 — 코드 품질 개선 + 프로덕션 복원력 확보 ✅

**목표**: DRY 위반 해소, 통신 복원력(retry/rate-limit/cache), 에러 계층, 테스트 인프라, CI/CD.
**완료 기준**: 종합 코드 품질 5.0→8.0, 핵심 모듈 테스트 커버리지 50%+, REST API 자동 재시도 동작.
**상태**: ✅ 구현 완료. 공유 스키마, 에러 계층, transport 복원력, 35 tests.

**상세**: [phase-4-quality-resilience.md](./phase-4-quality-resilience.md)

---

## 6. 의존성 및 호환성

### 기존 Figma Plugin 호환

자체 서버는 TalkToFigma와 **동일한 WebSocket 프로토콜**을 사용한다:

```typescript
// 요청 형식 (기존 Plugin이 이해하는 형태)
{
  id: "uuid",
  type: "message" | "join",
  channel: "channel-name",
  message: {
    id: "uuid",
    command: "create_rectangle",
    params: { x: 0, y: 0, width: 100, height: 100, commandId: "uuid" }
  }
}
```

Phase 1에서는 기존 Figma Plugin을 그대로 사용하고, Phase 2부터 확장 Plugin으로 점진 교체한다.

### REST API 인증

```bash
# Figma Personal Access Token
FIGMA_ACCESS_TOKEN=figd_xxxxx

# 선택: OAuth 2.0 (팀 배포 시)
FIGMA_CLIENT_ID=xxxxx
FIGMA_CLIENT_SECRET=xxxxx
```

---

## 7. 성공 기준

| 페이즈 | 정량 기준 | 정성 기준 |
|--------|----------|----------|
| Phase 1 | 40개 Tool 동등 구현 + REST 5개 = 45개 ✅ | TalkToFigma 교체 후 기존 작업 문제 없음 |
| Phase 2 | +20개 이상 Tool (이펙트, 노드, 텍스트) | 프로토타입 배치가 MCP만으로 완결 |
| Phase 3 | Variables + Component 생성 + 캐싱 | 디자인 시스템 구축 자동화 |

---

## 8. 리스크 및 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| Figma Plugin API 변경 | Plugin 호환성 깨짐 | Plugin을 별도 리포로 관리, 버전 고정 |
| REST API Rate Limit | 대량 조회 차단 | LRU 캐시, 배치 요청 병합 |
| WebSocket 프로토콜 변경 | 기존 Plugin 호환 깨짐 | 프로토콜 버전 헤더 도입 |
| MCP SDK 메이저 업데이트 | 서버 코드 수정 필요 | SDK 버전 고정, 마이그레이션 가이드 참조 |

---

*다음 문서: [Phase 1 — 기반 구축](./phase-1-foundation.md)*