// Style handlers — Phase 1 (existing) + Phase 2 (effects, gradient, etc.)

function getNode(nodeId: string): SceneNode {
  const node = figma.getNodeById(nodeId) as SceneNode;
  if (!node) throw new Error(`Node not found: ${nodeId}`);
  return node;
}

// --- Phase 1: Existing ---

export async function setFillColor(params: {
  nodeId: string; r: number; g: number; b: number; a?: number;
}) {
  const node = getNode(params.nodeId) as GeometryMixin & SceneNode;
  node.fills = [{ type: "SOLID", color: { r: params.r, g: params.g, b: params.b }, opacity: params.a ?? 1 }];
  return { id: params.nodeId, fills: node.fills };
}

export async function setStrokeColor(params: {
  nodeId: string; r: number; g: number; b: number; a?: number; weight?: number;
}) {
  const node = getNode(params.nodeId) as GeometryMixin & SceneNode;
  node.strokes = [{ type: "SOLID", color: { r: params.r, g: params.g, b: params.b }, opacity: params.a ?? 1 }];
  if (params.weight !== undefined) node.strokeWeight = params.weight;
  return { id: params.nodeId, strokes: node.strokes };
}

export async function setCornerRadius(params: {
  nodeId: string; radius: number;
  corners?: { topLeft?: number; topRight?: number; bottomRight?: number; bottomLeft?: number };
}) {
  const node = getNode(params.nodeId) as RectangleNode;
  if (params.corners) {
    node.topLeftRadius = params.corners.topLeft ?? params.radius;
    node.topRightRadius = params.corners.topRight ?? params.radius;
    node.bottomRightRadius = params.corners.bottomRight ?? params.radius;
    node.bottomLeftRadius = params.corners.bottomLeft ?? params.radius;
  } else {
    node.cornerRadius = params.radius;
  }
  return { id: params.nodeId, cornerRadius: node.cornerRadius };
}

// --- Phase 2: New style tools ---

export async function setEffect(params: {
  nodeId: string;
  effects: Array<{
    type: string; visible?: boolean;
    color?: { r: number; g: number; b: number; a: number };
    offset?: { x: number; y: number };
    radius?: number; spread?: number; blurRadius?: number;
  }>;
  append?: boolean;
}) {
  const node = getNode(params.nodeId) as SceneNode & BlendMixin;

  const newEffects: Effect[] = params.effects.map((e) => {
    if (e.type === "DROP_SHADOW" || e.type === "INNER_SHADOW") {
      return {
        type: e.type,
        visible: e.visible ?? true,
        color: e.color ?? { r: 0, g: 0, b: 0, a: 0.25 },
        offset: e.offset ?? { x: 0, y: 4 },
        radius: e.radius ?? 4,
        spread: e.spread ?? 0,
        blendMode: "NORMAL" as const,
      };
    }
    // LAYER_BLUR or BACKGROUND_BLUR
    return {
      type: e.type as "LAYER_BLUR" | "BACKGROUND_BLUR",
      visible: e.visible ?? true,
      radius: e.blurRadius ?? e.radius ?? 4,
    };
  });

  node.effects = params.append ? [...(node.effects || []), ...newEffects] : newEffects;
  return { id: params.nodeId, effectCount: node.effects.length };
}

export async function setGradient(params: {
  nodeId: string;
  gradient: {
    type: string;
    stops: Array<{ position: number; color: { r: number; g: number; b: number; a?: number } }>;
    startPoint?: { x: number; y: number };
    endPoint?: { x: number; y: number };
  };
}) {
  const node = getNode(params.nodeId) as GeometryMixin & SceneNode;
  const { gradient } = params;

  const gradientStops: ColorStop[] = gradient.stops.map((s) => ({
    position: s.position,
    color: { r: s.color.r, g: s.color.g, b: s.color.b, a: s.color.a ?? 1 },
  }));

  const start = gradient.startPoint ?? { x: 0, y: 0.5 };
  const end = gradient.endPoint ?? { x: 1, y: 0.5 };

  const gradientPaint: GradientPaint = {
    type: gradient.type as GradientPaint["type"],
    gradientStops,
    gradientTransform: [
      [end.x - start.x, start.y - end.y, start.x],
      [end.y - start.y, end.x - start.x, start.y],
    ],
  };

  node.fills = [gradientPaint];
  return { id: params.nodeId, type: gradient.type, stopCount: gradientStops.length };
}

export async function setImageFill(params: {
  nodeId: string; imageUrl: string;
  scaleMode?: "FILL" | "FIT" | "CROP" | "TILE";
}) {
  const node = getNode(params.nodeId) as GeometryMixin & SceneNode;

  const response = await fetch(params.imageUrl);
  const buffer = await response.arrayBuffer();
  const image = figma.createImage(new Uint8Array(buffer));

  node.fills = [{
    type: "IMAGE",
    imageHash: image.hash,
    scaleMode: params.scaleMode ?? "FILL",
  }];

  return { id: params.nodeId, imageHash: image.hash };
}

export async function setBlendMode(params: { nodeId: string; blendMode: string }) {
  const node = getNode(params.nodeId) as SceneNode & BlendMixin;
  node.blendMode = params.blendMode as BlendMode;
  return { id: params.nodeId, blendMode: node.blendMode };
}

export async function setOpacity(params: { nodeId: string; opacity: number }) {
  const node = getNode(params.nodeId) as SceneNode & BlendMixin;
  node.opacity = params.opacity;
  return { id: params.nodeId, opacity: node.opacity };
}

export async function setStrokeDetail(params: {
  nodeId: string;
  strokeWeight?: number; strokeAlign?: string;
  strokeCap?: string; strokeJoin?: string;
  dashPattern?: number[];
}) {
  const node = getNode(params.nodeId) as GeometryMixin & IndividualStrokesMixin & SceneNode;

  if (params.strokeWeight !== undefined) node.strokeWeight = params.strokeWeight;
  if (params.strokeAlign) node.strokeAlign = params.strokeAlign as "INSIDE" | "OUTSIDE" | "CENTER";
  if (params.strokeCap) node.strokeCap = params.strokeCap as StrokeCap;
  if (params.strokeJoin) node.strokeJoin = params.strokeJoin as StrokeJoin;
  if (params.dashPattern) node.dashPattern = params.dashPattern;

  return { id: params.nodeId, strokeWeight: node.strokeWeight };
}
