// The storefront's category tree, modelled on the big digital-goods
// marketplaces. Used by the dev seed; the same rows reach production through
// the migration 20261027230000_category_tree (generated from this file).
// Every category has its own artwork at /categories/<slug>.svg.

export type CategorySeed = {
  slug: string;
  nameAr: string;
  nameEn: string;
  icon: string;
  commissionBps: number;
  children: { slug: string; nameAr: string; nameEn: string; icon: string }[];
};

export const CATEGORY_TREE: CategorySeed[] = [
  {
    slug: "games", nameAr: "ألعاب", nameEn: "Games", icon: "🎮", commissionBps: 1000,
    children: [
      { slug: "steam-games", nameAr: "ألعاب Steam", nameEn: "Steam games", icon: "🎮" },
      { slug: "playstation-games", nameAr: "ألعاب PlayStation", nameEn: "PlayStation games", icon: "🎮" },
      { slug: "xbox-games", nameAr: "ألعاب Xbox", nameEn: "Xbox games", icon: "🎮" },
      { slug: "nintendo-games", nameAr: "ألعاب Nintendo", nameEn: "Nintendo games", icon: "🎮" },
      { slug: "epic-games", nameAr: "Epic Games", nameEn: "Epic Games", icon: "🎮" },
      { slug: "ea-app-games", nameAr: "EA app", nameEn: "EA app", icon: "🎮" },
      { slug: "ubisoft-games", nameAr: "Ubisoft Connect", nameEn: "Ubisoft Connect", icon: "🎮" },
      { slug: "battle-net-games", nameAr: "Battle.net", nameEn: "Battle.net", icon: "🎮" },
    ],
  },
  {
    slug: "gift-cards", nameAr: "كروت شحن وهدايا", nameEn: "Gift cards", icon: "🎁", commissionBps: 500,
    children: [
      { slug: "steam-wallet", nameAr: "رصيد Steam", nameEn: "Steam Wallet", icon: "💳" },
      { slug: "psn-cards", nameAr: "كروت PlayStation", nameEn: "PlayStation Store cards", icon: "💳" },
      { slug: "xbox-cards", nameAr: "كروت Xbox", nameEn: "Xbox gift cards", icon: "💳" },
      { slug: "itunes-cards", nameAr: "iTunes و App Store", nameEn: "iTunes & App Store", icon: "💳" },
      { slug: "google-play-cards", nameAr: "كروت Google Play", nameEn: "Google Play cards", icon: "💳" },
      { slug: "nintendo-eshop", nameAr: "Nintendo eShop", nameEn: "Nintendo eShop", icon: "💳" },
      { slug: "razer-gold", nameAr: "Razer Gold", nameEn: "Razer Gold", icon: "💳" },
      { slug: "roblox-cards", nameAr: "Roblox و Robux", nameEn: "Roblox & Robux", icon: "💳" },
      { slug: "amazon-cards", nameAr: "كروت Amazon", nameEn: "Amazon gift cards", icon: "💳" },
    ],
  },
  {
    slug: "game-topup", nameAr: "شحن ألعاب", nameEn: "Game top-up", icon: "💎", commissionBps: 700,
    children: [
      { slug: "pubg-uc", nameAr: "شدات ببجي UC", nameEn: "PUBG Mobile UC", icon: "💎" },
      { slug: "free-fire-diamonds", nameAr: "جواهر فري فاير", nameEn: "Free Fire diamonds", icon: "💎" },
      { slug: "fortnite-vbucks", nameAr: "Fortnite V-Bucks", nameEn: "Fortnite V-Bucks", icon: "💎" },
      { slug: "valorant-points", nameAr: "Valorant Points", nameEn: "Valorant Points", icon: "💎" },
      { slug: "cod-points", nameAr: "Call of Duty CP", nameEn: "Call of Duty Points", icon: "💎" },
      { slug: "genshin-crystals", nameAr: "Genshin Impact", nameEn: "Genshin Impact", icon: "💎" },
      { slug: "fc-points", nameAr: "EA FC Points", nameEn: "EA FC Points", icon: "💎" },
    ],
  },
  {
    slug: "game-accounts", nameAr: "حسابات ألعاب", nameEn: "Game accounts", icon: "🕹️", commissionBps: 1000,
    children: [
      { slug: "steam-accounts", nameAr: "حسابات Steam", nameEn: "Steam accounts", icon: "🕹️" },
      { slug: "playstation-accounts", nameAr: "حسابات PlayStation", nameEn: "PlayStation accounts", icon: "🕹️" },
      { slug: "xbox-game-pass", nameAr: "Xbox Game Pass", nameEn: "Xbox Game Pass", icon: "🕹️" },
      { slug: "ps-plus", nameAr: "PlayStation Plus", nameEn: "PlayStation Plus", icon: "🕹️" },
      { slug: "fortnite-accounts", nameAr: "حسابات Fortnite", nameEn: "Fortnite accounts", icon: "🕹️" },
      { slug: "other-game-accounts", nameAr: "حسابات ألعاب تانية", nameEn: "Other game accounts", icon: "🕹️" },
    ],
  },
  {
    slug: "ai", nameAr: "أدوات الذكاء الاصطناعي", nameEn: "AI tools", icon: "🤖", commissionBps: 1000,
    children: [
      { slug: "chatgpt", nameAr: "ChatGPT", nameEn: "ChatGPT", icon: "🤖" },
      { slug: "gemini", nameAr: "Gemini", nameEn: "Gemini", icon: "🤖" },
      { slug: "claude-ai", nameAr: "Claude", nameEn: "Claude", icon: "🤖" },
      { slug: "midjourney", nameAr: "Midjourney", nameEn: "Midjourney", icon: "🤖" },
      { slug: "perplexity", nameAr: "Perplexity", nameEn: "Perplexity", icon: "🤖" },
      { slug: "copilot", nameAr: "Copilot", nameEn: "Copilot", icon: "🤖" },
    ],
  },
  {
    slug: "productivity", nameAr: "برامج وإنتاجية", nameEn: "Software & productivity", icon: "💼", commissionBps: 1000,
    children: [
      { slug: "windows", nameAr: "ويندوز", nameEn: "Windows", icon: "🪟" },
      { slug: "microsoft-office", nameAr: "مايكروسوفت أوفيس", nameEn: "Microsoft Office", icon: "📊" },
      { slug: "antivirus", nameAr: "برامج حماية", nameEn: "Antivirus", icon: "🛡️" },
      { slug: "pc-utilities", nameAr: "أدوات الكمبيوتر", nameEn: "PC utilities", icon: "🧰" },
      { slug: "cloud-storage", nameAr: "تخزين سحابي", nameEn: "Cloud storage", icon: "☁️" },
    ],
  },
  {
    slug: "design", nameAr: "تصميم ومونتاج", nameEn: "Design & video", icon: "🎨", commissionBps: 1500,
    children: [
      { slug: "adobe", nameAr: "Adobe", nameEn: "Adobe", icon: "🎨" },
      { slug: "canva", nameAr: "Canva", nameEn: "Canva", icon: "🎨" },
      { slug: "capcut", nameAr: "CapCut", nameEn: "CapCut", icon: "🎬" },
      { slug: "stock-assets", nameAr: "صور وقوالب جاهزة", nameEn: "Stock assets", icon: "🖼️" },
    ],
  },
  {
    slug: "streaming", nameAr: "ترفيه ومشاهدة", nameEn: "Streaming", icon: "🎬", commissionBps: 1500,
    children: [
      { slug: "netflix", nameAr: "Netflix", nameEn: "Netflix", icon: "🎬" },
      { slug: "shahid", nameAr: "شاهد VIP", nameEn: "Shahid VIP", icon: "🎬" },
      { slug: "spotify", nameAr: "Spotify", nameEn: "Spotify", icon: "🎧" },
      { slug: "anghami", nameAr: "أنغامي", nameEn: "Anghami", icon: "🎧" },
      { slug: "youtube-premium", nameAr: "YouTube Premium", nameEn: "YouTube Premium", icon: "▶️" },
      { slug: "disney-plus", nameAr: "Disney+", nameEn: "Disney+", icon: "🎬" },
      { slug: "prime-video", nameAr: "Prime Video", nameEn: "Prime Video", icon: "🎬" },
      { slug: "osn-plus", nameAr: "OSN+", nameEn: "OSN+", icon: "🎬" },
    ],
  },
  {
    slug: "social-media", nameAr: "سوشيال ميديا", nameEn: "Social media", icon: "📣", commissionBps: 1000,
    children: [
      { slug: "telegram-premium", nameAr: "تيليجرام بريميوم", nameEn: "Telegram Premium", icon: "✈️" },
      { slug: "telegram-stars", nameAr: "نجوم تيليجرام", nameEn: "Telegram Stars", icon: "⭐" },
      { slug: "discord-nitro", nameAr: "Discord Nitro", nameEn: "Discord Nitro", icon: "💬" },
      { slug: "tiktok-coins", nameAr: "عملات تيك توك", nameEn: "TikTok coins", icon: "🎵" },
      { slug: "snapchat-plus", nameAr: "Snapchat+", nameEn: "Snapchat+", icon: "👻" },
      { slug: "x-premium", nameAr: "X Premium", nameEn: "X Premium", icon: "✖️" },
    ],
  },
  {
    slug: "mobile", nameAr: "تطبيقات موبايل", nameEn: "Mobile apps", icon: "📲", commissionBps: 1000,
    children: [
      { slug: "android-apps", nameAr: "تطبيقات أندرويد", nameEn: "Android apps", icon: "🤖" },
      { slug: "ios-apps", nameAr: "تطبيقات آيفون", nameEn: "iOS apps", icon: "🍎" },
    ],
  },
  {
    slug: "learning", nameAr: "تعليم وكورسات", nameEn: "Learning", icon: "🎓", commissionBps: 1000,
    children: [
      { slug: "coursera", nameAr: "Coursera", nameEn: "Coursera", icon: "🎓" },
      { slug: "udemy", nameAr: "Udemy", nameEn: "Udemy", icon: "🎓" },
      { slug: "linkedin-learning", nameAr: "LinkedIn Learning", nameEn: "LinkedIn Learning", icon: "🎓" },
      { slug: "language-learning", nameAr: "تعلم لغات", nameEn: "Language learning", icon: "🗣️" },
      { slug: "ebooks", nameAr: "كتب إلكترونية", nameEn: "E-books", icon: "📚" },
    ],
  },
  {
    slug: "vpn", nameAr: "VPN وأمان", nameEn: "VPN & security", icon: "🔐", commissionBps: 300,
    children: [
      { slug: "nordvpn", nameAr: "NordVPN", nameEn: "NordVPN", icon: "🔐" },
      { slug: "expressvpn", nameAr: "ExpressVPN", nameEn: "ExpressVPN", icon: "🔐" },
      { slug: "surfshark", nameAr: "Surfshark", nameEn: "Surfshark", icon: "🔐" },
      { slug: "proton-vpn", nameAr: "Proton VPN", nameEn: "Proton VPN", icon: "🔐" },
      { slug: "password-managers", nameAr: "مديري الباسوردات", nameEn: "Password managers", icon: "🔑" },
    ],
  },
];
