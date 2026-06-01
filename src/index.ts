import "dotenv/config";
import path from "node:path";
import express from "express";
import cron from "node-cron";

import { generateOne } from "./generate.js";
import { shutdownBrowser } from "./renderer.js";
import { writeIndexHtml, loadManifest } from "./publisher.js";

const OUT_DIR = process.env.STUDIO_OUTPUT_DIR ?? "/var/www/magas7.com/studio";
const TMP_DIR = process.env.STUDIO_TMP_DIR ?? "/tmp/magas7-studio";
const PORT = Number(process.env.PORT ?? 3000);
const CRON_EXPR = process.env.STUDIO_GEN_CRON ?? "0 */6 * * *"; // every 6h
const ADMIN_TOKEN = process.env.STUDIO_ADMIN_TOKEN ?? "";
const RUN_ON_START = String(process.env.STUDIO_RUN_ON_START ?? "true").toLowerCase() === "true";

function nowIso(): string { return new Date().toISOString(); }
function log(msg: string): void { console.log(`[${nowIso()}] ${msg}`); }

let busy = false;

async function generate(): Promise<{ ok: boolean; reason?: string }> {
  if (busy) return { ok: false, reason: "already generating" };
  busy = true;
  try {
    log("studio: generation started");
    const result = await generateOne({ outDir: OUT_DIR, tmpDir: TMP_DIR, log });
    log(`studio: generation ${result ? "ok" : "failed"}`);
    return { ok: !!result, reason: result ? undefined : "see logs" };
  } finally {
    busy = false;
  }
}

async function ensureIndexExists(): Promise<void> {
  try {
    const manifest = await loadManifest(OUT_DIR);
    await writeIndexHtml(OUT_DIR, manifest);
    log(`studio: index.html refreshed (videos=${manifest.videos.length})`);
  } catch (e) {
    log(`studio: index refresh failed — ${String(e).slice(0, 200)}`);
  }
}

async function main(): Promise<void> {
  log(`studio: starting · out=${OUT_DIR} cron="${CRON_EXPR}"`);
  await ensureIndexExists();

  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ ok: true, busy }));

  app.post("/trigger", async (req, res) => {
    if (ADMIN_TOKEN) {
      const header = String(req.headers.authorization ?? "");
      const got = header.replace(/^Bearer\s+/i, "").trim();
      if (got !== ADMIN_TOKEN) return res.status(401).json({ ok: false, error: "unauthorized" });
    }
    const result = await generate();
    res.json(result);
  });

  app.listen(PORT, "0.0.0.0", () => log(`studio: http listening on :${PORT}`));

  cron.schedule(CRON_EXPR, () => {
    generate().catch((e) => log(`studio: cron error ${String(e)}`));
  });

  if (RUN_ON_START) {
    // Fire once shortly after boot so the operator sees output without waiting for the cron tick.
    setTimeout(() => {
      generate().catch((e) => log(`studio: warmup error ${String(e)}`));
    }, 6_000);
  }

  const shutdown = async () => { await shutdownBrowser(); process.exit(0); };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((e) => {
  console.error("Fatal", e);
  process.exit(1);
});
