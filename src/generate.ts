import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { renderVideo } from "./renderer.js";
import { transcodeToMp4, extractPoster } from "./encoder.js";
import { appendVideo, writeIndexHtml, type ManifestVideo } from "./publisher.js";
import { nextTopic } from "./topics.js";
import { maybePostToX } from "./xClient.js";

const TEMPLATES_DIR = path.resolve(process.cwd(), "templates");

export interface GenerateConfig {
  outDir: string; // where finished mp4+poster+manifest live (served by nginx)
  tmpDir: string; // ephemeral working dir for webm + intermediates
  log: (msg: string) => void;
}

export interface StateFile {
  lastTemplate?: string;
  lastAgentNumber?: string;
}

async function loadState(dir: string): Promise<StateFile> {
  try {
    const raw = await fs.readFile(path.join(dir, "studio-state.json"), "utf8");
    return JSON.parse(raw) as StateFile;
  } catch {
    return {};
  }
}

async function saveState(dir: string, state: StateFile): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "studio-state.json"), JSON.stringify(state), "utf8");
}

export async function generateOne(config: GenerateConfig): Promise<ManifestVideo | null> {
  const { outDir, tmpDir, log } = config;
  const stateDir = process.env.DATA_DIR ?? "/var/data";

  await fs.mkdir(tmpDir, { recursive: true });
  await fs.mkdir(path.join(outDir, "videos"), { recursive: true });
  await fs.mkdir(path.join(outDir, "posters"), { recursive: true });

  const state = await loadState(stateDir);
  const topic = await nextTopic({
    lastTemplate: state.lastTemplate as never,
    lastAgentNumber: state.lastAgentNumber ?? null,
  });
  log(`studio: chose template=${topic.template} tag="${topic.tag}"`);

  const id = `${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`;
  const recordDir = path.join(tmpDir, `rec-${id}`);
  await fs.mkdir(recordDir, { recursive: true });

  let webmPath: string;
  try {
    const r = await renderVideo({
      templatesDir: TEMPLATES_DIR,
      templateName: topic.template,
      data: topic.data,
      recordDir,
    });
    webmPath = r.webmPath;
  } catch (e) {
    log(`studio: render failed — ${String(e).slice(0, 200)}`);
    return null;
  }

  const mp4Path = path.join(outDir, "videos", `${id}.mp4`);
  const posterPath = path.join(outDir, "posters", `${id}.jpg`);
  try {
    await transcodeToMp4(webmPath, mp4Path);
    await extractPoster(mp4Path, posterPath);
  } catch (e) {
    log(`studio: transcode failed — ${String(e).slice(0, 200)}`);
    return null;
  }

  // Clean up the WebM and the per-run record dir.
  await fs.rm(recordDir, { recursive: true, force: true }).catch(() => undefined);

  const stat = await fs.stat(mp4Path);
  const video: ManifestVideo = {
    id,
    template: topic.template,
    tag: topic.tag,
    caption: topic.caption,
    videoUrl: `/studio/videos/${id}.mp4`,
    posterUrl: `/studio/posters/${id}.jpg`,
    createdAt: new Date().toISOString(),
    sizeBytes: stat.size,
  };

  const manifest = await appendVideo(outDir, video);
  await writeIndexHtml(outDir, manifest);
  log(`studio: published id=${id} size=${(stat.size / 1024).toFixed(0)}kb count=${manifest.videos.length}`);

  // Save state to bias next pick.
  await saveState(stateDir, {
    lastTemplate: topic.template,
    lastAgentNumber: typeof topic.data.agentNumber === "string" ? topic.data.agentNumber : state.lastAgentNumber,
  });

  // Optional X auto-post (no-op if creds missing).
  await maybePostToX({ mp4Path, caption: topic.caption, log });

  return video;
}
