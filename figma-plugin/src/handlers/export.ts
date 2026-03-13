// Export & Prototype handlers
import { requireNode } from "./_utils";

export async function exportNodeAsImage(params: {
  nodeId: string; format?: string; scale?: number;
}) {
  const node = await requireNode(params.nodeId);

  const format = (params.format?.toUpperCase() ?? "PNG") as "PNG" | "JPG" | "SVG" | "PDF";
  const scale = params.scale ?? 2;

  const bytes = await node.exportAsync({
    format,
    ...(format !== "SVG" && format !== "PDF" ? { constraint: { type: "SCALE", value: scale } } : {}),
  });

  // Convert to base64
  const base64 = figma.base64Encode(bytes);

  return {
    id: node.id,
    name: node.name,
    format,
    scale,
    size: bytes.byteLength,
    data: base64,
  };
}

export async function getReactions(params: { nodeIds: string[] }) {
  const results: Array<{ id: string; reactions: unknown[] }> = [];

  for (const nodeId of params.nodeIds) {
    const node = await figma.getNodeByIdAsync(nodeId) as SceneNode;
    if (node && "reactions" in node) {
      results.push({
        id: node.id,
        reactions: (node as SceneNode & { reactions: unknown[] }).reactions,
      });
    }
  }

  return { nodes: results };
}

export async function setDefaultConnector(params: { connectorId: string }) {
  const node = await requireNode<ConnectorNode>(params.connectorId, "Connector");
  if (node.type !== "CONNECTOR") throw new Error("Connector not found");
  return { id: node.id, name: node.name };
}

export async function createConnections(params: {
  connections: Array<{
    startNodeId: string; endNodeId: string; text?: string;
  }>;
}) {
  const results: Array<{ id: string; startId: string; endId: string }> = [];

  for (const conn of params.connections) {
    const start = await figma.getNodeByIdAsync(conn.startNodeId) as SceneNode;
    const end = await figma.getNodeByIdAsync(conn.endNodeId) as SceneNode;
    if (!start || !end) continue;

    const connector = figma.createConnector();
    connector.connectorStart = { endpointNodeId: start.id, magnet: "AUTO" };
    connector.connectorEnd = { endpointNodeId: end.id, magnet: "AUTO" };

    if (conn.text) {
      connector.text.characters = conn.text;
    }

    results.push({ id: connector.id, startId: start.id, endId: end.id });
  }

  return { created: results.length, connections: results };
}