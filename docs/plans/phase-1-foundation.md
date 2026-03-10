# Phase 1 — 기반 구축 + TalkToFigma 동등 대체

> **목표**: 모듈화된 MCP 서버로 TalkToFigma 40개 Tool을 재구현 + REST API 5개 추가 = 총 45개
> **상태**: ✅ 구현 완료
> **완료 기준**: `.mcp.json`을 자체 서버로 교체해도 기존 워크플로우가 동일 작동
> **상위 문서**: [implementation-plan.md](./implementation-plan.md)

---

## 1. 프로젝트 초기화

### 1.1 패키지 설정

```jsonc
// package.json
{
  "name": "figma-mcp-wrapper",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/server.js",
  "bin": { "figma-mcp-wrapper": "dist/server.js" },
  "scripts": {
    "dev": "tsup --watch --onSuccess 'echo Build complete'",
    "build": "tsup",
    "test": "vitest",
    "lint": "biome check src/",
    "lint:fix": "biome check --fix src/"
  }
}
```

### 1.2 의존성

```bash
# 프로덕션
npm install @modelcontextprotocol/sdk zod ws uuid

# 개발
npm install -D typescript tsup vitest @types/ws @types/uuid @biomejs/biome
```

### 1.3 TypeScript 설정

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "sourceMap": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

### 1.4 빌드 설정

```typescript
// tsup.config.ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "node20",
  banner: { js: "#!/usr/bin/env node" },
});
```

---

## 2. 실제 프로젝트 구조

```
src/
├── server.ts                    # MCP 엔트리포인트
├── config.ts                    # CLI 인자 + 환경변수 설정
│
├── transport/
│   ├── plugin-bridge.ts         # WebSocket ↔ Figma Plugin
│   └── rest-client.ts           # Figma REST API 클라이언트
│
├── tools/
│   ├── types.ts                 # ToolContext, ToolDefinition, pluginTool 헬퍼
│   ├── _registry.ts             # 전체 Tool import + allTools 배열 export
│   │
│   ├── connection/
│   │   └── join-channel.ts      # join_channel (커스텀 핸들러)
│   │
│   ├── document/
│   │   └── index.ts             # 6개: get_document_info, get_selection,
│   │                            #       read_my_design, scan_nodes_by_types,
│   │                            #       set_focus, set_selections
│   │
│   ├── node/
│   │   └── index.ts             # 10개: get_node_info, get_nodes_info(병렬),
│   │                            #        create_rectangle, create_frame(auto-layout),
│   │                            #        create_text, move_node, resize_node,
│   │                            #        clone_node, delete_node, delete_multiple_nodes
│   │
│   ├── style/
│   │   └── index.ts             # 3개: set_fill_color, set_stroke_color, set_corner_radius
│   │
│   ├── text/
│   │   └── index.ts             # 3개: scan_text_nodes, set_text_content,
│   │                            #       set_multiple_text_contents
│   │
│   ├── layout/
│   │   └── index.ts             # 5개: set_layout_mode, set_padding, set_axis_align,
│   │                            #       set_layout_sizing, set_item_spacing
│   │
│   ├── component/
│   │   └── index.ts             # 5개: get_local_components, get_styles,
│   │                            #       create_component_instance,
│   │                            #       get_instance_overrides, set_instance_overrides
│   │
│   ├── annotation/
│   │   └── index.ts             # 3개: get_annotations, set_annotation,
│   │                            #       set_multiple_annotations
│   │
│   ├── export/
│   │   └── index.ts             # 4개: export_node_as_image, get_reactions,
│   │                            #       set_default_connector, create_connections
│   │
│   └── rest/
│       └── index.ts             # 5개: get_file, get_file_nodes,
│                                #       get_file_components, get_file_styles, get_images
│
└── utils/
    └── logger.ts                # stderr 로깅 (MCP stdout 보호)
```

---

## 3. 핵심 모듈

### 3.1 서버 엔트리포인트 (`server.ts`)

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadConfig } from "./config.js";
import { PluginBridge } from "./transport/plugin-bridge.js";
import { RestClient } from "./transport/rest-client.js";
import type { ToolContext } from "./tools/types.js";
import { allTools } from "./tools/_registry.js";
import { logger } from "./utils/logger.js";

async function main() {
  const config = loadConfig();

  const pluginBridge = new PluginBridge(config.wsUrl, config.wsPort, config.requestTimeoutMs);
  const restClient = new RestClient(config.figmaToken);
  const ctx: ToolContext = { pluginBridge, restClient };

  pluginBridge.connect();

  const server = new McpServer({
    name: "figma-mcp-wrapper",
    version: "0.1.0",
  });

  // 전체 Tool 자동 등록
  for (const tool of allTools) {
    const zodSchema: Record<string, z.ZodType> = {};
    for (const [key, value] of Object.entries(tool.schema)) {
      zodSchema[key] = value as z.ZodType;
    }

    server.tool(tool.name, tool.description, zodSchema, async (params) => {
      try {
        const result = await tool.handler(params as Record<string, unknown>, ctx);
        return { content: [{ type: "text" as const, text: result }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`Tool ${tool.name} failed: ${message}`);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
          isError: true,
        };
      }
    });
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("MCP server running on stdio");
}
```

### 3.2 설정 (`config.ts`)

```typescript
export interface Config {
  wsUrl: string;
  wsPort: number;
  figmaToken: string | null;
  requestTimeoutMs: number;
}

export function loadConfig(): Config {
  const args = process.argv.slice(2);
  const serverArg = args.find((a) => a.startsWith("--server="));
  const portArg = args.find((a) => a.startsWith("--port="));

  return {
    wsUrl: serverArg?.split("=")[1] ?? "localhost",
    wsPort: Number(portArg?.split("=")[1] ?? process.env.FIGMA_WS_PORT ?? 3055),
    figmaToken: process.env.FIGMA_ACCESS_TOKEN ?? null,
    requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? 30000),
  };
}
```

### 3.3 Tool 타입 시스템 (`tools/types.ts`)

```typescript
export interface ToolContext {
  pluginBridge: PluginBridge;
  restClient: RestClient;
}

export interface ToolDefinition {
  name: string;
  description: string;
  schema: Record<string, unknown>;
  handler: (params: Record<string, unknown>, ctx: ToolContext) => Promise<string>;
}

/** 헬퍼: Plugin Bridge에 커맨드를 전달하는 Tool 생성 */
export function pluginTool(
  name: string,
  description: string,
  schema: Record<string, unknown>,
  command?: string,
  mapParams?: (params: Record<string, unknown>) => Record<string, unknown>,
): ToolDefinition {
  return {
    name,
    description,
    schema,
    handler: async (params, ctx) => {
      const mapped = mapParams ? mapParams(params) : params;
      const result = await ctx.pluginBridge.sendCommand(command ?? name, mapped);
      return JSON.stringify(result);
    },
  };
}
```

### 3.4 Tool 등록 (`tools/_registry.ts`)

카테고리별 `index.ts`에서 Tool을 import하여 `allTools` 배열로 export.
`server.ts`에서 이 배열을 순회하며 `server.tool()` 호출.

```typescript
import { joinChannelTool } from "./connection/join-channel.js";
import { getDocumentInfoTool, getSelectionTool, ... } from "./document/index.js";
import { getNodeInfoTool, getNodesInfoTool, ... } from "./node/index.js";
// ... (전체 10개 카테고리)

export const allTools: ToolDefinition[] = [
  joinChannelTool,
  // ... 45개 Tool
];
```

---

## 4. 구현된 Tool 목록 (40 + 5 = 45개)

### Plugin Bridge Tool (기존 TalkToFigma 동등 — 40개)

| # | 카테고리 | Tool 이름 | 구현 패턴 |
|---|---------|-----------|----------|
| 1 | 연결 | `join_channel` | 커스텀 핸들러 |
| 2 | 문서 | `get_document_info` | pluginTool |
| 3 | 문서 | `get_selection` | pluginTool |
| 4 | 문서 | `read_my_design` | pluginTool |
| 5 | 문서 | `scan_nodes_by_types` | pluginTool |
| 6 | 문서 | `set_focus` | pluginTool |
| 7 | 문서 | `set_selections` | pluginTool |
| 8 | 노드 | `get_node_info` | pluginTool |
| 9 | 노드 | `get_nodes_info` | 커스텀 (Promise.all 병렬) |
| 10 | 노드 | `create_rectangle` | pluginTool + mapParams |
| 11 | 노드 | `create_frame` | pluginTool + mapParams (auto-layout 전체 지원) |
| 12 | 노드 | `create_text` | pluginTool |
| 13 | 노드 | `move_node` | pluginTool |
| 14 | 노드 | `resize_node` | pluginTool |
| 15 | 노드 | `clone_node` | pluginTool |
| 16 | 노드 | `delete_node` | pluginTool |
| 17 | 노드 | `delete_multiple_nodes` | pluginTool |
| 18 | 스타일 | `set_fill_color` | pluginTool |
| 19 | 스타일 | `set_stroke_color` | pluginTool |
| 20 | 스타일 | `set_corner_radius` | pluginTool |
| 21 | 텍스트 | `scan_text_nodes` | pluginTool |
| 22 | 텍스트 | `set_text_content` | pluginTool |
| 23 | 텍스트 | `set_multiple_text_contents` | pluginTool |
| 24 | 레이아웃 | `set_layout_mode` | pluginTool |
| 25 | 레이아웃 | `set_padding` | pluginTool |
| 26 | 레이아웃 | `set_axis_align` | pluginTool |
| 27 | 레이아웃 | `set_layout_sizing` | pluginTool |
| 28 | 레이아웃 | `set_item_spacing` | pluginTool |
| 29 | 컴포넌트 | `get_local_components` | pluginTool |
| 30 | 컴포넌트 | `get_styles` | pluginTool |
| 31 | 컴포넌트 | `create_component_instance` | pluginTool |
| 32 | 컴포넌트 | `get_instance_overrides` | pluginTool |
| 33 | 컴포넌트 | `set_instance_overrides` | pluginTool |
| 34 | 어노테이션 | `get_annotations` | pluginTool |
| 35 | 어노테이션 | `set_annotation` | pluginTool |
| 36 | 어노테이션 | `set_multiple_annotations` | pluginTool |
| 37 | 내보내기 | `export_node_as_image` | pluginTool |
| 38 | 프로토타입 | `get_reactions` | pluginTool |
| 39 | 프로토타입 | `set_default_connector` | pluginTool |
| 40 | 프로토타입 | `create_connections` | pluginTool |

### REST API Tool (신규 5개)

| # | Tool 이름 | 설명 |
|---|-----------|------|
| 41 | `get_file` | 파일 메타데이터 + 노드 트리 |
| 42 | `get_file_nodes` | 특정 노드 상세 조회 |
| 43 | `get_file_components` | 파일 컴포넌트 목록 |
| 44 | `get_file_styles` | 파일 스타일 목록 |
| 45 | `get_images` | 노드 렌더링 이미지 URL |

---

## 5. 빌드 결과

```
dist/server.js      26.11 KB (ESM, shebang 포함)
dist/server.js.map  51.57 KB
dist/server.d.ts    13 B
```

빌드 시간: ~60ms (tsup, target: node20)

---

## 6. 전환 설정

### .mcp.json

```jsonc
// 교체 완료 (자체 서버)
{
  "mcpServers": {
    "TalkToFigma": {
      "command": "node",
      "args": ["dist/server.js"],
      "type": "stdio",
      "env": {
        "DEBUG": "1"
      }
    }
  }
}
```

### 검증 체크리스트

- [ ] `join_channel` → 채널 연결 성공
- [ ] `get_document_info` → 문서 정보 반환
- [ ] `create_frame` + `create_rectangle` + `create_text` → 프레임 내 요소 생성
- [ ] `set_fill_color`, `set_corner_radius` → 스타일 적용
- [ ] `set_layout_mode` + `set_padding` + `set_item_spacing` → Auto Layout
- [ ] `create_component_instance` → 컴포넌트 인스턴스 생성
- [ ] `get_file` (REST) → 파일 메타데이터 반환
- [ ] `export_node_as_image` → 이미지 내보내기

---

## 7. 미구현 (Phase 1 범위 외)

- **Prompts**: 5개 MCP Prompt 정의 (design_strategy 등) — Phase 2에서 추가 예정
- **Cache**: LRU 캐시 — Phase 3에서 추가 예정

---

*다음 문서: [Phase 2 — 갭 해소](./phase-2-extended-tools.md)*
