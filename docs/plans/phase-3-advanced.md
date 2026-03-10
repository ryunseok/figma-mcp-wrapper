# Phase 3 — 고급 기능 + 자동화

> **목표**: Variables, Component/Variant 생성, Webhooks, 캐싱, 병렬 실행, Boolean 연산
> **전제 조건**: Phase 2 완료 (63개 Tool 작동, 확장 Plugin 운영 중)
> **완료 기준**: 디자인 시스템 구축과 Figma↔Code 양방향 동기화가 MCP로 가능
> **상위 문서**: [implementation-plan.md](./implementation-plan.md)

---

## 1. Variables API (REST + Plugin 바인딩)

Figma Variables는 디자인 토큰의 핵심. REST API로 CRUD, Plugin API로 노드 바인딩.

### 1.1 REST API Tool (3개)

#### get_variables

```typescript
schema: {
  fileKey: z.string(),
}
// REST: GET /v1/files/:file_key/variables/local
// 반환: 모든 로컬 변수 (색상, 숫자, 문자열, 불리언) + 컬렉션 + 모드
```

#### get_published_variables

```typescript
schema: {
  fileKey: z.string(),
}
// REST: GET /v1/files/:file_key/variables/published
```

#### set_variables

변수 생성/수정/삭제를 한 번의 호출로 처리.

```typescript
schema: {
  fileKey: z.string(),
  actions: z.array(z.object({
    action: z.enum(["CREATE", "UPDATE", "DELETE"]),
    // CREATE/UPDATE
    id: z.string().optional(),
    name: z.string().optional(),
    variableCollectionId: z.string().optional(),
    resolvedType: z.enum(["BOOLEAN", "FLOAT", "STRING", "COLOR"]).optional(),
    valuesByMode: z.record(z.string(), z.unknown()).optional(),
    // DELETE
    variableId: z.string().optional(),
  })),
}
// REST: POST /v1/files/:file_key/variables
// 주의: file_variables:write 권한 필요
```

### 1.2 Plugin Bridge Tool (2개)

#### bind_variable

노드 속성에 변수를 바인딩.

```typescript
schema: {
  nodeId: z.string(),
  property: z.enum([
    "fills", "strokes", "effects", "opacity",
    "width", "height", "paddingLeft", "paddingRight", "paddingTop", "paddingBottom",
    "itemSpacing", "cornerRadius", "fontSize", "lineHeight", "letterSpacing",
  ]),
  variableId: z.string().describe("Variable ID to bind"),
  fillIndex: z.number().optional().describe("For fills/strokes, which index to bind"),
}

// Plugin 구현:
// const variable = figma.variables.getVariableById(variableId);
// node.setBoundVariable(property, variable);
```

#### unbind_variable

```typescript
schema: {
  nodeId: z.string(),
  property: z.string(),
}
// Plugin: node.setBoundVariable(property, null);
```

---

## 2. Component/Variant 생성 (3개)

### 2.1 create_component

기존 노드를 컴포넌트로 변환하거나, 새 컴포넌트 생성.

```typescript
schema: {
  // 방법 1: 새 컴포넌트 생성
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  name: z.string(),

  // 방법 2: 기존 노드를 컴포넌트로 변환
  fromNodeId: z.string().optional().describe("Convert existing node to component"),
}

// Plugin 구현:
// 방법 1: const comp = figma.createComponent(); comp.resize(w, h);
// 방법 2: 기존 노드 프로퍼티 복사 → 컴포넌트로 재생성
```

### 2.2 create_component_set

여러 컴포넌트를 Variant Set으로 묶기.

```typescript
schema: {
  componentIds: z.array(z.string()).min(2).describe("Component IDs to combine as variants"),
  name: z.string().optional(),
}

// Plugin 구현:
// const components = componentIds.map(id => figma.getNodeById(id));
// figma.combineAsVariants(components, parent);
```

### 2.3 set_component_property

컴포넌트에 프로퍼티(Variant 축) 추가/수정.

```typescript
schema: {
  componentId: z.string(),
  action: z.enum(["ADD", "EDIT", "DELETE"]),
  propertyName: z.string(),
  propertyType: z.enum(["VARIANT", "TEXT", "BOOLEAN", "INSTANCE_SWAP"]).optional(),
  defaultValue: z.string().optional(),
  variantOptions: z.array(z.string()).optional().describe("For VARIANT type: available options"),
}

// Plugin 구현:
// component.addComponentProperty(name, type, defaultValue);
// component.editComponentProperty(name, { preferredValues });
```

---

## 3. Boolean 연산 (1개)

### 3.1 boolean_operation

```typescript
schema: {
  nodeIds: z.array(z.string()).min(2),
  operation: z.enum(["UNION", "SUBTRACT", "INTERSECT", "EXCLUDE"]),
  name: z.string().optional(),
}

// Plugin 구현:
// const nodes = nodeIds.map(id => figma.getNodeById(id));
// const result = figma.union(nodes, parent); // or subtract, intersect, exclude
```

---

## 4. REST API 확장 (4개)

### 4.1 Comments API

```typescript
// get_comments
schema: { fileKey: z.string() }
// REST: GET /v1/files/:file_key/comments

// post_comment
schema: {
  fileKey: z.string(),
  message: z.string(),
  nodeId: z.string().optional(),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
}
// REST: POST /v1/files/:file_key/comments
```

### 4.2 Webhooks API

```typescript
// create_webhook
schema: {
  event_type: z.enum([
    "FILE_UPDATE", "FILE_DELETE", "FILE_VERSION_UPDATE",
    "LIBRARY_PUBLISH", "FILE_COMMENT",
  ]),
  team_id: z.string().optional(),
  project_id: z.string().optional(),
  file_key: z.string().optional(),
  endpoint: z.string().url(),
  passcode: z.string(),
  description: z.string().optional(),
}
// REST: POST /v2/webhooks

// list_webhooks
schema: { team_id: z.string() }
// REST: GET /v2/webhooks?team_id=xxx

// delete_webhook
schema: { webhook_id: z.string() }
// REST: DELETE /v2/webhooks/:id
```

### 4.3 Dev Resources API

```typescript
// get_dev_resources
schema: { fileKey: z.string(), nodeId: z.string().optional() }
// REST: GET /v1/files/:file_key/dev_resources

// create_dev_resource
schema: {
  fileKey: z.string(),
  nodeId: z.string(),
  name: z.string(),
  url: z.string().url(),
}
// REST: POST /v1/dev_resources
```

---

## 5. 캐싱 레이어

### 5.1 LRU Cache

```typescript
// src/cache/lru-cache.ts
export class LRUCache<T> {
  private cache = new Map<string, { value: T; expiresAt: number }>();

  constructor(
    private maxSize: number = 500,
    private defaultTtlMs: number = 60_000, // 1분
  ) {}

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    // LRU: 최근 접근 항목을 맨 뒤로
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    if (this.cache.size >= this.maxSize) {
      // 가장 오래된 항목 제거
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
    });
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) this.cache.delete(key);
    }
  }

  clear(): void {
    this.cache.clear();
  }
}
```

### 5.2 캐시 적용 위치

| Tool | 캐시 키 | TTL | 무효화 시점 |
|------|---------|-----|------------|
| `get_file` | `rest:file:{fileKey}` | 5분 | 파일 수정 시 |
| `get_file_components` | `rest:components:{fileKey}` | 10분 | 컴포넌트 변경 시 |
| `get_file_styles` | `rest:styles:{fileKey}` | 10분 | 스타일 변경 시 |
| `get_local_components` | `plugin:components` | 2분 | 컴포넌트 생성/삭제 시 |
| `get_node_info` | `plugin:node:{nodeId}` | 30초 | 노드 수정 시 |
| `get_variables` | `rest:vars:{fileKey}` | 5분 | 변수 변경 시 |

쓰기 Tool 실행 시 관련 캐시 자동 무효화:

```typescript
// Tool handler 내부
async handler(params, ctx) {
  const result = await ctx.pluginBridge.sendCommand("create_rectangle", params);
  // 캐시 무효화: 문서 구조가 변경되었으므로
  ctx.cache.invalidatePattern("plugin:node:.*");
  return JSON.stringify(result);
}
```

---

## 6. 병렬 실행

### 6.1 배치 명령

Plugin Bridge에 배치 실행 기능 추가.

```typescript
// src/transport/plugin-bridge.ts 확장
async sendBatch(commands: Array<{ command: string; params: Record<string, unknown> }>): Promise<unknown[]> {
  // Plugin에 batch 명령 전송 → Plugin 내에서 순차 실행 후 결과 배열 반환
  return this.sendCommand("batch_execute", { commands });
}
```

### 6.2 REST API 병렬화

REST API 호출은 독립적이므로 `Promise.all`로 병렬 실행.

```typescript
// 여러 노드 이미지를 동시 요청
const [images1, images2] = await Promise.all([
  restClient.getImages(fileKey, nodeIds1),
  restClient.getImages(fileKey, nodeIds2),
]);
```

---

## 7. Phase 3 Tool 요약

| # | 카테고리 | Tool 이름 | 전송 |
|---|---------|-----------|------|
| 1 | Variables | `get_variables` | REST |
| 2 | Variables | `get_published_variables` | REST |
| 3 | Variables | `set_variables` | REST |
| 4 | Variables | `bind_variable` | Plugin |
| 5 | Variables | `unbind_variable` | Plugin |
| 6 | 컴포넌트 | `create_component` | Plugin |
| 7 | 컴포넌트 | `create_component_set` | Plugin |
| 8 | 컴포넌트 | `set_component_property` | Plugin |
| 9 | Boolean | `boolean_operation` | Plugin |
| 10 | Comments | `get_comments` | REST |
| 11 | Comments | `post_comment` | REST |
| 12 | Webhooks | `create_webhook` | REST |
| 13 | Webhooks | `list_webhooks` | REST |
| 14 | Webhooks | `delete_webhook` | REST |
| 15 | Dev Resources | `get_dev_resources` | REST |
| 16 | Dev Resources | `create_dev_resource` | REST |
| 17 | 배치 | `batch_execute` | Plugin |
| 18 | 캐시 | `clear_cache` | 내부 |

**최종 합계**: Phase 1 (46) + Phase 2 (17) + Phase 3 (18) = **81개 Tool**

---

## 8. 전체 Tool 커버리지 비교

| 영역 | TalkToFigma | Phase 1 | Phase 2 | Phase 3 |
|------|-------------|---------|---------|---------|
| 노드 생성 | 3종 | 3종 | **10종** | 10종 |
| 스타일 | 색상만 | 색상만 | **+이펙트/그라디언트/블렌드** | 동일 |
| 텍스트 | 내용만 | 내용만 | **+폰트/사이즈/범위 스타일** | 동일 |
| 레이아웃 | Auto Layout | Auto Layout | **+Constraints/Grid** | 동일 |
| 컴포넌트 | 인스턴스만 | 인스턴스만 | 인스턴스만 | **+컴포넌트/Variant 생성** |
| Variables | X | X | X | **REST CRUD + 바인딩** |
| Boolean | X | X | X | **Union/Subtract/Intersect/Exclude** |
| REST API | X | **Files/Components/Styles/Images** | 동일 | **+Comments/Webhooks/DevResources** |
| 캐싱 | X | X | X | **LRU Cache** |
| 병렬 실행 | X | X | X | **batch_execute** |
| **Tool 수** | **41** | **46** | **63** | **81** |

---

## 9. 향후 확장 가능성 (Phase 3 이후)

Phase 3 이후 추가 검토할 수 있는 기능들:

| 기능 | 설명 | 의존성 |
|------|------|--------|
| 코드 생성 오케스트레이션 | Figma 노드 → Flutter/React 코드 자동 생성 | Phase 3 + CodeGen 엔진 |
| 디자인 변경 감지 | Webhook 기반 자동 동기화 | Phase 3 Webhooks |
| 자동 PR 생성 | 디자인 변경 → GitHub PR | Phase 3 + GitHub API |
| 디자인 시스템 감사 | 미사용 컴포넌트/변수 탐지 | Phase 3 Variables + Components |
| 멀티 파일 동기화 | 여러 Figma 파일 간 디자인 토큰 동기화 | Phase 3 Variables |

이 기능들은 `docs/architecture/figma-mcp-server-integration.md`에 상세 설계가 이미 존재한다.

---

*상위 문서: [implementation-plan.md](./implementation-plan.md)*