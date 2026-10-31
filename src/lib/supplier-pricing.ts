// Store price for a resold supplier product, in piasters: supplier cost in
// USD × the dollar rate × the price multiplier, rounded up to a whole pound.
// The platform commission comes out of this price like any other sale.
export function supplierPrice(input: {
  costMills: number;
  usdRate: number; // piasters per USD
  multiplierBps: number; // 25000 = 2.5×
}) {
  const { costMills, usdRate, multiplierBps } = input;
  const piasters = (costMills * usdRate * multiplierBps) / (1000 * 10000);
  return Math.max(100, Math.ceil(piasters / 100 - 1e-9) * 100);
}
// Best-guess store category for a supplier product name; the admin can
// change it before importing. Order matters: specific brands first.
const RULES: [RegExp, string][] = [
  [/chatgpt|openai|codex/i, "chatgpt"],
  [/gemini/i, "gemini"],
  [/claude/i, "claude-ai"],
  [/midjourney/i, "midjourney"],
  [/perplexity/i, "perplexity"],
  [/copilot/i, "copilot"],
  [/canva/i, "canva"],
  [/capcut/i, "capcut"],
  [/adobe|photoshop|illustrator/i, "adobe"],
  [/nord\s*vpn/i, "nordvpn"],
  [/express\s*vpn/i, "expressvpn"],
  [/surfshark/i, "surfshark"],
  [/proton/i, "proton-vpn"],
  [/vpn|v2ray|proxy/i, "vpn"],
  [/netflix/i, "netflix"],
  [/shahid/i, "shahid"],
  [/spotify/i, "spotify"],
  [/anghami/i, "anghami"],
  [/youtube/i, "youtube-premium"],
  [/disney/i, "disney-plus"],
  [/prime\s*video/i, "prime-video"],
  [/apple\s*tv|scribd|streaming/i, "streaming"],
  [/telegram/i, "telegram-premium"],
  [/discord/i, "discord-nitro"],
  [/free\s*fire/i, "free-fire-diamonds"],
  [/pubg/i, "pubg-uc"],
  [/office|microsoft 365|outlook|hotmail/i, "microsoft-office"],
  [/windows/i, "windows"],
  [/coursera/i, "coursera"],
  [/udemy/i, "udemy"],
  [/linkedin/i, "linkedin-learning"],
  [/edx|edu|course/i, "learning"],
  [/figma|miro|framer|autodesk|jetbrains/i, "design"],
  [/notion|ilovepdf|gmail|mail/i, "productivity"],
  [/\bai\b|api|token|elevenlabs|kimi|deepseek|muse|replit|cursor/i, "ai"],
];

export function guessCategorySlug(name: string) {
  return RULES.find(([re]) => re.test(name))?.[1] ?? "productivity";
}
