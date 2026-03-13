// Shared Figma node lookup utilities for handler modules

/** Fetch a node by ID, throw if not found */
export async function requireNode<T extends BaseNode = SceneNode>(
  nodeId: string,
  label = "Node",
): Promise<T> {
  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node) throw new Error(`${label} not found: ${nodeId}`);
  return node as T;
}

/** Fetch a parent node by ID, or fall back to currentPage */
export async function requireParent(
  parentId?: string,
): Promise<FrameNode | PageNode | SectionNode> {
  if (parentId) {
    return requireNode<FrameNode>(parentId, "Parent");
  }
  return figma.currentPage;
}

/** Fetch a TextNode by ID, throw if not found or wrong type */
export async function requireTextNode(nodeId: string): Promise<TextNode> {
  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node || node.type !== "TEXT") throw new Error(`Text node not found: ${nodeId}`);
  return node as TextNode;
}

/** Resolve an array of node IDs to SceneNode[], skipping not-found */
export async function resolveSceneNodes(ids: string[]): Promise<SceneNode[]> {
  const nodes: SceneNode[] = [];
  for (const id of ids) {
    const n = await figma.getNodeByIdAsync(id);
    if (n !== null && "x" in n) nodes.push(n as SceneNode);
  }
  return nodes;
}
