// Annotation handlers

export async function getAnnotations(params: { nodeId?: string }) {
  const node = params.nodeId
    ? figma.getNodeById(params.nodeId)
    : figma.currentPage.selection[0];

  if (!node) throw new Error("No node found");

  if ("annotations" in node) {
    return {
      id: node.id,
      name: node.name,
      annotations: (node as SceneNode & { annotations: unknown[] }).annotations,
    };
  }

  return { id: node.id, name: node.name, annotations: [] };
}

export async function setAnnotation(params: {
  nodeId: string; labelMarkdown: string; categoryId?: string;
}) {
  const node = figma.getNodeById(params.nodeId) as SceneNode;
  if (!node) throw new Error(`Node not found: ${params.nodeId}`);

  // Annotations API
  if ("annotations" in node) {
    const ann = (node as unknown as { annotations: unknown[] });
    const newAnnotation = {
      label: params.labelMarkdown,
      ...(params.categoryId ? { properties: { category: params.categoryId } } : {}),
    };
    ann.annotations = [...(ann.annotations || []), newAnnotation];
  }

  return { id: node.id, success: true };
}

export async function setMultipleAnnotations(params: {
  nodeId: string;
  annotations: Array<{ labelMarkdown: string; categoryId?: string }>;
}) {
  const results: Array<{ success: boolean }> = [];

  for (const ann of params.annotations) {
    try {
      await setAnnotation({ nodeId: params.nodeId, ...ann });
      results.push({ success: true });
    } catch {
      results.push({ success: false });
    }
  }

  return { nodeId: params.nodeId, count: results.filter((r) => r.success).length };
}
