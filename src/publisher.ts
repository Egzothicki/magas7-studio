import fs from "node:fs/promises";
import path from "node:path";

import type { TemplateName } from "./topics.js";

export interface ManifestVideo {
  id: string;
  template: TemplateName;
  tag: string;
  caption: string;
  videoUrl: string;
  posterUrl: string;
  createdAt: string;
  sizeBytes: number;
}

export interface Manifest {
  generatedAt: string;
  videos: ManifestVideo[];
}

const SITE_URL = "https://magas7.com";

export function manifestPath(outDir: string): string {
  return path.join(outDir, "manifest.json");
}

export async function loadManifest(outDir: string): Promise<Manifest> {
  try {
    const raw = await fs.readFile(manifestPath(outDir), "utf8");
    const parsed = JSON.parse(raw) as Manifest;
    if (!Array.isArray(parsed.videos)) return { generatedAt: new Date().toISOString(), videos: [] };
    return parsed;
  } catch {
    return { generatedAt: new Date().toISOString(), videos: [] };
  }
}

export async function saveManifest(outDir: string, manifest: Manifest): Promise<void> {
  await fs.writeFile(manifestPath(outDir), JSON.stringify(manifest, null, 2), "utf8");
}

export async function appendVideo(outDir: string, video: ManifestVideo): Promise<Manifest> {
  await fs.mkdir(outDir, { recursive: true });
  const manifest = await loadManifest(outDir);
  manifest.videos.unshift(video);
  // Cap to last 60 videos to keep the showcase fast.
  manifest.videos = manifest.videos.slice(0, 60);
  manifest.generatedAt = new Date().toISOString();
  await saveManifest(outDir, manifest);
  return manifest;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function buildShareUrl(videoUrl: string, caption: string): string {
  const text = encodeURIComponent(caption);
  // X doesn't embed an external video URL in the intent, but it pre-fills the text + reference URL.
  const url = encodeURIComponent(`${SITE_URL}/studio`);
  return `https://twitter.com/intent/tweet?text=${text}%0A&url=${url}`;
}

const INDEX_CSS = `
:root {
  --void: #050507; --surface: #0c0d12; --surface-2: #11131a;
  --edge: #1c1f2b; --edge-2: #262a3a;
  --bone: #f5f5f7; --ash: #c2c4cf; --mute: #8b8d9b; --quiet: #5b5e6e;
  --signal: #b1ff5a; --violet: #9d6cff; --cyan: #6cf0ff;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: var(--void); color: var(--bone); font-family: "Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; -webkit-font-smoothing: antialiased; min-height: 100vh; }
body { background: radial-gradient(1200px 600px at 50% -200px, rgba(157, 108, 255, 0.18), transparent 70%), radial-gradient(800px 400px at 90% 10%, rgba(108, 240, 255, 0.10), transparent 70%), radial-gradient(900px 500px at -10% 30%, rgba(177, 255, 90, 0.07), transparent 70%), var(--void); background-attachment: fixed; }
a { color: var(--signal); text-decoration: none; }
.wrap { max-width: 1200px; margin: 0 auto; padding: 80px 28px 120px; }
.head { display: flex; align-items: center; justify-content: space-between; padding: 18px 0; border-bottom: 1px solid var(--edge); }
.brand { font-family: "JetBrains Mono", monospace; font-weight: 600; font-size: 15px; display: inline-flex; align-items: center; gap: 10px; color: var(--bone); }
.brand .seven { color: var(--signal); }
.nav a { color: var(--ash); margin-left: 20px; font-size: 14px; }
.nav a:hover { color: var(--bone); }
.hero { margin-top: 56px; text-align: center; }
.eyebrow { font-family: "JetBrains Mono", monospace; font-size: 12px; letter-spacing: 0.18em; color: var(--signal); text-transform: uppercase; }
.h1 { margin-top: 14px; font-size: 56px; font-weight: 500; letter-spacing: -0.025em; line-height: 1.05; }
.h1 .grad { background: linear-gradient(135deg, #b1ff5a 0%, #6cf0ff 50%, #9d6cff 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
.lead { margin: 18px auto 0; max-width: 660px; color: var(--ash); font-size: 18px; line-height: 1.55; }
.meta-row { margin-top: 28px; display: inline-flex; align-items: center; gap: 14px; padding: 10px 18px; border-radius: 999px; border: 1px solid var(--edge); background: rgba(12,13,18,0.6); font-size: 14px; color: var(--ash); }
.meta-row .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--signal); box-shadow: 0 0 12px var(--signal); }
.grid { margin-top: 64px; display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 18px; }
.card { background: rgba(12,13,18,0.7); border: 1px solid var(--edge); border-radius: 18px; overflow: hidden; transition: border-color .2s ease, transform .2s ease; }
.card:hover { border-color: var(--edge-2); transform: translateY(-2px); }
.video-frame { position: relative; aspect-ratio: 1/1; background: var(--surface); }
.video-frame video { width: 100%; height: 100%; object-fit: cover; display: block; }
.video-frame img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.body { padding: 16px 18px 18px; }
.tag { font-family: "JetBrains Mono", monospace; font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--quiet); }
.cap { margin-top: 8px; font-size: 14.5px; line-height: 1.5; color: var(--ash); }
.row { margin-top: 12px; display: flex; align-items: center; justify-content: space-between; }
.when { font-family: "JetBrains Mono", monospace; font-size: 11px; color: var(--quiet); }
.share { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px; background: var(--signal); color: var(--void); font-size: 12.5px; font-weight: 600; }
.share:hover { background: #c3ff7a; }
.empty { text-align: center; color: var(--mute); padding: 80px 0; }
.foot { margin-top: 80px; padding: 30px 0; border-top: 1px solid var(--edge); text-align: center; color: var(--quiet); font-size: 12px; font-family: "JetBrains Mono", monospace; letter-spacing: 0.15em; text-transform: uppercase; }
@media (max-width: 600px) { .h1 { font-size: 38px; } }
`;

export function buildIndexHtml(manifest: Manifest): string {
  const cards = manifest.videos
    .map((v) => `
      <article class="card">
        <div class="video-frame">
          <video src="${escapeHtml(v.videoUrl)}" poster="${escapeHtml(v.posterUrl)}" muted loop playsinline preload="metadata" onmouseenter="this.play()" onmouseleave="this.pause()"></video>
        </div>
        <div class="body">
          <div class="tag">${escapeHtml(v.tag)}</div>
          <div class="cap">${escapeHtml(v.caption)}</div>
          <div class="row">
            <span class="when">${escapeHtml(formatDate(v.createdAt))}</span>
            <a class="share" href="${escapeHtml(buildShareUrl(v.videoUrl, v.caption))}" target="_blank" rel="noopener">Share to X →</a>
          </div>
        </div>
      </article>
    `)
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>MAGAS7 Studio — agent-made videos</title>
<meta name="description" content="The MAGAS7 Studio agent generates short marketing videos on its own, every few hours. Each clip below is one agent demonstrating what MAGAS7 will do at launch." />
<meta name="robots" content="index,follow" />
<meta property="og:title" content="MAGAS7 Studio — agent-made videos" />
<meta property="og:description" content="Watch the Studio agent generate marketing clips on its own. Eat-our-own-dogfood proof of MAGAS7." />
<meta property="og:url" content="${SITE_URL}/studio" />
<meta property="og:type" content="website" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" />
<style>${INDEX_CSS}</style>
</head>
<body>
<div class="wrap">
  <header class="head">
    <a class="brand" href="/">
      <svg width="22" height="22" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg">
        <defs><linearGradient id="lg" x1="0" y1="0" x2="22" y2="22" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#b1ff5a"/><stop offset="0.55" stop-color="#6cf0ff"/><stop offset="1" stop-color="#9d6cff"/></linearGradient></defs>
        <path d="M2 18 L2 4 L7.5 4 L11 11 L14.5 4 L20 4 L20 18 L16.5 18 L16.5 9.5 L13 16.5 L9 16.5 L5.5 9.5 L5.5 18 Z" fill="url(#lg)"/>
        <circle cx="20" cy="18" r="2" fill="#b1ff5a"/>
      </svg>
      <span>MAGAS<span class="seven">7</span> Studio</span>
    </a>
    <nav class="nav">
      <a href="/">Home</a>
      <a href="/#agents">Agents</a>
      <a href="/#tools">Tools</a>
      <a href="/#waitlist">Waitlist</a>
    </nav>
  </header>

  <section class="hero">
    <div class="eyebrow">Eat-our-own-dogfood</div>
    <h1 class="h1">An agent that makes <span class="grad">marketing videos.</span></h1>
    <p class="lead">The Studio agent — one of the 7 inside MAGAS7 — generates the clips below on its own, every few hours. Same agent, same tools, same templates that ship with the product.</p>
    <div class="meta-row"><span class="dot"></span> Live · ${escapeHtml(formatDate(manifest.generatedAt))} · ${manifest.videos.length} clip${manifest.videos.length === 1 ? "" : "s"}</div>
  </section>

  <section class="grid">
    ${manifest.videos.length === 0
      ? `<div class="empty">First clip generates within the hour.</div>`
      : cards}
  </section>

  <footer class="foot">Generated by the MAGAS7 Studio agent · regenerated every 6h</footer>
</div>
</body>
</html>`;
}

export async function writeIndexHtml(outDir: string, manifest: Manifest): Promise<void> {
  const html = buildIndexHtml(manifest);
  await fs.writeFile(path.join(outDir, "index.html"), html, "utf8");
}
