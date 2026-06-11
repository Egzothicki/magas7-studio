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

  // Ad-Intel: generate plausible competitor ads + insights for any user query (cached 30m).
  const adCache = new Map<string, { data: unknown; at: number }>();
  const AD_TTL = 30 * 60_000;
  app.get("/api/ad-intel", async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    try {
      const q = String(req.query.q ?? "").trim().slice(0, 80);
      if (!q) return res.status(400).json({ error: "missing query" });
      const ck = q.toLowerCase();
      const hit = adCache.get(ck);
      if (hit && Date.now() - hit.at < AD_TTL) return res.json({ ...(hit.data as object), query: q, cached: true });

      const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
      if (!apiKey) return res.status(503).json({ error: "ad-intel not configured" });
      const base = process.env.OPENAI_BASE_URL || "https://openrouter.ai/api/v1";
      const model = process.env.AD_INTEL_MODEL || "openai/gpt-4o";

      const prompt = `You are an ad-intelligence engine for marketers. For the niche / product / category / brand: "${q}", invent 6 REALISTIC competitor ads that would plausibly be running right now on Meta, TikTok, or Google.
Rules: brands must be believable but invented (never real companies). Headlines punchy (under 9 words). Copy is ONE sentence. Vary platforms, angles, and formats. "hot" = currently scaling.
Return ONLY minified JSON (no markdown, no prose) of exactly this shape:
{"ads":[{"brand":"","platform":"Meta|TikTok|Google","days":<int 5-160>,"variants":<int 3-30>,"headline":"","copy":"","cta":"","angle":"<2-3 words e.g. Scarcity>","format":"Video|Image|Carousel","hot":<true|false>}],"insights":{"topAngles":[{"angle":"","weight":<int>}],"topFormat":"Video|Image|Carousel","avgDays":<int>,"scoutRead":"<one punchy sentence of analysis>"}}
Exactly 6 ads and exactly 4 topAngles.`;

      const r = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          max_tokens: 1300,
          temperature: 0.9,
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(28_000),
      });
      if (!r.ok) throw new Error(`LLM ${r.status}: ${(await r.text()).slice(0, 200)}`);
      const j = (await r.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const txt = j?.choices?.[0]?.message?.content ?? "{}";
      const m = txt.match(/\{[\s\S]*\}/);
      const data = JSON.parse(m ? m[0] : txt);
      if (!data || !Array.isArray(data.ads) || data.ads.length === 0) throw new Error("bad shape");
      adCache.set(ck, { data, at: Date.now() });
      res.json({ ...data, query: q, cached: false });
    } catch (e) {
      log(`ad-intel failed: ${String((e as Error)?.message ?? e).slice(0, 200)}`);
      res.status(500).json({ error: "generation failed" });
    }
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
