// Render one poster card locally without posting anywhere.
//
//   npm run preview-card -- --out /tmp/card.png [--no-image] [--post]
//
// --no-image skips the OpenRouter background (uses a flat void-black canvas) so
// the typography composite can be checked without an API key.
// --post additionally posts the finished card to X (real tweet — use once, to
// verify the pipeline end to end).
import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";

import { generateCardImage, isCardImageAvailable, writeCardCopy } from "./card.js";
import { composeCard } from "./compose.js";
import { magas7Overlay } from "./brand.js";
import { nextTopic } from "./topics.js";
import { postImageToX } from "./xClient.js";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const outFile = arg("--out") ?? "card-preview.png";
  const skipImage = process.argv.includes("--no-image");
  const post = process.argv.includes("--post");
  const outDir = process.env.STUDIO_OUTPUT_DIR ?? "/var/www/magas7.com/studio";
  const log = (m: string) => console.log(m);

  const topic = await nextTopic({ lastTemplate: undefined as never, lastAgentNumber: null });
  log(`topic: template=${topic.template} tag="${topic.tag}"`);

  const verdict = await writeCardCopy(topic);
  log(`copy: title="${verdict.cardTitle} / ${verdict.cardTitleAccent}"`);
  log(`      sub="${verdict.cardSub}"`);
  log(`      tweet="${verdict.tweet}"`);
  log(`      imagePrompt="${verdict.imagePrompt}"`);

  let png: Buffer;
  if (skipImage) {
    // 1600x900 void-black PNG (satori renders it) so compose can be verified alone.
    const black = await composeCard(
      await flatBlack(),
      magas7Overlay(outDir),
      { title: verdict.cardTitle, titleAccent: verdict.cardTitleAccent, sub: verdict.cardSub },
    );
    png = black;
  } else {
    if (!isCardImageAvailable()) throw new Error("OPENROUTER_API_KEY not set; use --no-image to test the composite only");
    png = await generateCardImage(verdict, outDir);
  }

  await fs.mkdir(path.dirname(path.resolve(outFile)), { recursive: true });
  await fs.writeFile(outFile, png);
  log(`written ${outFile} (${(png.byteLength / 1024).toFixed(0)}kb)`);

  if (post) {
    await postImageToX({ png, caption: verdict.tweet || topic.caption, log });
  }
}

/** Minimal 1x1 black PNG scaled by the composite's objectFit: cover. */
async function flatBlack(): Promise<Buffer> {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64",
  );
}

main().catch((e) => {
  console.error("preview failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
