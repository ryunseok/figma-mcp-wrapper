# Phase 2 — 갭 해소 (TalkToFigma 초월)

> **목표**: 누락 노드 타입, 이펙트, 그라디언트, 텍스트 스타일링, Constraints 등 확장
> **전제 조건**: Phase 1 완료 (41개 기존 Tool + REST 5개 작동)
> **완료 기준**: 캠페인 프로토타입 배치가 수동 조정 없이 MCP만으로 완결
> **상위 문서**: [implementation-plan.md](./implementation-plan.md)

---

## 1. Figma Plugin 확장

Phase 2부터는 기존 cursor-talk-to-figma Plugin이 지원하지 않는 명령을 처리해야 한다.
**확장 방식**: 기존 Plugin의 명령 핸들러에 새 command를 추가하거나, 별도 확장 Plugin을 작성.

### 1.1 확장 Plugin 구조

```
figma-plugin/                    # 자체 Figma Plugin
├── manifest.json
├── code.ts                      # Plugin 메인 (명령 라우터)
├── handlers/
│   ├── node-creation.ts         # 신규 노드 생성 핸들러
│   ├── style-manipulation.ts    # 이펙트/그라디언트/블렌드
│   ├── text-styling.ts          # 텍스트 세밀 제어
│   ├── constraints.ts           # Constraints/반응형
│   └── boolean-ops.ts           # Boolean 연산
├── utils/
│   ├── color.ts                 # 색상 변환
│   └── socket.ts                # WebSocket 통신
└── tsconfig.json
```

### 1.2 Plugin 명령 라우터 확장

```typescript
// figma-plugin/code.ts (핵심 부분)
// 기존 TalkToFigma 프로토콜과 동일한 WebSocket 통신

figma.ui.onmessage = async (msg) => {
  const { command, params, commandId } = msg;

  try {
    let result: unknown;

    switch (command) {
      // === 기존 명령 (Phase 1에서 이미 지원) ===
      case "create_rectangle": result = await createRectangle(params); break;
      case "create_frame":     result = await createFrame(params); break;
      case "create_text":      result = await createText(params); break;
      // ... (기존 41개)

      // === Phase 2 신규 명령 ===
      // 노드 생성
      case "create_ellipse":   result = await createEllipse(params); break;
      case "create_line":      result = await createLine(params); break;
      case "create_polygon":   result = await createPolygon(params); break;
      case "create_star":      result = await createStar(params); break;
      case "create_vector":    result = await createVector(params); break;
      case "create_group":     result = await createGroup(params); break;
      case "create_section":   result = await createSection(params); break;
      // 스타일
      case "set_effect":       result = await setEffect(params); break;
      case "set_gradient":     result = await setGradient(params); break;
      case "set_image_fill":   result = await setImageFill(params); break;
      case "set_blend_mode":   result = await setBlendMode(params); break;
      case "set_opacity":      result = await setOpacity(params); break;
      case "set_stroke_detail":result = await setStrokeDetail(params); break;
      // 텍스트
      case "set_text_style":   result = await setTextStyle(params); break;
      case "set_text_range_style": result = await setTextRangeStyle(params); break;
      // 레이아웃
      case "set_constraints":  result = await setConstraints(params); break;
      case "set_grid":         result = await setGrid(params); break;

      default:
        throw new Error(`Unknown command: ${command}`);
    }

    figma.ui.postMessage({ id: commandId, result, error: null });
  } catch (error) {
    figma.ui.postMessage({
      id: commandId,
      result: null,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
```

---

## 2. 신규 Tool — 노드 생성 (7개)

### 2.1 create_ellipse

```typescript
// src/tools/node/create-ellipse.ts
schema: {
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  name: z.string().optional(),
  parentId: z.string().optional(),
  arcStartAngle: z.number().optional().describe("Arc start in degrees (0-360)"),
  arcEndAngle: z.number().optional().describe("Arc end in degrees (0-360)"),
  arcType: z.enum(["INNER_RADIUS", "CHORD", "ROUND"]).optional(),
}
// Plugin 구현: figma.createEllipse()
```

### 2.2 create_line

```typescript
schema: {
  startX: z.number(), startY: z.number(),
  endX: z.number(), endY: z.number(),
  strokeWeight: z.number().optional().default(1),
  strokeColor: z.object({ r: z.number(), g: z.number(), b: z.number(), a: z.number().optional() }).optional(),
  name: z.string().optional(),
  parentId: z.string().optional(),
}
// Plugin 구현: figma.createLine() + rotation 계산
```

### 2.3 create_polygon

```typescript
schema: {
  x: z.number(), y: z.number(),
  width: z.number(), height: z.number(),
  pointCount: z.number().min(3).default(3).describe("Number of sides"),
  name: z.string().optional(),
  parentId: z.string().optional(),
}
// Plugin 구현: figma.createPolygon()
```

### 2.4 create_star

```typescript
schema: {
  x: z.number(), y: z.number(),
  width: z.number(), height: z.number(),
  pointCount: z.number().min(3).default(5),
  innerRadius: z.number().min(0).max(1).default(0.382).describe("Inner radius ratio (0-1)"),
  name: z.string().optional(),
  parentId: z.string().optional(),
}
// Plugin 구현: figma.createStar()
```

### 2.5 create_vector

```typescript
schema: {
  x: z.number(), y: z.number(),
  vectorPaths: z.array(z.object({
    data: z.string().describe("SVG path data (d attribute)"),
    windingRule: z.enum(["EVENODD", "NONZERO"]).default("NONZERO"),
  })),
  name: z.string().optional(),
  parentId: z.string().optional(),
}
// Plugin 구현: figma.createVector() + vectorPaths 설정
```

### 2.6 create_group

```typescript
schema: {
  nodeIds: z.array(z.string()).min(1).describe("Node IDs to group"),
  name: z.string().optional(),
}
// Plugin 구현: figma.group(nodes, parent)
```

### 2.7 create_section

```typescript
schema: {
  x: z.number(), y: z.number(),
  width: z.number(), height: z.number(),
  name: z.string(),
  fillColor: z.object({ r: z.number(), g: z.number(), b: z.number() }).optional(),
}
// Plugin 구현: figma.createSection()
```

---

## 3. 신규 Tool — 스타일/이펙트 (6개)

### 3.1 set_effect

디자인 시스템에서 가장 빈번하게 부딪히는 갭. 카드 shadow, 모달 dim 등.

```typescript
schema: {
  nodeId: z.string(),
  effects: z.array(z.object({
    type: z.enum(["DROP_SHADOW", "INNER_SHADOW", "LAYER_BLUR", "BACKGROUND_BLUR"]),
    visible: z.boolean().default(true),
    // Shadow 전용
    color: z.object({ r: z.number(), g: z.number(), b: z.number(), a: z.number() }).optional(),
    offset: z.object({ x: z.number(), y: z.number() }).optional(),
    radius: z.number().optional(),
    spread: z.number().optional(),
    // Blur 전용
    blurRadius: z.number().optional(),
  })),
  append: z.boolean().default(false).describe("true면 기존 이펙트에 추가, false면 교체"),
}

// Plugin 구현 예시:
// const node = figma.getNodeById(nodeId);
// node.effects = effects.map(e => ({
//   type: e.type,
//   visible: e.visible,
//   color: { r: e.color.r, g: e.color.g, b: e.color.b, a: e.color.a },
//   offset: e.offset ?? { x: 0, y: 0 },
//   radius: e.radius ?? e.blurRadius ?? 4,
//   spread: e.spread ?? 0,
// }));
```

### 3.2 set_gradient

```typescript
schema: {
  nodeId: z.string(),
  gradient: z.object({
    type: z.enum(["GRADIENT_LINEAR", "GRADIENT_RADIAL", "GRADIENT_ANGULAR", "GRADIENT_DIAMOND"]),
    stops: z.array(z.object({
      position: z.number().min(0).max(1),
      color: z.object({ r: z.number(), g: z.number(), b: z.number(), a: z.number().default(1) }),
    })),
    // Linear: 시작점/끝점
    startPoint: z.object({ x: z.number(), y: z.number() }).optional(),
    endPoint: z.object({ x: z.number(), y: z.number() }).optional(),
  }),
}
```

### 3.3 set_image_fill

```typescript
schema: {
  nodeId: z.string(),
  imageUrl: z.string().url().describe("Image URL to fill"),
  scaleMode: z.enum(["FILL", "FIT", "CROP", "TILE"]).default("FILL"),
}
// Plugin에서 figma.createImageAsync(bytes) 사용
```

### 3.4 set_blend_mode

```typescript
schema: {
  nodeId: z.string(),
  blendMode: z.enum([
    "NORMAL", "DARKEN", "MULTIPLY", "COLOR_BURN", "LINEAR_BURN",
    "LIGHTEN", "SCREEN", "COLOR_DODGE", "LINEAR_DODGE",
    "OVERLAY", "SOFT_LIGHT", "HARD_LIGHT",
    "DIFFERENCE", "EXCLUSION", "HUE", "SATURATION", "COLOR", "LUMINOSITY",
  ]),
}
```

### 3.5 set_opacity

```typescript
schema: {
  nodeId: z.string(),
  opacity: z.number().min(0).max(1),
}
```

### 3.6 set_stroke_detail

기존 `set_stroke_color`는 색상만. 이 Tool은 세부 속성 제어.

```typescript
schema: {
  nodeId: z.string(),
  strokeWeight: z.number().optional(),
  strokeAlign: z.enum(["INSIDE", "OUTSIDE", "CENTER"]).optional(),
  strokeCap: z.enum(["NONE", "ROUND", "SQUARE", "ARROW_LINES", "ARROW_EQUILATERAL"]).optional(),
  strokeJoin: z.enum(["MITER", "BEVEL", "ROUND"]).optional(),
  dashPattern: z.array(z.number()).optional().describe("Dash/gap pattern, e.g. [10, 5]"),
}
```

---

## 4. 신규 Tool — 텍스트 스타일링 (2개)

### 4.1 set_text_style

텍스트 노드 전체에 스타일 적용.

```typescript
schema: {
  nodeId: z.string(),
  fontFamily: z.string().optional().describe("e.g. 'Pretendard'"),
  fontStyle: z.string().optional().describe("e.g. 'Bold', 'SemiBold', 'Regular'"),
  fontSize: z.number().optional(),
  lineHeight: z.union([
    z.object({ value: z.number(), unit: z.enum(["PIXELS", "PERCENT"]) }),
    z.literal("AUTO"),
  ]).optional(),
  letterSpacing: z.object({ value: z.number(), unit: z.enum(["PIXELS", "PERCENT"]) }).optional(),
  textAlignHorizontal: z.enum(["LEFT", "CENTER", "RIGHT", "JUSTIFIED"]).optional(),
  textAlignVertical: z.enum(["TOP", "CENTER", "BOTTOM"]).optional(),
  textDecoration: z.enum(["NONE", "UNDERLINE", "STRIKETHROUGH"]).optional(),
  textCase: z.enum(["ORIGINAL", "UPPER", "LOWER", "TITLE"]).optional(),
  color: z.object({ r: z.number(), g: z.number(), b: z.number(), a: z.number().default(1) }).optional(),
}

// Plugin 구현:
// await figma.loadFontAsync({ family: fontFamily, style: fontStyle });
// node.fontName = { family: fontFamily, style: fontStyle };
// node.fontSize = fontSize;
// ...
```

### 4.2 set_text_range_style

텍스트 노드 내 특정 범위에만 스타일 적용 (혼합 스타일링).

```typescript
schema: {
  nodeId: z.string(),
  start: z.number().describe("Character start index"),
  end: z.number().describe("Character end index"),
  fontFamily: z.string().optional(),
  fontStyle: z.string().optional(),
  fontSize: z.number().optional(),
  color: z.object({ r: z.number(), g: z.number(), b: z.number(), a: z.number().default(1) }).optional(),
  textDecoration: z.enum(["NONE", "UNDERLINE", "STRIKETHROUGH"]).optional(),
}

// Plugin 구현:
// node.setRangeFontName(start, end, { family, style });
// node.setRangeFontSize(start, end, fontSize);
// node.setRangeFills(start, end, [{ type: 'SOLID', color }]);
```

---

## 5. 신규 Tool — 레이아웃 (2개)

### 5.1 set_constraints

```typescript
schema: {
  nodeId: z.string(),
  horizontal: z.enum(["MIN", "CENTER", "MAX", "STRETCH", "SCALE"]).optional(),
  vertical: z.enum(["MIN", "CENTER", "MAX", "STRETCH", "SCALE"]).optional(),
}
// Plugin: node.constraints = { horizontal, vertical };
```

### 5.2 set_grid

```typescript
schema: {
  nodeId: z.string(),
  grids: z.array(z.object({
    pattern: z.enum(["COLUMNS", "ROWS", "GRID"]),
    sectionSize: z.number().optional(),
    count: z.number().optional(),
    gutterSize: z.number().optional(),
    offset: z.number().optional(),
    alignment: z.enum(["MIN", "CENTER", "MAX", "STRETCH"]).optional(),
    visible: z.boolean().default(true),
    color: z.object({ r: z.number(), g: z.number(), b: z.number(), a: z.number() }).optional(),
  })),
}
// Plugin: node.layoutGrids = grids;
```

---

## 6. Phase 2 Tool 요약

| # | 카테고리 | Tool 이름 | 구현 필요 |
|---|---------|-----------|----------|
| 1 | 노드 | `create_ellipse` | Plugin 확장 |
| 2 | 노드 | `create_line` | Plugin 확장 |
| 3 | 노드 | `create_polygon` | Plugin 확장 |
| 4 | 노드 | `create_star` | Plugin 확장 |
| 5 | 노드 | `create_vector` | Plugin 확장 |
| 6 | 노드 | `create_group` | Plugin 확장 |
| 7 | 노드 | `create_section` | Plugin 확장 |
| 8 | 스타일 | `set_effect` | Plugin 확장 |
| 9 | 스타일 | `set_gradient` | Plugin 확장 |
| 10 | 스타일 | `set_image_fill` | Plugin 확장 |
| 11 | 스타일 | `set_blend_mode` | Plugin 확장 |
| 12 | 스타일 | `set_opacity` | Plugin 확장 |
| 13 | 스타일 | `set_stroke_detail` | Plugin 확장 |
| 14 | 텍스트 | `set_text_style` | Plugin 확장 |
| 15 | 텍스트 | `set_text_range_style` | Plugin 확장 |
| 16 | 레이아웃 | `set_constraints` | Plugin 확장 |
| 17 | 레이아웃 | `set_grid` | Plugin 확장 |

**합계**: Phase 1 (46) + Phase 2 (17) = **63개 Tool**

---

## 7. 실용 검증: 캠페인 프로토타입 배치

Phase 2 완료 시, [figma-prototype-placement-plan.md](./figma-prototype-placement-plan.md)의 작업이 MCP만으로 가능해야 한다:

| 작업 | Phase 1 | Phase 2 |
|------|---------|---------|
| 섹션 생성 (8000×3500, fill #444) | X | `create_section` + `set_fill_color` |
| 프레임 생성 (1512×982) | `create_frame` | O |
| LNB 컴포넌트 배치 | `create_component_instance` | O |
| 카드 shadow 적용 | X | `set_effect` (DROP_SHADOW) |
| 테이블 헤더 Bold 14px | X | `set_text_style` |
| 배지 배경색 + 라운딩 | `set_fill_color` + `set_corner_radius` | O |
| 모달 오버레이 (rgba 0,0,0,0.4) | `set_fill_color` (a=0.4) | O |
| KPI 숫자 22px Bold + 라벨 13px SemiBold | X | `set_text_style` 분리 적용 |
| 점선 구분선 | X | `create_line` + `set_stroke_detail` (dashPattern) |

---

*다음 문서: [Phase 3 — 고급 기능](./phase-3-advanced.md)*