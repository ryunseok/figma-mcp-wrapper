# Figma MCP Wrapper — Plugin 조직 게시 가이드

> Figma Plugin을 조직(Organization) 내 비공개로 게시하여 팀원이 설치/사용하는 방법.

---

## 1. 플러그인 빌드

```bash
cd figma-plugin
npm install
npm run build
```

`dist/code.js`가 생성되면 준비 완료.

---

## 2. Figma에서 플러그인 생성

1. **[Figma Plugin 관리 페이지](https://www.figma.com/plugin-settings)** 접속
2. **"Create new plugin"** 클릭
3. **배포 범위 선택**:
   - **Organization** — 조직 내 팀원만 사용 (비공개, 추천)
   - Community — 전 세계 공개 (현재 불필요)
4. **이름**: `Figma MCP Wrapper` 입력
5. **"Save and continue"** 클릭

---

## 3. manifest.json에 Plugin ID 반영

Figma가 부여한 숫자 ID를 `figma-plugin/manifest.json`에 반영:

```json
{
  "name": "Figma MCP Wrapper",
  "id": "1234567890123456789",
  "api": "1.0.0",
  "main": "dist/code.js",
  "ui": "ui.html",
  "editorType": ["figma"],
  "networkAccess": {
    "allowedDomains": ["*"],
    "reasoning": "WebSocket connection to local MCP relay server"
  }
}
```

> `"id"` 값은 Figma가 자동 부여하는 숫자 문자열. 이 ID를 manifest에 넣어야 업데이트 시 동일 플러그인으로 인식됨.

---

## 4. 업로드 및 게시

1. Plugin 관리 페이지에서 방금 생성한 플러그인 선택
2. **"Publish new version"** 클릭
3. 업로드할 파일:

| 파일 | 위치 | 설명 |
|------|------|------|
| `manifest.json` | `figma-plugin/manifest.json` | 플러그인 메타데이터 |
| `code.js` | `figma-plugin/dist/code.js` | 플러그인 로직 (빌드 결과물) |
| `ui.html` | `figma-plugin/ui.html` | 플러그인 UI |

4. **설명** 작성: "MCP 서버를 통해 Claude에서 Figma 디자인을 읽고 수정하는 플러그인"
5. **커버 이미지** 추가 (128×128 이상, 선택사항)
6. **"Publish to Organization"** 클릭

---

## 5. 팀원 설치

게시 완료 후 같은 조직의 팀원은:

1. Figma 열기
2. **Plugins** → 검색 → `Figma MCP Wrapper`
3. **Install** 클릭
4. 사용: 우클릭 → Plugins → Figma MCP Wrapper → 실행

---

## 6. 업데이트 배포

코드 수정 후:

```bash
cd figma-plugin
npm run build
```

Plugin 관리 페이지 → 해당 플러그인 → **"Publish new version"** → 파일 재업로드.

팀원은 자동으로 최신 버전이 적용됨 (Figma가 자동 업데이트).

---

## 7. 주의사항

| 항목 | 내용 |
|------|------|
| **networkAccess** | `"allowedDomains": ["*"]` — 로컬 WebSocket 연결에 필요. 심사 시 reasoning 필드로 사유 기재 |
| **Dev Mode 지원** | `"capabilities": ["inspect"]` 추가 시 Dev Mode에서도 읽기 Tool 사용 가능 |
| **ID 관리** | Figma 부여 ID를 반드시 manifest에 반영. 누락 시 새 플러그인으로 등록됨 |
| **로컬 테스트** | 게시 전 테스트는 Figma → Plugins → Development → Import plugin from manifest |
| **MCP 서버 필요** | Plugin 단독으로는 동작하지 않음. MCP 서버(pm2)가 실행 중이어야 WebSocket 연결 가능 |

---

## 8. 전체 구성 흐름

```
팀원 PC                          Figma (브라우저)
┌─────────────────────┐         ┌─────────────────────┐
│  pm2 (figma-mcp)    │         │  Figma MCP Wrapper   │
│  ├─ MCP HTTP :3056  │         │  Plugin (조직 게시)   │
│  └─ WS Relay :3055 ◄├─────────┤  WebSocket 연결      │
└──────────┬──────────┘         └─────────────────────┘
           │ stdio / HTTP
    ┌──────┴──────┐
    │ Claude Code │
    │ (any repo)  │
    └─────────────┘
```

1. pm2로 MCP 서버 실행 (`npm run build && pm2 start dist/server.js --name figma-mcp -- --mode=http`)
2. Figma에서 Plugin 실행 → 채널 ID 확인
3. Claude Code에서 `join_channel` → 작업 시작

---

*작성: 2026-03-10 | Figma MCP Wrapper v0.2.0*
