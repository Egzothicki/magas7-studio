const SONNET_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
const API_URL = "https://api.anthropic.com/v1/messages";

export interface SonnetMessage { role: "user" | "assistant"; content: string }

export interface SonnetOptions {
  system?: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

export function isSonnetAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export async function callSonnet(messages: SonnetMessage[], opts: SonnetOptions = {}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const body: Record<string, unknown> = {
    model: SONNET_MODEL,
    max_tokens: opts.maxTokens ?? 1024,
    messages,
  };
  if (opts.system) body.system = opts.system;
  if (typeof opts.temperature === "number") body.temperature = opts.temperature;

  const resp = await fetch(API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 60_000),
  });

  if (!resp.ok) throw new Error(`Sonnet ${resp.status}: ${(await resp.text()).slice(0, 400)}`);
  const json = (await resp.json()) as { content?: Array<{ text?: string }> };
  const text = json?.content?.[0]?.text;
  if (typeof text !== "string") throw new Error("Sonnet response missing content[0].text");
  return text.trim();
}
