// Layout handlers — Phase 1 (existing) + Phase 2 (constraints, grid)

function getFrame(nodeId: string): FrameNode {
  const node = figma.getNodeById(nodeId) as FrameNode;
  if (!node) throw new Error(`Node not found: ${nodeId}`);
  return node;
}

// --- Phase 1: Existing ---

export async function setLayoutMode(params: {
  nodeId: string; layoutMode: string; layoutWrap?: string;
}) {
  const frame = getFrame(params.nodeId);
  frame.layoutMode = params.layoutMode as "NONE" | "HORIZONTAL" | "VERTICAL";
  if (params.layoutWrap) {
    frame.layoutWrap = params.layoutWrap as "NO_WRAP" | "WRAP";
  }
  return { id: frame.id, layoutMode: frame.layoutMode };
}

export async function setPadding(params: {
  nodeId: string;
  paddingTop?: number; paddingRight?: number;
  paddingBottom?: number; paddingLeft?: number;
}) {
  const frame = getFrame(params.nodeId);
  if (params.paddingTop !== undefined) frame.paddingTop = params.paddingTop;
  if (params.paddingRight !== undefined) frame.paddingRight = params.paddingRight;
  if (params.paddingBottom !== undefined) frame.paddingBottom = params.paddingBottom;
  if (params.paddingLeft !== undefined) frame.paddingLeft = params.paddingLeft;
  return { id: frame.id, padding: { top: frame.paddingTop, right: frame.paddingRight, bottom: frame.paddingBottom, left: frame.paddingLeft } };
}

export async function setAxisAlign(params: {
  nodeId: string;
  primaryAxisAlignItems?: string; counterAxisAlignItems?: string;
}) {
  const frame = getFrame(params.nodeId);
  if (params.primaryAxisAlignItems) {
    frame.primaryAxisAlignItems = params.primaryAxisAlignItems as "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN";
  }
  if (params.counterAxisAlignItems) {
    frame.counterAxisAlignItems = params.counterAxisAlignItems as "MIN" | "CENTER" | "MAX" | "BASELINE";
  }
  return { id: frame.id, primaryAxisAlignItems: frame.primaryAxisAlignItems, counterAxisAlignItems: frame.counterAxisAlignItems };
}

export async function setLayoutSizing(params: {
  nodeId: string;
  layoutSizingHorizontal?: string; layoutSizingVertical?: string;
}) {
  const frame = getFrame(params.nodeId);
  if (params.layoutSizingHorizontal) {
    frame.layoutSizingHorizontal = params.layoutSizingHorizontal as "FIXED" | "HUG" | "FILL";
  }
  if (params.layoutSizingVertical) {
    frame.layoutSizingVertical = params.layoutSizingVertical as "FIXED" | "HUG" | "FILL";
  }
  return { id: frame.id, layoutSizingHorizontal: frame.layoutSizingHorizontal, layoutSizingVertical: frame.layoutSizingVertical };
}

export async function setItemSpacing(params: {
  nodeId: string; itemSpacing?: number; counterAxisSpacing?: number;
}) {
  const frame = getFrame(params.nodeId);
  if (params.itemSpacing !== undefined) frame.itemSpacing = params.itemSpacing;
  if (params.counterAxisSpacing !== undefined) frame.counterAxisSpacing = params.counterAxisSpacing;
  return { id: frame.id, itemSpacing: frame.itemSpacing };
}

// --- Phase 2: New layout tools ---

export async function setConstraints(params: {
  nodeId: string; horizontal?: string; vertical?: string;
}) {
  const node = figma.getNodeById(params.nodeId) as SceneNode & ConstraintMixin;
  if (!node) throw new Error(`Node not found: ${params.nodeId}`);

  node.constraints = {
    horizontal: (params.horizontal ?? node.constraints.horizontal) as ConstraintType,
    vertical: (params.vertical ?? node.constraints.vertical) as ConstraintType,
  };

  return { id: node.id, constraints: node.constraints };
}

export async function setGrid(params: {
  nodeId: string;
  grids: Array<{
    pattern: string; sectionSize?: number; count?: number;
    gutterSize?: number; offset?: number; alignment?: string;
    visible?: boolean;
    color?: { r: number; g: number; b: number; a: number };
  }>;
}) {
  const frame = getFrame(params.nodeId);

  frame.layoutGrids = params.grids.map((g) => {
    if (g.pattern === "GRID") {
      return {
        pattern: "GRID" as const,
        sectionSize: g.sectionSize ?? 10,
        visible: g.visible ?? true,
        color: g.color ?? { r: 0, g: 0, b: 1, a: 0.1 },
      };
    }
    return {
      pattern: g.pattern as "COLUMNS" | "ROWS",
      count: g.count ?? 12,
      sectionSize: g.sectionSize ?? 1,
      gutterSize: g.gutterSize ?? 20,
      offset: g.offset ?? 0,
      alignment: (g.alignment ?? "STRETCH") as "MIN" | "CENTER" | "MAX" | "STRETCH",
      visible: g.visible ?? true,
      color: g.color ?? { r: 0, g: 0, b: 1, a: 0.1 },
    };
  });

  return { id: frame.id, gridCount: frame.layoutGrids.length };
}
