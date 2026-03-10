# Figma MCP 프로젝트

## 프로젝트 개요
**TalkToFigma MCP를 완전 대체**하는 자체 Figma MCP 서버를 구축하는 프로젝트.
기존 `cursor-talk-to-figma-mcp`는 Figma API를 일부만 커버하여 디자인 작성에 제한이 있다.
Figma REST API 전체를 커버하는 MCP 서버를 직접 구현하여 Claude Code에서 Figma를 완전 제어한다.

## 핵심 목표
1. **TalkToFigma 완전 대체** — Figma REST API + Plugin API 전체 커버리지
2. **Figma → Code** — 디자인 컨텍스트 추출 → 코드 생성 (Flutter, Next.js, Kotlin)
3. **Code → Figma** — 프로토타입을 Figma에 자동 배치, 컴포넌트 생성/수정
4. **정책 문서 추출** — Figma 내 텍스트 정책 문서를 구조화된 데이터로 변환

## TalkToFigma의 한계 (대체 이유)
- Figma REST API를 전부 커버하지 못함
- WebSocket 기반이라 연결 불안정
- 복잡한 레이아웃 조작 (Auto Layout, Constraints) 미지원
- 컴포넌트 Variant 조작 제한
- 스타일/이펙트 세밀 제어 부족
- 배치 작업 시 순차 실행 필요 (병렬 불가)

## 페르소나
**금희 (기술 리드)** 페르소나 기본 사용.
- 설계, 구현, 디버깅 전반의 기술 판단
- 멀티스택: Flutter/Dart, Next.js/TypeScript, Kotlin/Spring Boot
- 페르소나 설정: `.claude-ai/personas/금희-architect.md`

## MCP 서버 구성

### 자체 MCP 서버 (figma-mcp-wrapper v0.2.0)
72개 Tool, HTTP(SSE) 데몬 모드로 운영. pm2로 상시 실행.

```json
// 이 레포 및 다른 프로젝트에서 동일하게 사용
{
  "mcpServers": {
    "TalkToFigma": {
      "url": "http://localhost:3056/mcp",
      "type": "sse"
    }
  }
}
```

### 서버 관리
```bash
pm2 start dist/server.js --name figma-mcp -- --mode=http  # 시작
pm2 restart figma-mcp                                       # 재시작
pm2 logs figma-mcp                                          # 로그
```

### Figma Remote MCP (읽기 전용, 참고)
- **URL**: `https://mcp.figma.com/mcp` (Remote) / `http://127.0.0.1:3845/mcp` (Desktop)
- **도구**: `get_design_context`, `get_metadata`, `get_variable_defs`, `get_screenshot`, `get_figjam`
- **Rate Limit**: Dev/Full = 분당 제한, Starter = 월 6회

## 프로젝트 구조
```
figma-mcp/
├── CLAUDE.md                    # 이 파일
├── .mcp.json                    # MCP 서버 설정
├── .gitignore
├── .claude-ai/                  # 페르소나 시스템 (별도 git repo)
├── docs/
│   ├── architecture/            # 아키텍처 설계 문서
│   │   ├── figma-mcp-server-architecture.md       # 서버 구조 + 구현 코드
│   │   ├── figma-mcp-server-integration.md        # MCP-CodeGen 통합 전략
│   │   └── figma-to-code-technical-implementation.md  # 기술 구현 상세
│   ├── plans/                   # 실행 계획
│   │   ├── implementation-plan.md
│   │   └── phase-4-quality-resilience.md
│   └── guides/                  # 가이드 문서
│       ├── figma-mcp-setup-guide.md
│       ├── figma-mode-compatibility.md
│       └── figma-plugin-publish-guide.md
├── src/                         # MCP 서버 소스
│   ├── server.ts                # MCP 서버 (stdio/HTTP 듀얼)
│   ├── config.ts                # CLI + 환경변수 설정
│   ├── schemas/                 # 공유 Zod 스키마 (color, enum)
│   ├── errors/                  # 에러 계층 (Auth, RateLimit, Plugin)
│   ├── transport/               # 통신 레이어
│   │   ├── plugin-bridge.ts     # Figma Plugin 명령 전달
│   │   ├── ws-relay.ts          # 내장 WebSocket 서버 (:3055)
│   │   ├── rest-client.ts       # Figma REST API (retry+cache)
│   │   ├── retry.ts             # 지수 백오프 + jitter
│   │   ├── rate-limiter.ts      # 토큰 버킷 (60 req/min)
│   │   ├── cache.ts             # TTL 캐시 (60s, 100 entries)
│   │   └── __tests__/           # 35 tests (vitest)
│   ├── tools/                   # 72개 MCP Tool (12 카테고리)
│   │   ├── node/                # shapes/queries/manipulation
│   │   └── ...                  # style, text, layout, component 등
│   └── utils/
│       └── logger.ts            # stderr 로깅
├── figma-plugin/                # Figma Plugin 소스
│   ├── src/code.ts              # Plugin 진입점
│   └── src/handlers/            # 핸들러 모듈 (10개)
└── scripts/
    └── start-server.sh          # 서버 시작 스크립트
```

## 작업 규칙

### Git
- 커밋은 자유롭게 수행
- **git push는 반드시 사용자 허가 필요**
- 커밋 메시지: 한국어 또는 영어, 변경 목적 명확히 기술

### Figma 작업 시 주의사항
1. MCP 사용 전 **채널 연결 확인** (`join_channel`)
2. 컴포넌트 인스턴스 생성 시 **기존 컴포넌트 ID 확인** (`get_local_components`)
3. 대량 작업 시 **순차적으로 실행** (WebSocket 안정성)
4. 작업 완료 후 **Figma에서 시각적 확인** 요청

## 참조 문서 인덱스

### 아키텍처 (docs/architecture/)
| 문서 | 핵심 내용 |
|------|----------|
| `figma-mcp-server-architecture.md` | 서버 3-Layer 구조, transport 복원력, 운영 가이드 |
| `figma-mcp-server-integration.md` | MCP↔CodeGen 통합 전략 (향후 계획) |
| `figma-to-code-technical-implementation.md` | Figma→Code 기술 구현 (참고용) |

### 계획 (docs/plans/)
| 문서 | 핵심 내용 |
|------|----------|
| `implementation-plan.md` | Phase 1-4 전체 실행 계획 |
| `phase-4-quality-resilience.md` | Phase 4 코드 품질 + 복원력 상세 |

### 가이드 (docs/guides/)
| 문서 | 핵심 내용 |
|------|----------|
| `figma-mcp-setup-guide.md` | 설치, 설정, 역할별 사용법, Tool 카탈로그 |
| `figma-mode-compatibility.md` | Design/Dev 모드별 기능 호환성 |
| `figma-plugin-publish-guide.md` | Figma Plugin 조직/Community 게시 가이드 |

---
*최종 업데이트: 2026-03-10*