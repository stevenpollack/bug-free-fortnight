/**
 * Generates PNG icons from apps/web/public/icons/icon.svg using @resvg/resvg-js.
 * Run via: bun run build:icons (from apps/web)
 *
 * Output files:
 *   public/icons/icon-192.png      — standard 192×192 icon
 *   public/icons/icon-512.png      — standard 512×512 icon
 *   public/icons/icon-512-maskable.png — maskable 512×512 (same image; SVG has built-in padding)
 *   public/icons/apple-touch-icon.png  — 180×180 for iOS
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";

const root = join(import.meta.dir, "..");
const svgPath = join(root, "public", "icons", "icon.svg");
const outDir = join(root, "public", "icons");

const svgData = readFileSync(svgPath, "utf-8");

const sizes: Array<{ name: string; size: number }> = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "icon-512-maskable.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
];

for (const { name, size } of sizes) {
  const resvg = new Resvg(svgData, {
    fitTo: { mode: "width", value: size },
  });
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();
  const outPath = join(outDir, name);
  writeFileSync(outPath, pngBuffer);
  console.log(`✓ ${name} (${size}×${size})`);
}

console.log("Icons built successfully.");
