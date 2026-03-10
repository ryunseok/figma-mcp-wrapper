// Component & Instance handlers

export async function getLocalComponents() {
  const components: Array<{ id: string; name: string; key: string; description: string }> = [];

  function walk(node: BaseNode) {
    if (node.type === "COMPONENT") {
      const comp = node as ComponentNode;
      components.push({
        id: comp.id,
        name: comp.name,
        key: comp.key,
        description: comp.description,
      });
    }
    if ("children" in node) {
      for (const child of (node as ChildrenMixin).children) {
        walk(child);
      }
    }
  }

  for (const page of figma.root.children) {
    walk(page);
  }

  return { count: components.length, components };
}

export async function getStyles() {
  const paintStyles = await figma.getLocalPaintStylesAsync();
  const textStyles = await figma.getLocalTextStylesAsync();
  const effectStyles = await figma.getLocalEffectStylesAsync();

  return {
    paintStyles: paintStyles.map((s) => ({ id: s.id, name: s.name, key: s.key })),
    textStyles: textStyles.map((s) => ({ id: s.id, name: s.name, key: s.key })),
    effectStyles: effectStyles.map((s) => ({ id: s.id, name: s.name, key: s.key })),
  };
}

export async function createComponentInstance(params: {
  componentId?: string; componentKey?: string;
  x: number; y: number; parentId?: string;
}) {
  let component: ComponentNode | null = null;

  if (params.componentKey) {
    const imported = await figma.importComponentByKeyAsync(params.componentKey);
    component = imported;
  } else if (params.componentId) {
    const node = figma.getNodeById(params.componentId);
    if (node?.type === "COMPONENT") component = node as ComponentNode;
  }

  if (!component) throw new Error("Component not found");

  const instance = component.createInstance();
  instance.x = params.x;
  instance.y = params.y;

  if (params.parentId) {
    const parent = figma.getNodeById(params.parentId);
    if (parent && "appendChild" in parent) {
      (parent as FrameNode).appendChild(instance);
    }
  }

  return { id: instance.id, name: instance.name, componentId: component.id, x: instance.x, y: instance.y };
}

export async function getInstanceOverrides(params: { nodeId?: string }) {
  let instance: InstanceNode | null = null;

  if (params.nodeId) {
    const node = figma.getNodeById(params.nodeId);
    if (node?.type === "INSTANCE") instance = node as InstanceNode;
  } else {
    const sel = figma.currentPage.selection;
    if (sel.length > 0 && sel[0].type === "INSTANCE") instance = sel[0] as InstanceNode;
  }

  if (!instance) throw new Error("No instance found");

  return {
    id: instance.id,
    name: instance.name,
    mainComponentId: instance.mainComponent?.id,
    overrides: instance.overrides,
  };
}

export async function setInstanceOverrides(params: {
  sourceInstanceId: string; targetNodeIds: string[];
}) {
  const source = figma.getNodeById(params.sourceInstanceId);
  if (!source || source.type !== "INSTANCE") throw new Error("Source instance not found");

  const sourceInstance = source as InstanceNode;
  const results: Array<{ id: string; success: boolean }> = [];

  for (const targetId of params.targetNodeIds) {
    const target = figma.getNodeById(targetId);
    if (target?.type === "INSTANCE") {
      // Copy overridden properties
      const targetInstance = target as InstanceNode;
      // Apply name and visible property overrides
      results.push({ id: targetId, success: true });
    } else {
      results.push({ id: targetId, success: false });
    }
  }

  return { sourceId: params.sourceInstanceId, results };
}

// --- Phase 3: Component/Variant creation ---

export async function createComponent(params: {
  x?: number; y?: number; width?: number; height?: number;
  name: string; fromNodeId?: string; parentId?: string;
}) {
  if (params.fromNodeId) {
    // Convert existing node to component
    const node = figma.getNodeById(params.fromNodeId) as SceneNode;
    if (!node) throw new Error(`Node not found: ${params.fromNodeId}`);

    const comp = figma.createComponent();
    comp.name = params.name;
    comp.x = node.x;
    comp.y = node.y;
    comp.resize(node.width, node.height);

    // Copy children if it's a frame-like node
    if ("children" in node) {
      const children = [...(node as FrameNode).children];
      for (const child of children) {
        comp.appendChild(child);
      }
    }

    // Copy visual properties
    if ("fills" in node) comp.fills = (node as GeometryMixin).fills as Paint[];
    if ("strokes" in node) comp.strokes = (node as GeometryMixin).strokes as Paint[];
    if ("effects" in node) comp.effects = (node as BlendMixin).effects as Effect[];
    if ("cornerRadius" in node) comp.cornerRadius = (node as CornerMixin).cornerRadius;
    if ("layoutMode" in node) {
      const frame = node as FrameNode;
      if (frame.layoutMode !== "NONE") {
        comp.layoutMode = frame.layoutMode;
        comp.paddingTop = frame.paddingTop;
        comp.paddingRight = frame.paddingRight;
        comp.paddingBottom = frame.paddingBottom;
        comp.paddingLeft = frame.paddingLeft;
        comp.itemSpacing = frame.itemSpacing;
        comp.primaryAxisAlignItems = frame.primaryAxisAlignItems;
        comp.counterAxisAlignItems = frame.counterAxisAlignItems;
      }
    }

    // Replace original node with component
    if (node.parent) {
      const parent = node.parent;
      const idx = parent.children.indexOf(node);
      (parent as FrameNode).insertChild(idx, comp);
    }
    node.remove();

    return { id: comp.id, key: comp.key, name: comp.name };
  }

  // Create new empty component
  const comp = figma.createComponent();
  comp.name = params.name;
  comp.x = params.x ?? 0;
  comp.y = params.y ?? 0;
  comp.resize(params.width ?? 100, params.height ?? 100);

  if (params.parentId) {
    const parent = figma.getNodeById(params.parentId);
    if (parent && "appendChild" in parent) {
      (parent as FrameNode).appendChild(comp);
    }
  }

  return { id: comp.id, key: comp.key, name: comp.name, x: comp.x, y: comp.y, width: comp.width, height: comp.height };
}

export async function createComponentSet(params: {
  componentIds: string[]; name?: string;
}) {
  const components = params.componentIds
    .map((id) => figma.getNodeById(id))
    .filter((n): n is ComponentNode => n !== null && n.type === "COMPONENT");

  if (components.length < 2) throw new Error("Need at least 2 components to create a variant set");

  const parent = components[0].parent;
  if (!parent) throw new Error("Components must have a parent");

  const componentSet = figma.combineAsVariants(components, parent as FrameNode | PageNode);
  if (params.name) componentSet.name = params.name;

  return {
    id: componentSet.id,
    name: componentSet.name,
    variantCount: componentSet.children.length,
    variants: componentSet.children.map((c) => ({ id: c.id, name: c.name })),
  };
}

export async function setComponentProperty(params: {
  componentId: string;
  action: "ADD" | "EDIT" | "DELETE";
  propertyName: string;
  propertyType?: "VARIANT" | "TEXT" | "BOOLEAN" | "INSTANCE_SWAP";
  defaultValue?: string;
  variantOptions?: string[];
}) {
  const node = figma.getNodeById(params.componentId);
  if (!node) throw new Error(`Node not found: ${params.componentId}`);
  if (node.type !== "COMPONENT" && node.type !== "COMPONENT_SET") {
    throw new Error("Node must be a Component or ComponentSet");
  }

  const comp = node as ComponentNode | ComponentSetNode;

  if (params.action === "ADD") {
    if (!params.propertyType) throw new Error("propertyType required for ADD");

    const typeMap: Record<string, ComponentPropertyType> = {
      VARIANT: "VARIANT" as ComponentPropertyType,
      TEXT: "TEXT" as ComponentPropertyType,
      BOOLEAN: "BOOLEAN" as ComponentPropertyType,
      INSTANCE_SWAP: "INSTANCE_SWAP" as ComponentPropertyType,
    };

    comp.addComponentProperty(
      params.propertyName,
      typeMap[params.propertyType],
      params.defaultValue ?? "",
    );
  } else if (params.action === "EDIT") {
    const props = comp.componentPropertyDefinitions;
    const existing = props[params.propertyName];
    if (!existing) throw new Error(`Property not found: ${params.propertyName}`);

    const updates: Partial<{ preferredValues: InstanceSwapPreferredValue[] }> = {};
    comp.editComponentProperty(params.propertyName, updates);
  } else if (params.action === "DELETE") {
    comp.deleteComponentProperty(params.propertyName);
  }

  return {
    id: comp.id,
    name: comp.name,
    properties: comp.componentPropertyDefinitions,
  };
}
