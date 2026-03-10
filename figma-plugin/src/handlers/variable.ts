// Variable binding handlers — Phase 3

export async function bindVariable(params: {
  nodeId: string;
  property: string;
  variableId: string;
  fillIndex?: number;
}) {
  const node = figma.getNodeById(params.nodeId) as SceneNode;
  if (!node) throw new Error(`Node not found: ${params.nodeId}`);

  const variable = await figma.variables.getVariableByIdAsync(params.variableId);
  if (!variable) throw new Error(`Variable not found: ${params.variableId}`);

  const prop = params.property;

  // Handle fill/stroke binding (needs array index)
  if ((prop === "fills" || prop === "strokes") && "setBoundVariable" in node) {
    const idx = params.fillIndex ?? 0;
    const arr = prop === "fills"
      ? (node as GeometryMixin).fills as Paint[]
      : (node as GeometryMixin).strokes as Paint[];

    if (arr && arr.length > idx) {
      const paint = { ...arr[idx] } as SolidPaint;
      paint.boundVariables = {
        ...paint.boundVariables,
        color: { type: "VARIABLE_ALIAS", id: variable.id },
      };
      const newArr = [...arr];
      newArr[idx] = paint;
      if (prop === "fills") {
        (node as GeometryMixin).fills = newArr;
      } else {
        (node as GeometryMixin).strokes = newArr;
      }
    }
  } else if ("setBoundVariable" in node) {
    // Direct property binding (opacity, width, padding, etc.)
    (node as SceneNode).setBoundVariable(prop as VariableBindableNodeField, variable);
  } else {
    throw new Error(`Node does not support variable binding`);
  }

  return {
    id: node.id,
    name: node.name,
    property: prop,
    variableId: variable.id,
    variableName: variable.name,
  };
}

export async function unbindVariable(params: {
  nodeId: string;
  property: string;
}) {
  const node = figma.getNodeById(params.nodeId) as SceneNode;
  if (!node) throw new Error(`Node not found: ${params.nodeId}`);

  if ("setBoundVariable" in node) {
    (node as SceneNode).setBoundVariable(params.property as VariableBindableNodeField, null);
  } else {
    throw new Error(`Node does not support variable binding`);
  }

  return { id: node.id, name: node.name, property: params.property, unbound: true };
}
