// MAGAS7 brand constants for the X post cards — copied from devmarketing's
// deployed config (src/projects.ts @ ef1d584) so the studio's X posts match the
// deploy cards the team sees on WhatsApp. If the brand shifts there, mirror it here.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { BrandOverlay } from "./compose.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Style guard prepended to every background prompt. Verbatim from devmarketing. */
export const MAGAS7_IMAGE_STYLE =
  "Cinematic product-launch key visual on a deep void-black background. " +
  "ONE single physical object as the subject, sleek glass and metal, glowing vivid signal green with subtle violet and cyan rim light, " +
  "standing alone in darkness, a faint fine hairline grid on the floor fading into black, soft volumetric glow, " +
  "terminal-age high-tech elegance, ultra clean, photographic depth of field. " +
  "Composition pushed to the right third of the frame, generous empty negative space on the left half. Wide 16:9. " +
  "Absolutely no text, no words, no letters, no logos, no watermarks, no UI panels, no charts, no robots, no humanoids. ";

const logoCache = new Map<string, string | undefined>();

/**
 * The same PNG devmarketing composites onto the WhatsApp cards, shipped in this
 * repo at assets/magas7-logo.png. Fallback paths: an env override, then the
 * studio web dir (`${STUDIO_OUTPUT_DIR}/brand/`). A missing logo degrades to
 * the MAGAS7.COM wordmark — a degraded card must never cost us the post.
 */
export function loadLogoBase64(outDir: string): string | undefined {
  const candidates = [
    process.env.MAGAS7_LOGO_PATH,
    path.join(REPO_ROOT, "assets", "magas7-logo.png"),
    path.join(outDir, "brand", "magas7-logo.png"),
  ].filter((p): p is string => !!p);

  for (const file of candidates) {
    if (logoCache.has(file)) {
      const hit = logoCache.get(file);
      if (hit) return hit;
      continue;
    }
    try {
      const value = readFileSync(file).toString("base64");
      logoCache.set(file, value);
      return value;
    } catch {
      logoCache.set(file, undefined);
    }
  }
  return undefined;
}

export function magas7Overlay(outDir: string): BrandOverlay {
  return {
    gradient: ["#b1ff5a", "#6cf0ff", "#9d6cff"],
    urlLabel: "magas7.com",
    tagline: "Marketing agents · On standby",
    stamp: "On air",
    accent: "#b1ff5a",
    logoBase64: loadLogoBase64(outDir),
  };
}
