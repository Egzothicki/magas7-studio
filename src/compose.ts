// Deterministic typography overlay: takes the AI-generated background (which must
// contain NO text) and composites the brand card on top with satori + resvg.
// This is the "variant D" treatment James picked on 2026-08-14 for devmarketing's
// deploy cards (the images the team sees on WhatsApp): AI does atmosphere, design
// does the message. Ported here verbatim so MAGAS7's X posts match those cards.
//
// Fonts come from the @fontsource packages (same woff files devmarketing vendors
// in assets/fonts). The logo is embedded base64 in brand.ts — this repo's tooling
// cannot add binary assets.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

const require = createRequire(import.meta.url);

export interface BrandOverlay {
  /** Headline gradient stops, e.g. ["#b1ff5a", "#6cf0ff", "#9d6cff"]. */
  gradient: [string, string, string];
  /** Text inside the bottom-left URL pill, e.g. "magas7.com". */
  urlLabel: string;
  /** Bottom-right stamp, e.g. "Marketing agents · On standby". */
  tagline: string;
  /** Top-right stamp, e.g. "Shipped". */
  stamp: string;
  /** Accent color for the pill/logo fallback. */
  accent: string;
  /** Base64 PNG for the top-left logo (optional). */
  logoBase64?: string;
}

const W = 1600;
const H = 900;

const fontCache = new Map<string, Buffer>();
function font(pkgRel: string): Buffer {
  const cached = fontCache.get(pkgRel);
  if (cached) return cached;
  const data = readFileSync(require.resolve(pkgRel));
  fontCache.set(pkgRel, data);
  return data;
}
const DISPLAY = "@fontsource/geist-sans/files/geist-sans-latin-600-normal.woff";
const BODY = "@fontsource/geist-sans/files/geist-sans-latin-400-normal.woff";
const MONO = "@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff";

export interface OverlayCardCopy {
  /** First headline line, plain near-white. */
  title: string;
  /** Second headline line, rendered in the brand gradient. */
  titleAccent: string;
  /** One supporting sentence under the headline. */
  sub: string;
}

// satori element helper (keeps the tree readable without JSX).
function el(type: string, style: Record<string, unknown>, children?: unknown): any {
  return { type, props: { style, children } };
}

const stampStyle = (color: string) => ({
  fontFamily: "Mono",
  fontSize: 16,
  letterSpacing: "0.18em",
  textTransform: "uppercase" as const,
  color,
});

export async function composeCard(background: Buffer, overlay: BrandOverlay, copy: OverlayCardCopy): Promise<Buffer> {
  const bgUrl = `data:image/png;base64,${background.toString("base64")}`;
  const logoUrl = overlay.logoBase64 ? `data:image/png;base64,${overlay.logoBase64}` : null;
  const [g1, g2, g3] = overlay.gradient;

  const tree = el(
    "div",
    { width: W, height: H, display: "flex", position: "relative", backgroundColor: "#050507", fontFamily: "Body" },
    [
      // Background render (subject expected on the right third), then a left shade so type always reads.
      { type: "img", props: { src: bgUrl, width: W, height: H, style: { position: "absolute", top: 0, left: 0, width: W, height: H, objectFit: "cover" } } },
      el("div", { position: "absolute", top: 0, left: 0, width: W, height: H, backgroundImage: "linear-gradient(90deg, rgba(5,5,7,0.93) 0%, rgba(5,5,7,0.74) 34%, rgba(5,5,7,0) 62%)" }),
      el(
        "div",
        { position: "absolute", top: 0, left: 0, width: W, height: H, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "62px 74px" },
        [
          el("div", { display: "flex", alignItems: "center", justifyContent: "space-between" }, [
            logoUrl
              ? { type: "img", props: { src: logoUrl, height: 44, style: { height: 44 } } }
              : el("div", { ...stampStyle(overlay.accent), fontSize: 20, letterSpacing: "0.3em" }, overlay.urlLabel.toUpperCase()),
            el("div", stampStyle("#8b8d9b"), overlay.stamp),
          ]),
          el("div", { display: "flex", flexDirection: "column", maxWidth: 820 }, [
            el("div", { fontFamily: "Display", fontWeight: 600, fontSize: 92, lineHeight: 1.04, letterSpacing: "-0.033em", color: "#f5f5f7" }, copy.title),
            el(
              "div",
              {
                fontFamily: "Display",
                fontWeight: 600,
                fontSize: 92,
                lineHeight: 1.04,
                letterSpacing: "-0.033em",
                backgroundImage: `linear-gradient(135deg, ${g1} 0%, ${g2} 60%, ${g3} 100%)`,
                backgroundClip: "text",
                color: "transparent",
              },
              copy.titleAccent,
            ),
            el("div", { marginTop: 26, fontFamily: "Body", fontWeight: 400, fontSize: 25, lineHeight: 1.5, color: "#c2c4cf", maxWidth: 640 }, copy.sub),
          ]),
          el("div", { display: "flex", alignItems: "center", justifyContent: "space-between" }, [
            el(
              "div",
              {
                display: "flex",
                alignItems: "center",
                fontFamily: "Mono",
                fontSize: 20,
                color: overlay.accent,
                border: "1px solid #1c1f2b",
                backgroundColor: "rgba(5,5,7,0.6)",
                padding: "12px 26px",
                borderRadius: 999,
              },
              overlay.urlLabel,
            ),
            el("div", stampStyle("#8b8d9b"), overlay.tagline),
          ]),
        ],
      ),
    ],
  );

  const svg = await satori(tree, {
    width: W,
    height: H,
    fonts: [
      { name: "Display", data: font(DISPLAY), weight: 600, style: "normal" },
      { name: "Body", data: font(BODY), weight: 400, style: "normal" },
      { name: "Mono", data: font(MONO), weight: 500, style: "normal" },
    ],
  });

  const rendered = new Resvg(svg, { fitTo: { mode: "width", value: W } }).render();
  return Buffer.from(rendered.asPng());
}
