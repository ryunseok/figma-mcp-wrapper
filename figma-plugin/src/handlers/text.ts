// Text handlers — Phase 1 (existing) + Phase 2 (text styling)

// --- Phase 1: Existing ---

export async function scanTextNodes(params: { nodeId: string; useChunking?: boolean; chunkSize?: number }) {
  const parent = figma.getNodeById(params.nodeId);
  if (!parent) throw new Error(`Node not found: ${params.nodeId}`);

  const textNodes: Array<{ id: string; name: string; characters: string }> = [];

  function walk(node: BaseNode) {
    if (node.type === "TEXT") {
      const t = node as TextNode;
      textNodes.push({ id: t.id, name: t.name, characters: t.characters });
    }
    if ("children" in node) {
      for (const child of (node as ChildrenMixin).children) {
        walk(child);
      }
    }
  }

  walk(parent);
  return { count: textNodes.length, textNodes };
}

export async function setTextContent(params: { nodeId: string; text: string }) {
  const node = figma.getNodeById(params.nodeId) as TextNode;
  if (!node || node.type !== "TEXT") throw new Error(`Text node not found: ${params.nodeId}`);

  // Load all fonts used in the text node
  const fonts = node.getRangeAllFontNames(0, node.characters.length);
  for (const font of fonts) {
    await figma.loadFontAsync(font);
  }

  node.characters = params.text;
  return { id: node.id, characters: node.characters };
}

export async function setMultipleTextContents(params: {
  nodeId: string;
  text: Array<{ nodeId: string; text: string }>;
}) {
  const results: Array<{ id: string; success: boolean; error?: string }> = [];

  for (const item of params.text) {
    try {
      const node = figma.getNodeById(item.nodeId) as TextNode;
      if (!node || node.type !== "TEXT") throw new Error("Not a text node");

      const fonts = node.getRangeAllFontNames(0, node.characters.length);
      for (const font of fonts) {
        await figma.loadFontAsync(font);
      }

      node.characters = item.text;
      results.push({ id: item.nodeId, success: true });
    } catch (e) {
      results.push({ id: item.nodeId, success: false, error: (e as Error).message });
    }
  }

  return { updatedCount: results.filter((r) => r.success).length, results };
}

// --- Phase 2: Text styling ---

export async function setTextStyle(params: {
  nodeId: string;
  fontFamily?: string; fontStyle?: string; fontSize?: number;
  lineHeight?: { value: number; unit: string } | "AUTO";
  letterSpacing?: { value: number; unit: string };
  textAlignHorizontal?: string; textAlignVertical?: string;
  textDecoration?: string; textCase?: string;
  color?: { r: number; g: number; b: number; a?: number };
}) {
  const node = figma.getNodeById(params.nodeId) as TextNode;
  if (!node || node.type !== "TEXT") throw new Error(`Text node not found: ${params.nodeId}`);

  const family = params.fontFamily ?? "Inter";
  const style = params.fontStyle ?? "Regular";
  await figma.loadFontAsync({ family, style });

  if (params.fontFamily || params.fontStyle) {
    node.fontName = { family, style };
  }
  if (params.fontSize !== undefined) node.fontSize = params.fontSize;

  if (params.lineHeight !== undefined) {
    if (params.lineHeight === "AUTO") {
      node.lineHeight = { unit: "AUTO" };
    } else {
      node.lineHeight = {
        value: params.lineHeight.value,
        unit: params.lineHeight.unit as "PIXELS" | "PERCENT",
      };
    }
  }

  if (params.letterSpacing) {
    node.letterSpacing = {
      value: params.letterSpacing.value,
      unit: params.letterSpacing.unit as "PIXELS" | "PERCENT",
    };
  }

  if (params.textAlignHorizontal) {
    node.textAlignHorizontal = params.textAlignHorizontal as "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED";
  }
  if (params.textAlignVertical) {
    node.textAlignVertical = params.textAlignVertical as "TOP" | "CENTER" | "BOTTOM";
  }
  if (params.textDecoration) {
    node.textDecoration = params.textDecoration as "NONE" | "UNDERLINE" | "STRIKETHROUGH";
  }
  if (params.textCase) {
    node.textCase = params.textCase as "ORIGINAL" | "UPPER" | "LOWER" | "TITLE";
  }
  if (params.color) {
    const { r, g, b, a } = params.color;
    node.fills = [{ type: "SOLID", color: { r, g, b }, opacity: a ?? 1 }];
  }

  return { id: node.id, fontName: node.fontName, fontSize: node.fontSize };
}

export async function setTextRangeStyle(params: {
  nodeId: string; start: number; end: number;
  fontFamily?: string; fontStyle?: string; fontSize?: number;
  color?: { r: number; g: number; b: number; a?: number };
  textDecoration?: string;
}) {
  const node = figma.getNodeById(params.nodeId) as TextNode;
  if (!node || node.type !== "TEXT") throw new Error(`Text node not found: ${params.nodeId}`);

  const family = params.fontFamily ?? "Inter";
  const style = params.fontStyle ?? "Regular";

  if (params.fontFamily || params.fontStyle) {
    await figma.loadFontAsync({ family, style });
    node.setRangeFontName(params.start, params.end, { family, style });
  }
  if (params.fontSize !== undefined) {
    node.setRangeFontSize(params.start, params.end, params.fontSize);
  }
  if (params.color) {
    const { r, g, b, a } = params.color;
    node.setRangeFills(params.start, params.end, [
      { type: "SOLID", color: { r, g, b }, opacity: a ?? 1 },
    ]);
  }
  if (params.textDecoration) {
    node.setRangeTextDecoration(params.start, params.end, params.textDecoration as "NONE" | "UNDERLINE" | "STRIKETHROUGH");
  }

  return { id: node.id, range: { start: params.start, end: params.end } };
}
