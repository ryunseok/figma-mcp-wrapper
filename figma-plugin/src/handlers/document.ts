// Document & Selection handlers

export async function getDocumentInfo() {
  const page = figma.currentPage;
  return {
    name: page.name,
    id: page.id,
    type: page.type,
    children: page.children.map((c) => ({ id: c.id, name: c.name, type: c.type })),
    currentPage: { id: page.id, name: page.name, childCount: page.children.length },
    pages: figma.root.children.map((p) => ({
      id: p.id,
      name: p.name,
      childCount: p.children.length,
    })),
  };
}

export async function getSelection() {
  const selection = figma.currentPage.selection;
  return {
    selectionCount: selection.length,
    selection: selection.map((node) => ({
      id: node.id,
      name: node.name,
      type: node.type,
    })),
  };
}

export async function readMyDesign() {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    return { error: "No nodes selected" };
  }

  return {
    nodes: selection.map((node) => serializeNode(node, 2)),
  };
}

export async function getNodeInfo(params: { nodeId: string }) {
  const node = figma.getNodeById(params.nodeId);
  if (!node) throw new Error(`Node not found: ${params.nodeId}`);
  return serializeNode(node, 1);
}

export async function setFocus(params: { nodeId: string }) {
  const node = figma.getNodeById(params.nodeId);
  if (!node) throw new Error(`Node not found: ${params.nodeId}`);

  if ("x" in node) {
    figma.currentPage.selection = [node as SceneNode];
    figma.viewport.scrollAndZoomIntoView([node as SceneNode]);
  }

  return { success: true, name: node.name, id: node.id, message: `Focused on node "${node.name}"` };
}

export async function setSelections(params: { nodeIds: string[] }) {
  const nodes = params.nodeIds
    .map((id) => figma.getNodeById(id))
    .filter((n): n is SceneNode => n !== null && "x" in n);

  figma.currentPage.selection = nodes;
  return { success: true, selectedCount: nodes.length };
}

export async function scanNodesByTypes(params: { nodeId: string; types: string[] }) {
  const parent = figma.getNodeById(params.nodeId);
  if (!parent) throw new Error(`Node not found: ${params.nodeId}`);

  const results: Array<{ id: string; name: string; type: string }> = [];

  function walk(node: BaseNode) {
    if (params.types.includes(node.type)) {
      results.push({ id: node.id, name: node.name, type: node.type });
    }
    if ("children" in node) {
      for (const child of (node as ChildrenMixin).children) {
        walk(child);
      }
    }
  }

  walk(parent);
  return { count: results.length, nodes: results };
}

function serializeNode(node: BaseNode, depth: number): Record<string, unknown> {
  const base: Record<string, unknown> = {
    id: node.id,
    name: node.name,
    type: node.type,
  };

  if ("x" in node) {
    const scene = node as SceneNode;
    base.x = scene.x;
    base.y = scene.y;
    base.width = scene.width;
    base.height = scene.height;
    base.visible = scene.visible;
  }

  if ("fills" in node) {
    base.fills = (node as GeometryMixin).fills;
  }

  if ("strokes" in node) {
    base.strokes = (node as GeometryMixin).strokes;
    base.strokeWeight = (node as GeometryMixin).strokeWeight;
  }

  if ("cornerRadius" in node) {
    base.cornerRadius = (node as RectangleNode).cornerRadius;
  }

  if ("opacity" in node) {
    base.opacity = (node as BlendMixin).opacity;
  }

  if ("effects" in node) {
    base.effects = (node as BlendMixin).effects;
  }

  if ("layoutMode" in node) {
    const frame = node as FrameNode;
    base.layoutMode = frame.layoutMode;
    base.primaryAxisAlignItems = frame.primaryAxisAlignItems;
    base.counterAxisAlignItems = frame.counterAxisAlignItems;
    base.paddingTop = frame.paddingTop;
    base.paddingRight = frame.paddingRight;
    base.paddingBottom = frame.paddingBottom;
    base.paddingLeft = frame.paddingLeft;
    base.itemSpacing = frame.itemSpacing;
  }

  if ("characters" in node) {
    base.characters = (node as TextNode).characters;
    base.fontSize = (node as TextNode).fontSize;
  }

  if (depth > 0 && "children" in node) {
    base.children = (node as ChildrenMixin).children.map((c) =>
      serializeNode(c, depth - 1),
    );
  }

  return base;
}
