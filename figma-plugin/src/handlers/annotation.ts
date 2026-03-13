// Annotation handlers
import { requireNode } from "./_utils";

export async function getAnnotations(params: { nodeId?: string }) {
  const node = params.nodeId
    ? await requireNode<BaseNode>(params.nodeId)
    : figma.currentPage.selection[0];

  if (!node) throw new Error("No node selected");

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
  const node = await requireNode(params.nodeId);

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
  const node = await requireNode(params.nodeId);
  if (!("annotations" in node)) {
    return { nodeId: params.nodeId, count: 0 };
  }

  const ann = node as unknown as { annotations: unknown[] };
  let count = 0;

  for (const item of params.annotations) {
    try {
      const newAnnotation = {
        label: item.labelMarkdown,
        ...(item.categoryId ? { properties: { category: item.categoryId } } : {}),
      };
      ann.annotations = [...(ann.annotations || []), newAnnotation];
      count++;
    } catch {
      // skip failed annotation
    }
  }

  return { nodeId: params.nodeId, count };
}