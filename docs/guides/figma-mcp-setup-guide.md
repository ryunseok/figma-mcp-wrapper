# Figma MCP Wrapper — 설치/연동/사용 가이드

> Figma 디자인을 AI(Claude)로 읽고, 수정하고, 자동화하는 MCP 서버.
> 디자이너, 개발자, PM 모두 사용 가능.

---

## 목차

1. [개요](#1-개요)
2. [아키텍처](#2-아키텍처)
3. [설치](#3-설치)
4. [설정](#4-설정)
5. [연결 방법](#5-연결-방법)
6. [역할별 사용 가이드](#6-역할별-사용-가이드)
7. [Tool 카탈로그](#7-tool-카탈로그)
8. [FAQ / 트러블슈팅](#8-faq--트러블슈팅)

---

## 1. 개요

### 무엇인가?
Claude Code(AI)가 Figma 파일을 직접 읽고 수정할 수 있게 해주는 브릿지.
72개 Tool로 노드 생성, 스타일 변경, 컴포넌트 관리, 텍스트 수정 등을 자동화한다.

### 누가 쓰나?
| 역할 | Figma 모드 | 주요 활용 |
|------|-----------|-----------|
| 디자이너 | Design Mode | 디자인 자동 생성, 반복 작업 자동화, 컴포넌트화 |
| 개발자 | Dev Mode | 디자인 스펙 추출, 노드 검사, 코드 생성용 컨텍스트 |
| PM | Design Mode | 디자인 리뷰, 코멘트, 텍스트 정책 검증 |

### 모드별 제약
- **Design Mode**: 전체 72개 Tool 사용 가능 (읽기 + 쓰기)
- **Dev Mode**: 읽기 Tool + REST API만 사용 가능 (쓰기 차단)
- 상세: [figma-mode-compatibility.md](./figma-mode-compatibility.md)

---

## 2. 아키텍처

### HTTP 모드 (추천, 다중 세션)

```
┌─────────────┐                ┌────────────────────┐    WebSocket    ┌─────────────┐
│ Session A   │──┐   HTTP/SSE  │  MCP Server (Node) │ ◄──────────────► │ Figma Plugin│
│ Session B   │──┼──────────► │  localhost:3056/mcp │    port 3055    │ (브라우저)   │
│ Session C   │──┘             │                    │                 └──────┬──────┘
└─────────────┘                │  ┌── REST Client ──┤                        │
  Claude Code 세션들            │  │  (Figma API)    │                   Figma API
                               └──┴─────────────────┘                  (Plugin SDK)
                                  항상 실행 (데몬)
```

- **서버 1개**가 백그라운드에서 항상 실행
- Claude Code **세션 여러 개**가 동시 접속 가능
- Figma Plugin 연결도 서버가 공유 관리

### stdio 모드 (레거시, 단일 세션)

```
Claude Code ◄── stdio ──► MCP Server (자식 프로세스)
```

- 세션 시작 시 자동 실행, 종료 시 함께 종료
- 다중 세션 불가 (WebSocket 포트 충돌)

**3개 레이어:**
1. **Claude Code** — AI가 MCP Tool을 호출
2. **MCP Server** — Tool 요청을 Plugin(WebSocket) 또는 REST API로 라우팅
3. **Figma Plugin** — 브라우저 내 Figma에서 실제 API 실행

---

## 3. 설치

### 3.1 사전 요구사항

- Node.js 18+
- Claude Code CLI
- Figma 데스크톱 앱 또는 웹

### 3.2 MCP 서버 설치

```bash
# 프로젝트 클론
git clone <repo-url> figma-mcp
cd figma-mcp

# 의존성 설치 & 빌드
npm install
npm run build
```

### 3.3 서버 시작 (HTTP 모드)

#### pm2 (추천)

```bash
# 최초 설치
npm i -g pm2

# 서버 시작
npm run build
pm2 start dist/server.js --name figma-mcp -- --mode=http

# 부팅 시 자동 시작 등록
pm2 save && pm2 startup

# 상태 확인
pm2 status

# 로그 확인
pm2 logs figma-mcp

# 코드 수정 후 재배포
npm run build && pm2 restart figma-mcp
```

#### 레거시: start-server.sh

```bash
./scripts/start-server.sh start    # 시작
./scripts/start-server.sh status   # 상태
./scripts/start-server.sh restart  # 재시작
./scripts/start-server.sh stop     # 중지
```

> 서버는 Mac 사용 중 한번만 시작하면 됨. Claude Code 세션과 독립적으로 동작.

### 3.3 Figma Plugin 설치

#### 방법 A: 로컬 개발 플러그인 (개인용)

1. Figma 열기
2. 메뉴 → Plugins → Development → Import plugin from manifest...
3. `figma-mcp/figma-plugin/manifest.json` 선택
4. Plugin 목록에 "Figma MCP Wrapper" 표시 확인

#### 방법 B: 조직 비공개 게시 (팀용, 추천)

1. Figma Plugin 관리 페이지에서 새 플러그인 생성
2. `figma-mcp/figma-plugin/` 디렉토리 업로드
3. 조직 내 팀원에게 자동 배포
4. 팀원은 Plugins 메뉴에서 1-click 설치

> **참고**: 로컬 방식은 각자 manifest를 임포트해야 하므로, 3인 이상 팀은 조직 게시 추천.

### 3.4 Plugin 빌드 (수정 시)

```bash
cd figma-mcp/figma-plugin
npm run build
# dist/code.js 생성됨 → Figma에서 자동 반영
```

---

## 4. 설정

### 4.1 Claude Code MCP 설정

프로젝트 루트에 `.mcp.json` 파일:

#### HTTP 모드 (추천)

```json
{
  "mcpServers": {
    "TalkToFigma": {
      "url": "http://localhost:3056/mcp",
      "type": "sse"
    }
  }
}
```

> 서버가 별도 프로세스로 실행 중이어야 함. 토큰은 서버 환경변수로 설정.

#### stdio 모드 (레거시)

```json
{
  "mcpServers": {
    "TalkToFigma": {
      "command": "node",
      "args": ["<경로>/figma-mcp/dist/server.js"],
      "type": "stdio",
      "env": {
        "FIGMA_ACCESS_TOKEN": "figd_xxxxx"
      }
    }
  }
}
```

### 4.2 Figma Access Token 발급

1. [Figma Settings → Personal Access Tokens](https://www.figma.com/settings) 이동
2. "Generate new token" 클릭
3. **필요 스코프** 선택:

| 스코프 | 용도 | 필수 |
|--------|------|:----:|
| file_content:read | 파일/노드 조회 | O |
| file_metadata:read | 파일 메타데이터 | O |
| file_comments:read | 코멘트 읽기 | 권장 |
| file_comments:write | 코멘트 작성 | 권장 |
| file_dev_resources:read | Dev Resource 조회 | 선택 |
| file_variables:read | Variables 조회 | 선택 |
| file_variables:write | Variables 수정 | 선택 |

4. 토큰을 `.mcp.json`의 `FIGMA_ACCESS_TOKEN`에 설정

### 4.3 환경 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `FIGMA_ACCESS_TOKEN` | (없음) | REST API 인증 토큰 |
| `MCP_MODE` | stdio | `http` = HTTP 데몬 모드 |
| `MCP_HTTP_PORT` | 3056 | HTTP/SSE 서버 포트 |
| `FIGMA_WS_PORT` | 3055 | WebSocket 릴레이 포트 |
| `REQUEST_TIMEOUT_MS` | 30000 | Plugin 응답 타임아웃 (ms) |
| `DEBUG` | (없음) | "1" 설정 시 디버그 로그 |

> HTTP 모드에서는 `~/.envs/claude-tools.env`에 토큰을 설정하면 `start-server.sh`가 자동 로드.

---

## 5. 연결 방법

### 5.1 연결 흐름

```
1. Claude Code 실행 (MCP 서버 자동 시작)
2. Figma에서 Plugin 실행 → 채널 ID 표시
3. Claude에게 채널 ID 전달
4. join_channel로 연결 완료
```

### 5.2 단계별

**Step 1**: Claude Code에서 대화 시작

**Step 2**: Figma에서 Plugin 실행
- Plugins → Figma MCP Wrapper → 실행
- Plugin UI에 **채널 ID** (예: `s7r9o972`) 표시

**Step 3**: Claude에게 전달
```
채널 s7r9o972 조인해줘
```

**Step 4**: 연결 확인
```
→ join_channel(channel: "s7r9o972")
← { success: true, channel: "s7r9o972" }
```

### 5.3 재연결

Plugin이 닫히거나 Figma 새로고침 시:
1. Plugin 다시 실행 → 새 채널 ID 확인
2. Claude에게 새 채널 ID 전달
3. `/mcp` 명령으로 MCP 서버 재시작 (필요 시)

---

## 6. 역할별 사용 가이드

### 6.1 디자이너

#### 자동 레이아웃 생성
```
"1512x900 어드민 페이지 프레임 만들어줘. LNB 220px, 헤더 68px, 콘텐츠 영역 auto layout"
```
→ create_frame, set_layout_mode, set_padding 자동 실행

#### 반복 요소 일괄 생성
```
"테이블 5행 만들어줘. 컬럼: 캠페인명(320px), 타입(130px), 상태(120px), 참여자(150px)"
```
→ batch_execute로 한번에 생성

#### 컴포넌트화
```
"이 배지 3개를 컴포넌트로 만들고 Variant Set으로 묶어줘"
```
→ create_component + create_component_set

#### 스타일 일괄 변경
```
"모든 row의 배경색을 흰색으로, 테두리를 cg-200으로 변경"
```
→ batch_execute로 set_fill_color, set_stroke_color 일괄 실행

### 6.2 개발자

#### 디자인 스펙 추출
```
"이 컴포넌트의 padding, font, color 정보 알려줘"
```
→ get_node_info로 상세 속성 조회

#### 컴포넌트 구조 분석
```
"이 페이지의 컴포넌트 트리 구조 보여줘"
```
→ scan_nodes_by_types로 COMPONENT, INSTANCE 탐색

#### 노드 링크 생성
```
"이 프레임의 Figma 링크 줘"
```
→ fileKey + nodeId로 URL 생성:
`https://www.figma.com/design/{fileKey}?node-id={nodeId}`

#### 이미지 내보내기
```
"이 화면을 2x PNG로 내보내줘"
```
→ export_node_as_image 또는 get_images (REST)

### 6.3 PM

#### 텍스트 정책 검증
```
"이 페이지의 모든 텍스트 노드 내용 보여줘"
```
→ scan_text_nodes로 전체 텍스트 추출

#### 디자인 리뷰
```
"이 화면의 전체 구조 분석해줘"
```
→ read_my_design으로 선택 영역 분석

#### 텍스트 수정
```
"버튼 텍스트를 '신청하기'에서 '시작하기'로 변경"
```
→ set_text_content

---

## 7. Tool 카탈로그

### 총 72개 Tool (Phase 1~3)

| 카테고리 | Tool 수 | 주요 Tool |
|---------|---------|-----------|
| Connection | 1 | join_channel |
| Document | 6 | get_document_info, get_selection, read_my_design, scan_nodes_by_types |
| Node | 19 | create_frame, create_text, create_rectangle, move_node, resize_node, boolean_operation |
| Style | 9 | set_fill_color, set_effect, set_gradient, set_opacity |
| Text | 5 | scan_text_nodes, set_text_content, set_text_style, set_text_range_style |
| Layout | 7 | set_layout_mode, set_padding, set_constraints, set_grid |
| Component | 8 | create_component, create_component_set, create_component_instance |
| Variable | 2 | bind_variable, unbind_variable |
| Annotation | 3 | get_annotations, set_annotation |
| Export | 4 | export_node_as_image, get_reactions |
| Batch | 1 | batch_execute |
| REST API | 8 | get_file, get_variables, get_published_variables, set_variables |

### 자주 쓰는 조합

| 작업 | Tool 조합 |
|------|-----------|
| 화면 생성 | create_frame → set_layout_mode → set_padding → create_text |
| 컴포넌트화 | create_component → create_component_set → set_component_property |
| 스타일 일괄 변경 | batch_execute(set_fill_color * N) |
| 디자인 분석 | get_selection → get_node_info → scan_text_nodes |

---

## 7.5 멀티 레포에서 사용하기

figma-mcp 서버는 HTTP 데몬으로 한번만 실행하면, **어떤 프로젝트에서든** `.mcp.json`만 추가하면 사용 가능하다.

### 구조
```
project-a/           ─┐
project-b/            ─┼─→  http://localhost:3056/mcp  ←  figma-mcp 서버 (pm2)
다른 프로젝트/         ─┘         ↕ ws://localhost:3055
                              Figma Plugin
```

### 다른 프로젝트에서 설정

해당 프로젝트 루트에 `.mcp.json` 추가:

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

이것만으로 Claude Code에서 Figma 72개 Tool을 사용할 수 있다.
서버 코드를 수정하지 않는 한 다른 레포에서는 추가 작업이 필요 없다.

---

## 8. FAQ / 트러블슈팅

### HTTP 서버가 안 뜸
- `./scripts/start-server.sh status`로 상태 확인
- `.server.log` 파일에서 에러 확인
- 포트 충돌: `lsof -ti:3056` 또는 `lsof -ti:3055`로 점유 프로세스 확인

### 여러 세션에서 동시 접속 안 됨
- stdio 모드가 아닌 HTTP 모드인지 확인 (`.mcp.json`에 `"url"` 사용)
- 서버가 실행 중인지 확인: `curl http://localhost:3056/health`

### Plugin이 연결 안 됨
- Figma Plugin UI에 채널 ID가 표시되는지 확인
- MCP 서버가 실행 중인지 확인 (Claude Code 실행 상태)
- WebSocket 포트(3055) 충돌 여부 확인

### "FIGMA_ACCESS_TOKEN env var not set"
- `.mcp.json`에 토큰이 설정되어 있는지 확인
- `/mcp` 명령으로 MCP 서버 재시작

### REST API 403 에러
- 토큰 스코프 부족 → [4.2 토큰 발급](#42-figma-access-token-발급) 참고
- 새 토큰 발급 시 필요한 스코프 모두 선택

### Plugin 타임아웃 (30초)
- 대량 노드 조회 시 발생 가능
- `scan_nodes_by_types`로 범위 좁혀서 재시도
- `REQUEST_TIMEOUT_MS` 환경변수로 타임아웃 증가 가능

### Dev Mode에서 쓰기 Tool 실패
- 정상 동작 — Dev Mode는 읽기 전용
- 쓰기 작업은 Design Mode에서 수행

### 채널 끊김 / Plugin 재시작
- Figma 새로고침 또는 Plugin 닫기 시 채널 끊김
- Plugin 재실행 → 새 채널 ID로 재연결

---

## 부록: Plugin 게시 가이드

### 조직 비공개 게시 (팀 배포용)

1. [Figma Plugin 관리](https://www.figma.com/plugin-settings) 접속
2. "Create new plugin" → Organization
3. Plugin 이름: "Figma MCP Wrapper"
4. manifest.json 업로드 (figma-plugin/ 디렉토리)
5. "Publish to Organization" 클릭
6. 팀원은 Figma Plugins에서 검색 후 설치

### 업데이트 배포

```bash
# 코드 수정 후
cd figma-plugin && npm run build
# Figma Plugin 관리에서 새 버전 업로드
```

---

*작성: 2026-03-10 | 총 72 Tools (Phase 1-4) | v0.2.0 HTTP 데몬 + pm2*