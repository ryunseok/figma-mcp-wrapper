// Annotation
import {
  getAnnotationsTool,
  setAnnotationTool,
  setMultipleAnnotationsTool,
} from "./annotation/index.js";
// Batch (Phase 3)
import { batchExecuteTool } from "./batch/index.js";
// Component (Phase 1 + Phase 3)
import {
  createComponentSetTool,
  // Phase 3
  createComponentTool,
  createInstanceTool,
  getInstanceOverridesTool,
  getLocalComponentsTool,
  getStylesTool,
  setComponentPropertyTool,
  setInstanceOverridesTool,
} from "./component/index.js";
// Connection
import { joinChannelTool } from "./connection/join-channel.js";
// Document
import {
  getDocumentInfoTool,
  getSelectionTool,
  readDesignTool,
  scanNodesByTypesTool,
  setFocusTool,
  setSelectionsTool,
} from "./document/index.js";
// Export & Connections
import {
  createConnectionsTool,
  exportNodeTool,
  getReactionsTool,
  setDefaultConnectorTool,
} from "./export/index.js";

// Layout (Phase 1 + Phase 2)
import {
  setAxisAlignTool,
  // Phase 2
  setConstraintsTool,
  setGridTool,
  setItemSpacingTool,
  setLayoutModeTool,
  setLayoutSizingTool,
  setPaddingTool,
} from "./layout/index.js";
// Node (Phase 1 + Phase 2 + Phase 3)
import {
  // Phase 3
  booleanOperationTool,
  cloneNodeTool,
  // Phase 2
  createEllipseTool,
  createFrameTool,
  createGroupTool,
  createLineTool,
  createPolygonTool,
  createRectangleTool,
  createSectionTool,
  createStarTool,
  createTextTool,
  createVectorTool,
  deleteMultipleNodesTool,
  deleteNodeTool,
  getNodeInfoTool,
  getNodesInfoTool,
  moveNodeTool,
  reorderChildTool,
  resizeNodeTool,
} from "./node/index.js";
// REST API (Phase 1 + Phase 3)
import {
  getFileComponentsTool,
  getFileNodesTool,
  getFileStylesTool,
  getFileTool,
  getImagesTool,
  getPublishedVariablesTool,
  // Phase 3
  getVariablesTool,
  setVariablesTool,
} from "./rest/index.js";
// Style (Phase 1 + Phase 2)
import {
  setBlendModeTool,
  setCornerRadiusTool,
  // Phase 2
  setEffectTool,
  setFillColorTool,
  setGradientTool,
  setImageFillTool,
  setOpacityTool,
  setStrokeColorTool,
  setStrokeDetailTool,
} from "./style/index.js";
// Text (Phase 1 + Phase 2)
import {
  scanTextNodesTool,
  setMultipleTextContentsTool,
  setTextContentTool,
  setTextRangeStyleTool,
  // Phase 2
  setTextStyleTool,
} from "./text/index.js";
import type { ToolDefinition } from "./types.js";
// Variable (Phase 3 — Plugin)
import { getLocalVariablesTool, bindVariableTool, unbindVariableTool } from "./variable/index.js";

/** All registered tools */
export const allTools: ToolDefinition[] = [
  // Connection (1)
  joinChannelTool,

  // Document (6)
  getDocumentInfoTool,
  getSelectionTool,
  readDesignTool,
  scanNodesByTypesTool,
  setFocusTool,
  setSelectionsTool,

  // Node — Phase 1 (10)
  getNodeInfoTool,
  getNodesInfoTool,
  createRectangleTool,
  createFrameTool,
  createTextTool,
  moveNodeTool,
  resizeNodeTool,
  cloneNodeTool,
  deleteNodeTool,
  deleteMultipleNodesTool,

  // Node — Phase 2 (8)
  createEllipseTool,
  createLineTool,
  createPolygonTool,
  createStarTool,
  createVectorTool,
  createGroupTool,
  createSectionTool,
  reorderChildTool,

  // Node — Phase 3 (1)
  booleanOperationTool,

  // Style — Phase 1 (3)
  setFillColorTool,
  setStrokeColorTool,
  setCornerRadiusTool,

  // Style — Phase 2 (6)
  setEffectTool,
  setGradientTool,
  setImageFillTool,
  setBlendModeTool,
  setOpacityTool,
  setStrokeDetailTool,

  // Text — Phase 1 (3)
  scanTextNodesTool,
  setTextContentTool,
  setMultipleTextContentsTool,

  // Text — Phase 2 (2)
  setTextStyleTool,
  setTextRangeStyleTool,

  // Layout — Phase 1 (5)
  setLayoutModeTool,
  setPaddingTool,
  setAxisAlignTool,
  setLayoutSizingTool,
  setItemSpacingTool,

  // Layout — Phase 2 (2)
  setConstraintsTool,
  setGridTool,

  // Component — Phase 1 (5)
  getLocalComponentsTool,
  getStylesTool,
  createInstanceTool,
  getInstanceOverridesTool,
  setInstanceOverridesTool,

  // Component — Phase 3 (3)
  createComponentTool,
  createComponentSetTool,
  setComponentPropertyTool,

  // Annotation (3)
  getAnnotationsTool,
  setAnnotationTool,
  setMultipleAnnotationsTool,

  // Export & Connections (4)
  exportNodeTool,
  getReactionsTool,
  setDefaultConnectorTool,
  createConnectionsTool,

  // Variable — Phase 3 Plugin (3)
  getLocalVariablesTool,
  bindVariableTool,
  unbindVariableTool,

  // Batch — Phase 3 (1)
  batchExecuteTool,

  // REST API — Phase 1 (5)
  getFileTool,
  getFileNodesTool,
  getFileComponentsTool,
  getFileStylesTool,
  getImagesTool,

  // REST API — Phase 3 Variables (3)
  getVariablesTool,
  getPublishedVariablesTool,
  setVariablesTool,
];

/**
 * 읽기 전용 도구 세트 (READ_ONLY=1, LRD-4670) — 원격 배포 인스턴스용.
 *
 * REST 조회 5종만. 플러그인(WS 채널) 의존 도구는 조회 계열(get_node_info, scan_* 등)이라도
 * 원격에 Figma Desktop 플러그인이 없어 동작 불가이므로 제외한다 — 광고되지만 작동하지 않는
 * 도구를 남기지 않는다. Variables REST(get_variables 등)는 Enterprise 플랜 전용이라 제외.
 */
export const readOnlyTools: ToolDefinition[] = [
  getFileTool,
  getFileNodesTool,
  getFileComponentsTool,
  getFileStylesTool,
  getImagesTool,
];
