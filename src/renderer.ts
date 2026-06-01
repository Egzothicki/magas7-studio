import path from "node:path";
import { chromium, type Browser } from "playwright";

let browserPromise: Promise<Browser> | null = null;
async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"],
    });
  }
  return browserPromise;
}

export interface RenderOptions {
  templatesDir: string;
  templateName: string;
  data: Record<string, unknown>;
  /** Directory to record video to. Playwright writes WebM. */
  recordDir: string;
}

export interface RenderResult {
  /** Absolute path to the recorded WebM. */
  webmPath: string;
}

/**
 * Open the template HTML in a 1080×1080 viewport, inject the data, wait for the
 * page to signal `window.__MAGAS_DONE__ = true`, then return the recorded WebM path.
 */
export async function renderVideo(opts: RenderOptions): Promise<RenderResult> {
  const browser = await getBrowser();
  const ctx = await browser.newContext({
    viewport: { width: 1080, height: 1080 },
    deviceScaleFactor: 1,
    recordVideo: { dir: opts.recordDir, size: { width: 1080, height: 1080 } },
  });

  const page = await ctx.newPage();
  await page.addInitScript((data) => {
    (window as unknown as Record<string, unknown>).__MAGAS_DATA__ = data;
  }, opts.data);

  const fileUrl = "file://" + path.join(opts.templatesDir, `${opts.templateName}.html`);
  await page.goto(fileUrl, { waitUntil: "networkidle" });

  // Give web fonts a moment to settle, then wait for the page to signal completion.
  await page.waitForFunction(() => document.fonts && document.fonts.status === "loaded", { timeout: 5_000 }).catch(() => undefined);

  await page.waitForFunction(
    () => (window as unknown as Record<string, unknown>).__MAGAS_DONE__ === true,
    { timeout: 30_000 },
  );

  // Small tail-out before closing so the final frame is captured.
  await page.waitForTimeout(400);

  const video = page.video();
  if (!video) throw new Error("Playwright recorded no video");

  await page.close();
  await ctx.close();

  const webmPath = await video.path();
  return { webmPath };
}

export async function shutdownBrowser(): Promise<void> {
  if (browserPromise) {
    const b = await browserPromise;
    await b.close();
    browserPromise = null;
  }
}
