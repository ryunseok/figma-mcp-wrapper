# Figma MCP — 모드별 호환성 분석

## Figma 모드 개요

| 모드 | 대상 | 용도 |
|------|------|------|
| Design Mode | 디자이너, PM | 디자인 편집, 프로토타이핑 |
| Dev Mode | 개발자 | 디자인 검사, 코드 스펙 추출 |

## Plugin API 동작 차이

Figma Plugin은 `manifest.json`에 `"devMode": true` 설정 시 Dev Mode에서도 실행 가능하나,
**Dev Mode에서는 문서 수정(쓰기) API가 차단**된다.

| 기능 | Design Mode | Dev Mode |
|------|:-----------:|:--------:|
| 노드 읽기 (get_node_info 등) | O | O |
| 문서 수정 (create, set, delete 등) | O | X |
| Selection 읽기/설정 | O | O |
| Export (이미지 내보내기) | O | O |

## MCP Tool 분류: 전송 방식별 모드 호환

### 1. Plugin Bridge Tool (WebSocket → Figma Plugin)

Plugin 내부에서 실행되므로 Figma 모드 제약을 받는다.

| Tool | 읽기/쓰기 | Design Mode | Dev Mode |
|------|-----------|:-----------:|:--------:|
| get_document_info | 읽기 | O | O |
| get_selection | 읽기 | O | O |
| get_node_info / get_nodes_info | 읽기 | O | O |
| scan_nodes_by_types | 읽기 | O | O |
| scan_text_nodes | 읽기 | O | O |
| get_local_components | 읽기 | O | O |
| get_styles | 읽기 | O | O |
| get_instance_overrides | 읽기 | O | O |
| get_annotations | 읽기 | O | O |
| export_node_as_image | 읽기 | O | O |
| get_reactions | 읽기 | O | O |
| read_my_design | 읽기 | O | O |
| create_* (모든 생성) | 쓰기 | O | X |
| set_* (모든 설정) | 쓰기 | O | X |
| delete_* (모든 삭제) | 쓰기 | O | X |
| move_node / resize_node | 쓰기 | O | X |
| clone_node | 쓰기 | O | X |
| boolean_operation | 쓰기 | O | X |
| batch_execute | 혼합 | O | 읽기만 |
| bind_variable / unbind_variable | 쓰기 | O | X |

### 2. REST API Tool (Figma REST API 직접 호출)

Plugin과 무관하게 서버에서 직접 HTTP 호출. **모드 제약 없음.**

| Tool | 읽기/쓰기 | Design Mode | Dev Mode | 토큰 스코프 |
|------|-----------|:-----------:|:--------:|------------|
| get_file | 읽기 | O | O | file_content:read |
| get_file_nodes | 읽기 | O | O | file_content:read |
| get_file_components | 읽기 | O | O | file_content:read |
| get_file_styles | 읽기 | O | O | file_content:read |
| get_images | 읽기 | O | O | file_content:read |
| get_variables | 읽기 | O | O | file_variables:read (*) |
| get_published_variables | 읽기 | O | O | file_variables:read (*) |
| set_variables | 쓰기 | O | O | file_variables:write (*) |

(*) 현재 토큰에 해당 스코프 없음 — 토큰 재발급 필요

### 3. 내부 Tool (서버 내부 로직)

| Tool | 모드 | 비고 |
|------|:----:|------|
| join_channel | O/O | WebSocket 채널 연결 |
| get_node_link (계획) | O/O | fileKey + nodeId → URL 생성 |

### 4. 계획 중: REST API 추가 Tool

| Tool | 읽기/쓰기 | 현재 토큰 스코프 | 모드 |
|------|-----------|-----------------|:----:|
| get_comments | 읽기 | file_comments:read **O** | O/O |
| post_comment | 쓰기 | file_comments:write **O** | O/O |
| get_dev_resources | 읽기 | file_dev_resources:read **O** | O/O |
| create_dev_resource | 쓰기 | file_dev_resources:write (미확인) | O/O |

## 역할별 활용 가능 Tool

### 디자이너 (Design Mode)
- **전체 72개 Tool 사용 가능**
- 주요: create_*, set_*, batch_execute, create_component

### PM (Design Mode)
- 읽기 Tool + Comments
- 주요: get_node_info, scan_text_nodes, export_node_as_image, get/post_comment

### 개발자 (Dev Mode)
- Plugin 읽기 Tool + 전체 REST API
- 주요: get_node_info, get_file, get_file_components, get_comments, get_dev_resources, get_node_link

## Plugin Dev Mode 지원 설정

현재 `manifest.json`에 Dev Mode 지원을 추가하려면:

```json
{
  "name": "Figma MCP Wrapper",
  "id": "figma-mcp-wrapper",
  "api": "1.0.0",
  "main": "dist/code.js",
  "ui": "dist/ui.html",
  "editorType": ["figma"],
  "capabilities": ["inspect"],
  "enableProposedApi": true
}
```

`"capabilities": ["inspect"]` 추가 시 Dev Mode에서도 Plugin 실행 가능.
단, 쓰기 Tool 호출 시 에러 핸들링 필요.

---

*작성: 2026-03-09*