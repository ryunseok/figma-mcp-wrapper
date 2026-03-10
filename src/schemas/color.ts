import { z } from "zod";

/** RGBA color — alpha optional (most color parameters) */
export const ColorRGBA = z.object({
  r: z.number(),
  g: z.number(),
  b: z.number(),
  a: z.number().optional(),
});

/** RGBA color — alpha required (shadow color, grid color) */
export const ColorFull = z.object({
  r: z.number(),
  g: z.number(),
  b: z.number(),
  a: z.number(),
});

/** RGB color — no alpha (section fill) */
export const ColorRGB = z.object({
  r: z.number(),
  g: z.number(),
  b: z.number(),
});
