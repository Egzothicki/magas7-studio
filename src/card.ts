// Poster-card generation for the studio's X posts.
//
// Same recipe as devmarketing's deploy cards (the images the team sees on
// WhatsApp): the image model paints a text-free brand atmosphere, then the
// headline, sub, logo and URL pill are composited deterministically on top
// (compose.ts). AI does atmosphere, design does the message.
import { composeCard } from "./compose.js";
import { MAGAS7_IMAGE_STYLE, magas7Overlay } from "./brand.js";
import type { Topic } from "./topics.js";

// Copy and image both go through OpenRouter, mirroring devmarketing exactly
// (this container has OPENROUTER_API_KEY but no direct Anthropic key).
const COPY_MODEL = process.env.COPY_MODEL ?? "anthropic/claude-sonnet-4-6";
const IMAGE_MODEL = process.env.IMAGE_MODEL ?? "openai/gpt-5.4-image-2";
const IMAGE_FALLBACK_MODEL = process.env.IMAGE_FALLBACK_MODEL ?? "google/gemini-2.5-flash-image";
// gpt-5.4-image-2 can take several minutes; generation is async so a long wait is fine.
const IMAGE_TIMEOUT_MS = Number(process.env.IMAGE_TIMEOUT_MS ?? 480_000);
const OR_URL = "https://openrouter.ai/api/v1/chat/completions";
const OR_HEADERS = () => ({
  Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
  "Content-Type": "application/json",
  "HTTP-Referer": "https://magas7.com",
  "X-Title": "magas7-studio",
});

export interface CardVerdict {
  /** Post text for X, <=250 chars. */
  tweet: string;
  /** ONE physical subject for the background render (style guard is prepended). */
  imagePrompt: string;
  /** Headline line 1, plain near-white. */
  cardTitle: string;
  /** Headline line 2, rendered in the brand gradient. */
  cardTitleAccent: string;
  /** One supporting sentence under the headline. */
  cardSub: string;
}

export function isCardImageAvailable(): boolean {
  return !!process.env.OPENROUTER_API_KEY;
}

/** House style: no em/en dashes, no double spaces, straight quotes. */
function sanitizeCopy(s: string): string {
  return s
    .replace(/[—–]/g, ", ")
    .replace(/\s+,/g, ",")
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Static verdicts so a Sonnet outage degrades the words, never the post. */
function fallbackVerdict(topic: Topic): CardVerdict {
  const byTemplate: Record<string, Omit<CardVerdict, "tweet" | "imagePrompt">> = {
    "agent-spotlight": {
      cardTitle: "Seven agents,",
      cardTitleAccent: "one payroll of zero.",
      cardSub: "Research, copy, design, distribution and analytics, staffed by MAGAS7 agents.",
    },
    "brief-to-output": {
      cardTitle: "One brief in,",
      cardTitleAccent: "a campaign out.",
      cardSub: "MAGAS7 agents turn a two-line brief into a full working campaign.",
    },
    "stat-slam": {
      cardTitle: "Stop doing the work.",
      cardTitleAccent: "Start directing it.",
      cardSub: "MAGAS7 puts seven marketing agents on your brief around the clock.",
    },
  };
  const copy = byTemplate[topic.template] ?? byTemplate["stat-slam"];
  return {
    ...copy,
    tweet: topic.caption,
    imagePrompt:
      "a sleek obsidian control dial, glass and brushed metal, a thin ring of signal-green light around its rim",
  };
}

/**
 * Write the card copy for a studio topic. Modeled on devmarketing's
 * judgeAndWrite card fields; the input is the studio topic instead of a diff.
 */
export async function writeCardCopy(topic: Topic): Promise<CardVerdict> {
  if (!isCardImageAvailable()) return fallbackVerdict(topic);

  const brief = typeof topic.data.brief === "string" ? topic.data.brief : "";
  const agent = typeof topic.data.agentName === "string" ? topic.data.agentName : "";
  const prompt =
    "You write marketing posts for MAGAS7 (magas7.com), the agentic OS for marketing teams: " +
    "7 specialist AI agents do research, copy, design, distribution and analytics. " +
    "Voice: sharp, futuristic, confident. Never hype-words like 'revolutionary', no emojis, no hashtags, no dashes.\n\n" +
    `Today's spot: ${topic.tag}${agent ? ` (featuring the ${agent} agent)` : ""}${brief ? `. Sample brief shown: "${brief}"` : ""}.\n\n` +
    "ART DIRECTION (for imagePrompt): the image style is a cinematic product-launch key visual, one single " +
    "physical object glowing signal-green in void-black darkness. Write imagePrompt as ONE clear physical " +
    "subject only, described concretely (the style is prepended automatically); no text, screens, charts, logos, " +
    "robots or humanoids.\n\n" +
    "Reply with ONLY a JSON object, no markdown fence:\n" +
    "{\n" +
    '  "tweet": string,            // <=250 chars, one confident post about what MAGAS7 does, ends with https://magas7.com\n' +
    '  "imagePrompt": string,      // ONE physical subject only\n' +
    '  "cardTitle": string,        // headline line 1 (plain), together with cardTitleAccent at most 7 words, sentence case, no end punctuation (example: Every agent hour,)\n' +
    '  "cardTitleAccent": string,  // headline line 2, the payoff words that get the gradient (example: on the meter.)\n' +
    '  "cardSub": string           // <=110 chars, one concrete sentence, no dashes, no emojis\n' +
    "}";

  try {
    const res = await fetch(OR_URL, {
      method: "POST",
      headers: OR_HEADERS(),
      body: JSON.stringify({
        model: COPY_MODEL,
        max_tokens: 700,
        temperature: 0.7,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) throw new Error(`${COPY_MODEL} ${res.status}`);
    const json = (await res.json()) as any;
    const raw = String(json?.choices?.[0]?.message?.content ?? "");
    const jsonText = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const v = JSON.parse(jsonText) as Record<string, unknown>;
    const verdict: CardVerdict = {
      tweet: sanitizeCopy(String(v.tweet ?? "")).slice(0, 250),
      imagePrompt: String(v.imagePrompt ?? "").trim(),
      cardTitle: sanitizeCopy(String(v.cardTitle ?? "")).slice(0, 40),
      cardTitleAccent: sanitizeCopy(String(v.cardTitleAccent ?? "")).slice(0, 40),
      cardSub: sanitizeCopy(String(v.cardSub ?? "")).slice(0, 130),
    };
    if (!verdict.tweet || !verdict.imagePrompt || !verdict.cardTitle || !verdict.cardTitleAccent) {
      return fallbackVerdict(topic);
    }
    return verdict;
  } catch {
    return fallbackVerdict(topic);
  }
}

// Call one image model. Image-capable models return the image as a data URL in
// message.images[].image_url.url. Returns PNG/JPEG bytes.
async function generateWith(model: string, prompt: string): Promise<Buffer> {
  const res = await fetch(OR_URL, {
    method: "POST",
    headers: OR_HEADERS(),
    body: JSON.stringify({
      model,
      modalities: ["image", "text"],
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${model} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as any;

  const images = json?.choices?.[0]?.message?.images;
  const dataUrl: string | undefined = images?.[0]?.image_url?.url;
  if (!dataUrl) {
    throw new Error(`${model} returned no image: ${JSON.stringify(json?.choices?.[0]?.message ?? json).slice(0, 300)}`);
  }
  const comma = dataUrl.indexOf(",");
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  return Buffer.from(b64, "base64");
}

async function generateBackground(styled: string): Promise<Buffer> {
  try {
    return await generateWith(IMAGE_MODEL, styled);
  } catch (err) {
    if (!IMAGE_FALLBACK_MODEL || IMAGE_FALLBACK_MODEL === IMAGE_MODEL) throw err;
    console.warn(
      `[card] ${IMAGE_MODEL} failed (${String((err as any)?.message ?? err).slice(0, 120)}); falling back to ${IMAGE_FALLBACK_MODEL}`,
    );
    return await generateWith(IMAGE_FALLBACK_MODEL, styled);
  }
}

/** Text-free brand background, then the deterministic typography composite. */
export async function generateCardImage(verdict: CardVerdict, outDir: string): Promise<Buffer> {
  const styled = MAGAS7_IMAGE_STYLE + "Subject: " + verdict.imagePrompt;
  const background = await generateBackground(styled);
  try {
    return await composeCard(background, magas7Overlay(outDir), {
      title: verdict.cardTitle,
      titleAccent: verdict.cardTitleAccent,
      sub: verdict.cardSub,
    });
  } catch (err) {
    // A failed composite should never cost us the post; ship the raw render instead.
    console.error(`[card] composite failed, using raw background: ${String((err as any)?.message ?? err).slice(0, 200)}`);
    return background;
  }
}
