// Figma MCP Wrapper Plugin — Main entry point
// Command router: receives commands from WebSocket (via ui.html) and executes Figma API calls

import {
  getDocumentInfo, getSelection, readMyDesign, getNodeInfo,
  setFocus, setSelections, scanNodesByTypes,
} from "./handlers/document";

import {
  createRectangle, createFrame, createText, moveNode, resizeNode,
  cloneNode, deleteNode, deleteMultipleNodes,
  createEllipse, createLine, createPolygon, createStar,
  createVector, createGroup, createSection, reorderChild,
  booleanOperation,
} from "./handlers/node";

import {
  setFillColor, setStrokeColor, setCornerRadius,
  setEffect, setGradient, setImageFill, setBlendMode, setOpacity, setStrokeDetail,
} from "./handlers/style";

import {
  scanTextNodes, setTextContent, setMultipleTextContents,
  setTextStyle, setTextRangeStyle,
} from "./handlers/text";

import {
  setLayoutMode, setPadding, setAxisAlign, setLayoutSizing, setItemSpacing,
  setConstraints, setGrid,
} from "./handlers/layout";

import {
  getLocalComponents, getStyles, createComponentInstance,
  getInstanceOverrides, setInstanceOverrides,
  createComponent, createComponentSet, setComponentProperty,
} from "./handlers/component";

import {
  getAnnotations, setAnnotation, setMultipleAnnotations,
} from "./handlers/annotation";

import {
  bindVariable, unbindVariable,
} from "./handlers/variable";

import {
  exportNodeAsImage, getReactions, setDefaultConnector, createConnections,
} from "./handlers/export";

// Show plugin UI (WebSocket client)
figma.showUI(__html__, { width: 300, height: 400, visible: true });

// Command → handler mapping
const commands: Record<string, (params: Record<string, unknown>) => Promise<unknown>> = {
  // Document (7)
  get_document_info: () => getDocumentInfo(),
  get_selection: () => getSelection(),
  read_my_design: () => readMyDesign(),
  get_node_info: (p) => getNodeInfo(p as any),
  set_focus: (p) => setFocus(p as any),
  set_selections: (p) => setSelections(p as any),
  scan_nodes_by_types: (p) => scanNodesByTypes(p as any),

  // Node — Phase 1 (10)
  create_rectangle: (p) => createRectangle(p as any),
  create_frame: (p) => createFrame(p as any),
  create_text: (p) => createText(p as any),
  move_node: (p) => moveNode(p as any),
  resize_node: (p) => resizeNode(p as any),
  clone_node: (p) => cloneNode(p as any),
  delete_node: (p) => deleteNode(p as any),
  delete_multiple_nodes: (p) => deleteMultipleNodes(p as any),

  // Node — Phase 2 (7)
  create_ellipse: (p) => createEllipse(p as any),
  create_line: (p) => createLine(p as any),
  create_polygon: (p) => createPolygon(p as any),
  create_star: (p) => createStar(p as any),
  create_vector: (p) => createVector(p as any),
  create_group: (p) => createGroup(p as any),
  create_section: (p) => createSection(p as any),
  reorder_child: (p) => reorderChild(p as any),

  // Style — Phase 1 (3)
  set_fill_color: (p) => setFillColor(p as any),
  set_stroke_color: (p) => setStrokeColor(p as any),
  set_corner_radius: (p) => setCornerRadius(p as any),

  // Style — Phase 2 (6)
  set_effect: (p) => setEffect(p as any),
  set_gradient: (p) => setGradient(p as any),
  set_image_fill: (p) => setImageFill(p as any),
  set_blend_mode: (p) => setBlendMode(p as any),
  set_opacity: (p) => setOpacity(p as any),
  set_stroke_detail: (p) => setStrokeDetail(p as any),

  // Text — Phase 1 (3)
  scan_text_nodes: (p) => scanTextNodes(p as any),
  set_text_content: (p) => setTextContent(p as any),
  set_multiple_text_contents: (p) => setMultipleTextContents(p as any),

  // Text — Phase 2 (2)
  set_text_style: (p) => setTextStyle(p as any),
  set_text_range_style: (p) => setTextRangeStyle(p as any),

  // Layout — Phase 1 (5)
  set_layout_mode: (p) => setLayoutMode(p as any),
  set_padding: (p) => setPadding(p as any),
  set_axis_align: (p) => setAxisAlign(p as any),
  set_layout_sizing: (p) => setLayoutSizing(p as any),
  set_item_spacing: (p) => setItemSpacing(p as any),

  // Layout — Phase 2 (2)
  set_constraints: (p) => setConstraints(p as any),
  set_grid: (p) => setGrid(p as any),

  // Node — Phase 3 (1)
  boolean_operation: (p) => booleanOperation(p as any),

  // Component — Phase 1 (5)
  get_local_components: () => getLocalComponents(),
  get_styles: () => getStyles(),
  create_component_instance: (p) => createComponentInstance(p as any),
  get_instance_overrides: (p) => getInstanceOverrides(p as any),
  set_instance_overrides: (p) => setInstanceOverrides(p as any),

  // Component — Phase 3 (3)
  create_component: (p) => createComponent(p as any),
  create_component_set: (p) => createComponentSet(p as any),
  set_component_property: (p) => setComponentProperty(p as any),

  // Variable — Phase 3 (2)
  bind_variable: (p) => bindVariable(p as any),
  unbind_variable: (p) => unbindVariable(p as any),

  // Annotation (3)
  get_annotations: (p) => getAnnotations(p as any),
  set_annotation: (p) => setAnnotation(p as any),
  set_multiple_annotations: (p) => setMultipleAnnotations(p as any),

  // Export & Prototype (4)
  export_node_as_image: (p) => exportNodeAsImage(p as any),
  get_reactions: (p) => getReactions(p as any),
  set_default_connector: (p) => setDefaultConnector(p as any),
  create_connections: (p) => createConnections(p as any),
};

// batch_execute: runs multiple commands sequentially within a single plugin message round-trip
commands.batch_execute = async (params: Record<string, unknown>) => {
  const cmds = params.commands as Array<{ command: string; params: Record<string, unknown> }>;
  if (!cmds || !Array.isArray(cmds)) throw new Error("commands array required");

  const results: Array<{ command: string; result?: unknown; error?: string }> = [];
  for (const cmd of cmds) {
    const handler = commands[cmd.command];
    if (!handler) {
      results.push({ command: cmd.command, error: `Unknown command: ${cmd.command}` });
      continue;
    }
    try {
      const result = await handler(cmd.params || {});
      results.push({ command: cmd.command, result });
    } catch (err) {
      results.push({ command: cmd.command, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return { totalCount: cmds.length, successCount: results.filter((r) => !r.error).length, results };
};

// Message handler — receives commands from ui.html (WebSocket)
figma.ui.onmessage = async (msg: { id?: string; command: string; params: Record<string, unknown>; commandId?: string }) => {
  const { command, params } = msg;
  const commandId = msg.id || msg.commandId || (params?.commandId as string);

  const handler = commands[command];
  if (!handler) {
    figma.ui.postMessage({
      type: "result",
      id: commandId,
      result: null,
      error: `Unknown command: ${command}`,
    });
    return;
  }

  try {
    const result = await handler(params || {});
    figma.ui.postMessage({
      type: "result",
      id: commandId,
      result,
      error: null,
    });
  } catch (err) {
    figma.ui.postMessage({
      type: "result",
      id: commandId,
      result: null,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
