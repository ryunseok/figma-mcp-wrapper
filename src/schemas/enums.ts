import { z } from "zod";

// ── Layout ──────────────────────────────────────────
export const LayoutMode = z.enum(["HORIZONTAL", "VERTICAL", "NONE"]);
export const LayoutSizing = z.enum(["FIXED", "HUG", "FILL"]);
export const PrimaryAxisAlign = z.enum(["MIN", "CENTER", "MAX", "SPACE_BETWEEN"]);
export const CounterAxisAlign = z.enum(["MIN", "CENTER", "MAX", "BASELINE"]);

// ── Text ────────────────────────────────────────────
export const TextDecoration = z.enum(["NONE", "UNDERLINE", "STRIKETHROUGH"]);
export const SpacingUnit = z.enum(["PIXELS", "PERCENT"]);

// ── Image Export ────────────────────────────────────
/** Plugin API — uppercase (Figma Plugin API spec) */
export const ImageFormatPlugin = z.enum(["PNG", "JPG", "SVG", "PDF"]);
/** REST API — lowercase (Figma REST API spec) */
export const ImageFormatRest = z.enum(["png", "jpg", "svg", "pdf"]);

// ── CRUD ────────────────────────────────────────────
export const CrudAction = z.enum(["CREATE", "UPDATE", "DELETE"]);
