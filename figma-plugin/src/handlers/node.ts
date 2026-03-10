// Node CRUD handlers — Phase 1 (existing) + Phase 2 (new shapes)

function getParent(parentId?: string): FrameNode | PageNode | SectionNode {
  if (parentId) {
    const parent = figma.getNodeById(parentId);
    if (!parent) throw new Error(`Parent not found: ${parentId}`);
    return parent as FrameNode;
  }
  return figma.currentPage;
}

// --- Phase 1: Existing ---

export async function createRectangle(params: {
  x: number; y: number; width: number; height: number;
  name?: string; parentId?: string;
}) {
  const rect = figma.createRectangle();
  rect.x = params.x;
  rect.y = params.y;
  rect.resize(params.width, params.height);
  rect.name = params.name ?? "Rectangle";
  getParent(params.parentId).appendChild(rect);
  return { id: rect.id, name: rect.name, x: rect.x, y: rect.y, width: rect.width, height: rect.height, parentId: rect.parent?.id };
}

export async function createFrame(params: {
  x: number; y: number; width: number; height: number;
  name?: string; parentId?: string;
  fillColor?: { r: number; g: number; b: number; a?: number };
  strokeColor?: { r: number; g: number; b: number; a?: number };
  layoutMode?: string; paddingTop?: number; paddingRight?: number;
  paddingBottom?: number; paddingLeft?: number;
  primaryAxisAlignItems?: string; counterAxisAlignItems?: string;
  layoutSizingHorizontal?: string; layoutSizingVertical?: string;
  itemSpacing?: number;
}) {
  const frame = figma.createFrame();
  frame.x = params.x;
  frame.y = params.y;
  frame.resize(params.width, params.height);
  frame.name = params.name ?? "Frame";
  getParent(params.parentId).appendChild(frame);

  if (params.fillColor) {
    const { r, g, b, a } = params.fillColor;
    frame.fills = [{ type: "SOLID", color: { r, g, b }, opacity: a ?? 1 }];
  }
  if (params.strokeColor) {
    const { r, g, b, a } = params.strokeColor;
    frame.strokes = [{ type: "SOLID", color: { r, g, b }, opacity: a ?? 1 }];
  }
  if (params.layoutMode && params.layoutMode !== "NONE") {
    frame.layoutMode = params.layoutMode as "HORIZONTAL" | "VERTICAL";
  }
  if (params.paddingTop !== undefined) frame.paddingTop = params.paddingTop;
  if (params.paddingRight !== undefined) frame.paddingRight = params.paddingRight;
  if (params.paddingBottom !== undefined) frame.paddingBottom = params.paddingBottom;
  if (params.paddingLeft !== undefined) frame.paddingLeft = params.paddingLeft;
  if (params.primaryAxisAlignItems) {
    frame.primaryAxisAlignItems = params.primaryAxisAlignItems as "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN";
  }
  if (params.counterAxisAlignItems) {
    frame.counterAxisAlignItems = params.counterAxisAlignItems as "MIN" | "CENTER" | "MAX" | "BASELINE";
  }
  if (params.layoutSizingHorizontal) {
    frame.layoutSizingHorizontal = params.layoutSizingHorizontal as "FIXED" | "HUG" | "FILL";
  }
  if (params.layoutSizingVertical) {
    frame.layoutSizingVertical = params.layoutSizingVertical as "FIXED" | "HUG" | "FILL";
  }
  if (params.itemSpacing !== undefined) frame.itemSpacing = params.itemSpacing;

  return { id: frame.id, name: frame.name, x: frame.x, y: frame.y, width: frame.width, height: frame.height, parentId: frame.parent?.id };
}

export async function createText(params: {
  x: number; y: number; text: string;
  fontSize?: number; fontWeight?: number;
  fontFamily?: string;
  fontColor?: { r: number; g: number; b: number; a?: number };
  name?: string; parentId?: string;
}) {
  const textNode = figma.createText();
  const family = params.fontFamily || "Pretendard";
  const weight = params.fontWeight || 400;

  // Map weight to Figma style name
  var style = "Regular";
  if (weight >= 700) style = "Bold";
  else if (weight >= 600) style = "SemiBold";
  else if (weight >= 500) style = "Medium";

  // Load default font first (required to modify any text property)
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });

  // Load target font
  try {
    await figma.loadFontAsync({ family: family, style: style });
    textNode.fontName = { family: family, style: style };
  } catch (_e) {
    // Fallback: keep Inter if target font unavailable
  }

  textNode.x = params.x;
  textNode.y = params.y;
  textNode.characters = params.text;
  textNode.name = params.name ?? params.text.substring(0, 20);

  if (params.fontSize) textNode.fontSize = params.fontSize;
  if (params.fontColor) {
    const { r, g, b, a } = params.fontColor;
    textNode.fills = [{ type: "SOLID", color: { r, g, b }, opacity: a ?? 1 }];
  }
  getParent(params.parentId).appendChild(textNode);

  return { id: textNode.id, name: textNode.name, x: textNode.x, y: textNode.y, characters: textNode.characters };
}

export async function moveNode(params: { nodeId: string; x: number; y: number }) {
  const node = figma.getNodeById(params.nodeId) as SceneNode;
  if (!node) throw new Error(`Node not found: ${params.nodeId}`);
  node.x = params.x;
  node.y = params.y;
  return { id: node.id, name: node.name, x: node.x, y: node.y };
}

export async function resizeNode(params: { nodeId: string; width: number; height: number }) {
  const node = figma.getNodeById(params.nodeId) as SceneNode;
  if (!node) throw new Error(`Node not found: ${params.nodeId}`);
  node.resize(params.width, params.height);
  return { id: node.id, name: node.name, width: node.width, height: node.height };
}

export async function cloneNode(params: { nodeId: string; x?: number; y?: number }) {
  const node = figma.getNodeById(params.nodeId) as SceneNode;
  if (!node) throw new Error(`Node not found: ${params.nodeId}`);
  const clone = node.clone();
  if (params.x !== undefined) clone.x = params.x;
  if (params.y !== undefined) clone.y = params.y;
  return { id: clone.id, name: clone.name, x: clone.x, y: clone.y };
}

export async function deleteNode(params: { nodeId: string }) {
  const node = figma.getNodeById(params.nodeId) as SceneNode;
  if (!node) throw new Error(`Node not found: ${params.nodeId}`);
  const info = { id: node.id, name: node.name, type: node.type };
  node.remove();
  return info;
}

export async function deleteMultipleNodes(params: { nodeIds: string[] }) {
  const deleted: Array<{ id: string; name: string }> = [];
  for (const id of params.nodeIds) {
    const node = figma.getNodeById(id) as SceneNode;
    if (node) {
      deleted.push({ id: node.id, name: node.name });
      node.remove();
    }
  }
  return { deletedCount: deleted.length, deleted };
}

// --- Phase 2: New node types ---

export async function createEllipse(params: {
  x: number; y: number; width: number; height: number;
  name?: string; parentId?: string;
  arcStartAngle?: number; arcEndAngle?: number;
  arcType?: "INNER_RADIUS" | "CHORD" | "ROUND";
}) {
  const ellipse = figma.createEllipse();
  ellipse.x = params.x;
  ellipse.y = params.y;
  ellipse.resize(params.width, params.height);
  ellipse.name = params.name ?? "Ellipse";

  if (params.arcStartAngle !== undefined || params.arcEndAngle !== undefined) {
    ellipse.arcData = {
      startingAngle: ((params.arcStartAngle ?? 0) * Math.PI) / 180,
      endingAngle: ((params.arcEndAngle ?? 360) * Math.PI) / 180,
      innerRadius: params.arcType === "INNER_RADIUS" ? 0.5 : 0,
    };
  }

  getParent(params.parentId).appendChild(ellipse);
  return { id: ellipse.id, name: ellipse.name, x: ellipse.x, y: ellipse.y, width: ellipse.width, height: ellipse.height };
}

export async function createLine(params: {
  startX: number; startY: number; endX: number; endY: number;
  strokeWeight?: number;
  strokeColor?: { r: number; g: number; b: number; a?: number };
  name?: string; parentId?: string;
}) {
  const line = figma.createLine();
  const dx = params.endX - params.startX;
  const dy = params.endY - params.startY;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  line.x = params.startX;
  line.y = params.startY;
  line.resize(length, 0);
  line.rotation = -angle;
  line.name = params.name ?? "Line";
  line.strokeWeight = params.strokeWeight ?? 1;

  if (params.strokeColor) {
    const { r, g, b, a } = params.strokeColor;
    line.strokes = [{ type: "SOLID", color: { r, g, b }, opacity: a ?? 1 }];
  }

  getParent(params.parentId).appendChild(line);
  return { id: line.id, name: line.name };
}

export async function createPolygon(params: {
  x: number; y: number; width: number; height: number;
  pointCount?: number; name?: string; parentId?: string;
}) {
  const polygon = figma.createPolygon();
  polygon.x = params.x;
  polygon.y = params.y;
  polygon.resize(params.width, params.height);
  polygon.pointCount = params.pointCount ?? 3;
  polygon.name = params.name ?? "Polygon";
  getParent(params.parentId).appendChild(polygon);
  return { id: polygon.id, name: polygon.name, pointCount: polygon.pointCount };
}

export async function createStar(params: {
  x: number; y: number; width: number; height: number;
  pointCount?: number; innerRadius?: number;
  name?: string; parentId?: string;
}) {
  const star = figma.createStar();
  star.x = params.x;
  star.y = params.y;
  star.resize(params.width, params.height);
  star.pointCount = params.pointCount ?? 5;
  star.innerRadius = params.innerRadius ?? 0.382;
  star.name = params.name ?? "Star";
  getParent(params.parentId).appendChild(star);
  return { id: star.id, name: star.name, pointCount: star.pointCount, innerRadius: star.innerRadius };
}

export async function createVector(params: {
  x: number; y: number;
  vectorPaths: Array<{ data: string; windingRule?: string }>;
  name?: string; parentId?: string;
}) {
  const vector = figma.createVector();
  vector.x = params.x;
  vector.y = params.y;
  vector.vectorPaths = params.vectorPaths.map((p) => ({
    data: p.data,
    windingRule: (p.windingRule as "EVENODD" | "NONZERO") ?? "NONZERO",
  }));
  vector.name = params.name ?? "Vector";
  getParent(params.parentId).appendChild(vector);
  return { id: vector.id, name: vector.name };
}

export async function createGroup(params: { nodeIds: string[]; name?: string }) {
  const nodes = params.nodeIds
    .map((id) => figma.getNodeById(id))
    .filter((n): n is SceneNode => n !== null && "x" in n);

  if (nodes.length === 0) throw new Error("No valid nodes to group");

  const group = figma.group(nodes, nodes[0].parent!);
  group.name = params.name ?? "Group";
  return { id: group.id, name: group.name, childCount: group.children.length };
}

export async function createSection(params: {
  x: number; y: number; width: number; height: number;
  name: string;
  fillColor?: { r: number; g: number; b: number };
}) {
  const section = figma.createSection();
  section.x = params.x;
  section.y = params.y;
  section.resizeWithoutConstraints(params.width, params.height);
  section.name = params.name;

  if (params.fillColor) {
    section.fills = [{ type: "SOLID", color: params.fillColor }];
  }

  return { id: section.id, name: section.name, x: section.x, y: section.y, width: section.width, height: section.height };
}

export async function reorderChild(params: { parentId: string; nodeId: string; index: number }) {
  const parent = figma.getNodeById(params.parentId);
  if (!parent || !("insertChild" in parent)) throw new Error("Parent not found or not a container: " + params.parentId);
  const node = figma.getNodeById(params.nodeId) as SceneNode;
  if (!node) throw new Error("Node not found: " + params.nodeId);
  (parent as FrameNode).insertChild(params.index, node);
  return { id: node.id, name: node.name, index: params.index };
}

// --- Phase 3: Boolean operations ---

export async function booleanOperation(params: {
  nodeIds: string[];
  operation: "UNION" | "SUBTRACT" | "INTERSECT" | "EXCLUDE";
  name?: string;
}) {
  const nodes = params.nodeIds
    .map((id) => figma.getNodeById(id))
    .filter((n): n is SceneNode => n !== null && "x" in n);

  if (nodes.length < 2) throw new Error("Need at least 2 nodes for boolean operation");

  const parent = nodes[0].parent;
  if (!parent) throw new Error("Nodes must have a parent");

  const opMap = {
    UNION: figma.union,
    SUBTRACT: figma.subtract,
    INTERSECT: figma.intersect,
    EXCLUDE: figma.exclude,
  };

  const op = opMap[params.operation];
  if (!op) throw new Error(`Unknown operation: ${params.operation}`);

  const result = op(nodes, parent as FrameNode | PageNode);
  result.name = params.name ?? `${params.operation} result`;

  return { id: result.id, name: result.name, type: result.type };
}