// Heroicons-style icon paths so the template stays self-contained.

export const AGENTS = [
  {
    number: "01",
    name: "Scout",
    role: "Research & intel",
    desc: "Crawls competitors, monitors SOV, mines reviews, scores audiences against your ICP. Always-on market radar.",
    skills: ["Competitor watch", "SERP & SOV", "Audience research", "ICP scoring", "Trend mining"],
    accent: "cyan",
    iconPath: "M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z",
  },
  {
    number: "02",
    name: "Scribe",
    role: "Copy & content",
    desc: "Writes ads, landing pages, emails, blog posts. In your brand voice. Cites sources. Versions everything.",
    skills: ["Ad copy", "Landing pages", "Email sequences", "Long-form SEO", "Voice & tone"],
    accent: "signal",
    iconPath: "M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z",
  },
  {
    number: "03",
    name: "Studio",
    role: "Design & visuals",
    desc: "Produces images, ad creatives, social posts, OG cards. Brand tokens baked in. Every ratio exported.",
    skills: ["Image gen", "Figma frames", "Ad creatives", "OG / social", "Brand tokens"],
    accent: "violet",
    iconPath: "M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z",
  },
  {
    number: "04",
    name: "Director",
    role: "Strategy & planning",
    desc: "Turns goals into campaigns, picks channels, sizes budgets, decides what to test. Owns the roadmap.",
    skills: ["Campaign planning", "Channel mix", "Budget modeling", "Roadmaps", "Experimentation"],
    accent: "amber",
    iconPath: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z",
  },
  {
    number: "05",
    name: "Conductor",
    role: "Distribution & scheduling",
    desc: "Posts, schedules, and pushes across paid + organic. Manages calendars, queues, UTMs, approval flows.",
    skills: ["Paid + organic posting", "Calendar mgmt", "UTM hygiene", "Approval flows", "Cross-channel"],
    accent: "cyan",
    iconPath: "M3.75 3.75v16.5h16.5M6 18l3-6 4 4 6-9",
  },
  {
    number: "06",
    name: "Oracle",
    role: "Analytics & insight",
    desc: "Builds live dashboards, attributes outcomes, detects winners early, writes the weekly performance brief.",
    skills: ["Attribution", "Live dashboards", "Winner detection", "Cohort analysis", "Weekly briefs"],
    accent: "signal",
    iconPath: "M2.25 18L9 11.25l4.306 4.306a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.281m5.94 2.28l-2.28 5.941",
  },
  {
    number: "07",
    name: "Sentinel",
    role: "Brand & QA",
    desc: "Guards voice, claims, legal lines, brand consistency. Reviews everything before it ships. Blocks what shouldn't.",
    skills: ["Brand consistency", "Claim QA", "Legal review", "Compliance", "Pre-ship gates"],
    accent: "violet",
    iconPath: "M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z",
  },
] as const;

export type Agent = (typeof AGENTS)[number];

export function pickAgent(prevNumber: string | null): Agent {
  const available = AGENTS.filter((a) => a.number !== prevNumber);
  return available[Math.floor(Math.random() * available.length)];
}
