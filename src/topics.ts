import { AGENTS, pickAgent, type Agent } from "./agentCatalog.js";
import { callSonnet, isSonnetAvailable } from "./sonnet.js";

export type TemplateName = "agent-spotlight" | "brief-to-output" | "stat-slam";

export interface Topic {
  template: TemplateName;
  data: Record<string, unknown>;
  /** Short caption used when posting / sharing. */
  caption: string;
  /** Internal hint shown in the studio index. */
  tag: string;
}

const TEMPLATE_ROTATION: TemplateName[] = [
  "brief-to-output",
  "agent-spotlight",
  "stat-slam",
  "brief-to-output",
  "agent-spotlight",
];

const SAMPLE_BRIEFS = [
  "Launch a 6-day pricing test. Two hypotheses, $4.2k budget, 5 channels.",
  "Spin up a Black Friday campaign. 11 days. Email + paid + organic. Hold 20% for retargeting.",
  "Test 3 onboarding flows on the landing page. Want a winner inside a week.",
  "Build the Q3 launch narrative. Press, paid, social, and one cinematic explainer.",
  "Audit our newsletter. Find the 3 biggest leaks and ship a fix this week.",
  "Make a referral program. Copy, page, emails, paid amp. Soft-launch in 5 days.",
];

const SAMPLE_STAT_HEADLINES = [
  "What happens when <span class=\"gradient-text\">agents do the work.</span>",
  "Direction in. <span class=\"gradient-text\">Campaigns out.</span>",
  "Stop doing the work. <span class=\"gradient-text\">Start directing it.</span>",
];

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function captionForAgent(agent: Agent): string {
  return `Meet ${agent.name} — the ${agent.role.toLowerCase()} agent in MAGAS7. One of 7 specialists that ship marketing campaigns end-to-end. Coming soon → magas7.com`;
}

function captionForBrief(brief: string): string {
  return `One brief in → 7 agents to work → a campaign shipping. MAGAS7 — the agentic OS for marketing teams. Coming soon → magas7.com`;
}

function captionForStat(): string {
  return `Stop doing the work. Start directing it. MAGAS7 — 7 specialist agents that research, write, design, schedule, post, analyze, protect your brand. Coming soon → magas7.com`;
}

async function maybeSonnetCaption(seed: string, fallback: string): Promise<string> {
  if (!isSonnetAvailable()) return fallback;
  try {
    const text = await callSonnet(
      [{ role: "user", content: `Rewrite as a single X (Twitter) post. Sharp, dry, no hype words, no hashtags, no emoji except optional ✨ or →. Under 240 characters. End with: → magas7.com\n\nSeed: ${seed}` }],
      {
        system: "You are the social voice of MAGAS7 — Marketing Agents. Confident, technical, mildly cheeky.",
        maxTokens: 200,
        temperature: 0.85,
        timeoutMs: 25_000,
      },
    );
    return text.replace(/^["']|["']$/g, "").slice(0, 270);
  } catch {
    return fallback;
  }
}

/** Builds the next topic. Rotates templates and varies content. */
export async function nextTopic(state: { lastTemplate?: TemplateName; lastAgentNumber?: string | null }): Promise<Topic> {
  // Rotate: pick next template not equal to last, biased by rotation list.
  const candidates = TEMPLATE_ROTATION.filter((t) => t !== state.lastTemplate);
  const template: TemplateName = candidates[Math.floor(Math.random() * candidates.length)] ?? "brief-to-output";

  if (template === "agent-spotlight") {
    const agent = pickAgent(state.lastAgentNumber ?? null);
    const data = {
      agentName: agent.name,
      agentRole: agent.role,
      agentNumber: agent.number,
      agentDesc: agent.desc,
      accent: agent.accent,
      iconPath: agent.iconPath,
      skills: agent.skills.slice(0, 5),
    };
    const fallback = captionForAgent(agent);
    const caption = await maybeSonnetCaption(`Spotlight on the ${agent.name} agent (${agent.role}). ${agent.desc}`, fallback);
    return { template, data, caption, tag: `agent · ${agent.name}` };
  }

  if (template === "brief-to-output") {
    const brief = pickRandom(SAMPLE_BRIEFS);
    const data = { brief };
    const fallback = captionForBrief(brief);
    const caption = await maybeSonnetCaption(`Brief: "${brief}". Show that 7 specialist agents do the work end-to-end while the operator directs.`, fallback);
    return { template, data, caption, tag: "brief → output" };
  }

  // stat-slam
  const data = { headline: pickRandom(SAMPLE_STAT_HEADLINES) };
  const caption = await maybeSonnetCaption(`Numbers from MAGAS7 alpha: 12x campaigns per operator/week, 2 days brief-to-live, 27 variants per launch, 36hrs of manual work removed per week.`, captionForStat());
  return { template, data, caption, tag: "stat slam" };
}
