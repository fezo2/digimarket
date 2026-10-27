-- Category artwork, and the full storefront category tree (prisma/category-tree.ts).
-- Existing categories keep their names and commission; they only get artwork and a new position.
ALTER TABLE "Category" ADD COLUMN "imageUrl" TEXT;

INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder") VALUES ('cat_games', 'games', 'ألعاب', 'Games', '🎮', '/categories/games.svg', 1000, 0)
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl", "sortOrder" = EXCLUDED."sortOrder";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder") VALUES ('cat_gift-cards', 'gift-cards', 'كروت شحن وهدايا', 'Gift cards', '🎁', '/categories/gift-cards.svg', 500, 1)
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl", "sortOrder" = EXCLUDED."sortOrder";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder") VALUES ('cat_game-topup', 'game-topup', 'شحن ألعاب', 'Game top-up', '💎', '/categories/game-topup.svg', 700, 2)
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl", "sortOrder" = EXCLUDED."sortOrder";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder") VALUES ('cat_game-accounts', 'game-accounts', 'حسابات ألعاب', 'Game accounts', '🕹️', '/categories/game-accounts.svg', 1000, 3)
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl", "sortOrder" = EXCLUDED."sortOrder";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder") VALUES ('cat_ai', 'ai', 'أدوات الذكاء الاصطناعي', 'AI tools', '🤖', '/categories/ai.svg', 1000, 4)
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl", "sortOrder" = EXCLUDED."sortOrder";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder") VALUES ('cat_productivity', 'productivity', 'برامج وإنتاجية', 'Software & productivity', '💼', '/categories/productivity.svg', 1000, 5)
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl", "sortOrder" = EXCLUDED."sortOrder";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder") VALUES ('cat_design', 'design', 'تصميم ومونتاج', 'Design & video', '🎨', '/categories/design.svg', 1500, 6)
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl", "sortOrder" = EXCLUDED."sortOrder";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder") VALUES ('cat_streaming', 'streaming', 'ترفيه ومشاهدة', 'Streaming', '🎬', '/categories/streaming.svg', 1500, 7)
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl", "sortOrder" = EXCLUDED."sortOrder";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder") VALUES ('cat_social-media', 'social-media', 'سوشيال ميديا', 'Social media', '📣', '/categories/social-media.svg', 1000, 8)
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl", "sortOrder" = EXCLUDED."sortOrder";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder") VALUES ('cat_mobile', 'mobile', 'تطبيقات موبايل', 'Mobile apps', '📲', '/categories/mobile.svg', 1000, 9)
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl", "sortOrder" = EXCLUDED."sortOrder";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder") VALUES ('cat_learning', 'learning', 'تعليم وكورسات', 'Learning', '🎓', '/categories/learning.svg', 1000, 10)
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl", "sortOrder" = EXCLUDED."sortOrder";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder") VALUES ('cat_vpn', 'vpn', 'VPN وأمان', 'VPN & security', '🔐', '/categories/vpn.svg', 300, 11)
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl", "sortOrder" = EXCLUDED."sortOrder";

INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_steam-games', 'steam-games', 'ألعاب Steam', 'Steam games', '🎮', '/categories/steam-games.svg', p."commissionBps", 0, p."id" FROM "Category" p WHERE p."slug" = 'games'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_playstation-games', 'playstation-games', 'ألعاب PlayStation', 'PlayStation games', '🎮', '/categories/playstation-games.svg', p."commissionBps", 1, p."id" FROM "Category" p WHERE p."slug" = 'games'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_xbox-games', 'xbox-games', 'ألعاب Xbox', 'Xbox games', '🎮', '/categories/xbox-games.svg', p."commissionBps", 2, p."id" FROM "Category" p WHERE p."slug" = 'games'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_nintendo-games', 'nintendo-games', 'ألعاب Nintendo', 'Nintendo games', '🎮', '/categories/nintendo-games.svg', p."commissionBps", 3, p."id" FROM "Category" p WHERE p."slug" = 'games'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_epic-games', 'epic-games', 'Epic Games', 'Epic Games', '🎮', '/categories/epic-games.svg', p."commissionBps", 4, p."id" FROM "Category" p WHERE p."slug" = 'games'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_ea-app-games', 'ea-app-games', 'EA app', 'EA app', '🎮', '/categories/ea-app-games.svg', p."commissionBps", 5, p."id" FROM "Category" p WHERE p."slug" = 'games'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_ubisoft-games', 'ubisoft-games', 'Ubisoft Connect', 'Ubisoft Connect', '🎮', '/categories/ubisoft-games.svg', p."commissionBps", 6, p."id" FROM "Category" p WHERE p."slug" = 'games'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_battle-net-games', 'battle-net-games', 'Battle.net', 'Battle.net', '🎮', '/categories/battle-net-games.svg', p."commissionBps", 7, p."id" FROM "Category" p WHERE p."slug" = 'games'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_steam-wallet', 'steam-wallet', 'رصيد Steam', 'Steam Wallet', '💳', '/categories/steam-wallet.svg', p."commissionBps", 0, p."id" FROM "Category" p WHERE p."slug" = 'gift-cards'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_psn-cards', 'psn-cards', 'كروت PlayStation', 'PlayStation Store cards', '💳', '/categories/psn-cards.svg', p."commissionBps", 1, p."id" FROM "Category" p WHERE p."slug" = 'gift-cards'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_xbox-cards', 'xbox-cards', 'كروت Xbox', 'Xbox gift cards', '💳', '/categories/xbox-cards.svg', p."commissionBps", 2, p."id" FROM "Category" p WHERE p."slug" = 'gift-cards'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_itunes-cards', 'itunes-cards', 'iTunes و App Store', 'iTunes & App Store', '💳', '/categories/itunes-cards.svg', p."commissionBps", 3, p."id" FROM "Category" p WHERE p."slug" = 'gift-cards'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_google-play-cards', 'google-play-cards', 'كروت Google Play', 'Google Play cards', '💳', '/categories/google-play-cards.svg', p."commissionBps", 4, p."id" FROM "Category" p WHERE p."slug" = 'gift-cards'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_nintendo-eshop', 'nintendo-eshop', 'Nintendo eShop', 'Nintendo eShop', '💳', '/categories/nintendo-eshop.svg', p."commissionBps", 5, p."id" FROM "Category" p WHERE p."slug" = 'gift-cards'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_razer-gold', 'razer-gold', 'Razer Gold', 'Razer Gold', '💳', '/categories/razer-gold.svg', p."commissionBps", 6, p."id" FROM "Category" p WHERE p."slug" = 'gift-cards'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_roblox-cards', 'roblox-cards', 'Roblox و Robux', 'Roblox & Robux', '💳', '/categories/roblox-cards.svg', p."commissionBps", 7, p."id" FROM "Category" p WHERE p."slug" = 'gift-cards'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_amazon-cards', 'amazon-cards', 'كروت Amazon', 'Amazon gift cards', '💳', '/categories/amazon-cards.svg', p."commissionBps", 8, p."id" FROM "Category" p WHERE p."slug" = 'gift-cards'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_pubg-uc', 'pubg-uc', 'شدات ببجي UC', 'PUBG Mobile UC', '💎', '/categories/pubg-uc.svg', p."commissionBps", 0, p."id" FROM "Category" p WHERE p."slug" = 'game-topup'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_free-fire-diamonds', 'free-fire-diamonds', 'جواهر فري فاير', 'Free Fire diamonds', '💎', '/categories/free-fire-diamonds.svg', p."commissionBps", 1, p."id" FROM "Category" p WHERE p."slug" = 'game-topup'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_fortnite-vbucks', 'fortnite-vbucks', 'Fortnite V-Bucks', 'Fortnite V-Bucks', '💎', '/categories/fortnite-vbucks.svg', p."commissionBps", 2, p."id" FROM "Category" p WHERE p."slug" = 'game-topup'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_valorant-points', 'valorant-points', 'Valorant Points', 'Valorant Points', '💎', '/categories/valorant-points.svg', p."commissionBps", 3, p."id" FROM "Category" p WHERE p."slug" = 'game-topup'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_cod-points', 'cod-points', 'Call of Duty CP', 'Call of Duty Points', '💎', '/categories/cod-points.svg', p."commissionBps", 4, p."id" FROM "Category" p WHERE p."slug" = 'game-topup'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_genshin-crystals', 'genshin-crystals', 'Genshin Impact', 'Genshin Impact', '💎', '/categories/genshin-crystals.svg', p."commissionBps", 5, p."id" FROM "Category" p WHERE p."slug" = 'game-topup'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_fc-points', 'fc-points', 'EA FC Points', 'EA FC Points', '💎', '/categories/fc-points.svg', p."commissionBps", 6, p."id" FROM "Category" p WHERE p."slug" = 'game-topup'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_steam-accounts', 'steam-accounts', 'حسابات Steam', 'Steam accounts', '🕹️', '/categories/steam-accounts.svg', p."commissionBps", 0, p."id" FROM "Category" p WHERE p."slug" = 'game-accounts'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_playstation-accounts', 'playstation-accounts', 'حسابات PlayStation', 'PlayStation accounts', '🕹️', '/categories/playstation-accounts.svg', p."commissionBps", 1, p."id" FROM "Category" p WHERE p."slug" = 'game-accounts'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_xbox-game-pass', 'xbox-game-pass', 'Xbox Game Pass', 'Xbox Game Pass', '🕹️', '/categories/xbox-game-pass.svg', p."commissionBps", 2, p."id" FROM "Category" p WHERE p."slug" = 'game-accounts'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_ps-plus', 'ps-plus', 'PlayStation Plus', 'PlayStation Plus', '🕹️', '/categories/ps-plus.svg', p."commissionBps", 3, p."id" FROM "Category" p WHERE p."slug" = 'game-accounts'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_fortnite-accounts', 'fortnite-accounts', 'حسابات Fortnite', 'Fortnite accounts', '🕹️', '/categories/fortnite-accounts.svg', p."commissionBps", 4, p."id" FROM "Category" p WHERE p."slug" = 'game-accounts'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_other-game-accounts', 'other-game-accounts', 'حسابات ألعاب تانية', 'Other game accounts', '🕹️', '/categories/other-game-accounts.svg', p."commissionBps", 5, p."id" FROM "Category" p WHERE p."slug" = 'game-accounts'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_chatgpt', 'chatgpt', 'ChatGPT', 'ChatGPT', '🤖', '/categories/chatgpt.svg', p."commissionBps", 0, p."id" FROM "Category" p WHERE p."slug" = 'ai'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_gemini', 'gemini', 'Gemini', 'Gemini', '🤖', '/categories/gemini.svg', p."commissionBps", 1, p."id" FROM "Category" p WHERE p."slug" = 'ai'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_claude-ai', 'claude-ai', 'Claude', 'Claude', '🤖', '/categories/claude-ai.svg', p."commissionBps", 2, p."id" FROM "Category" p WHERE p."slug" = 'ai'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_midjourney', 'midjourney', 'Midjourney', 'Midjourney', '🤖', '/categories/midjourney.svg', p."commissionBps", 3, p."id" FROM "Category" p WHERE p."slug" = 'ai'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_perplexity', 'perplexity', 'Perplexity', 'Perplexity', '🤖', '/categories/perplexity.svg', p."commissionBps", 4, p."id" FROM "Category" p WHERE p."slug" = 'ai'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_copilot', 'copilot', 'Copilot', 'Copilot', '🤖', '/categories/copilot.svg', p."commissionBps", 5, p."id" FROM "Category" p WHERE p."slug" = 'ai'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_windows', 'windows', 'ويندوز', 'Windows', '🪟', '/categories/windows.svg', p."commissionBps", 0, p."id" FROM "Category" p WHERE p."slug" = 'productivity'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_microsoft-office', 'microsoft-office', 'مايكروسوفت أوفيس', 'Microsoft Office', '📊', '/categories/microsoft-office.svg', p."commissionBps", 1, p."id" FROM "Category" p WHERE p."slug" = 'productivity'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_antivirus', 'antivirus', 'برامج حماية', 'Antivirus', '🛡️', '/categories/antivirus.svg', p."commissionBps", 2, p."id" FROM "Category" p WHERE p."slug" = 'productivity'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_pc-utilities', 'pc-utilities', 'أدوات الكمبيوتر', 'PC utilities', '🧰', '/categories/pc-utilities.svg', p."commissionBps", 3, p."id" FROM "Category" p WHERE p."slug" = 'productivity'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_cloud-storage', 'cloud-storage', 'تخزين سحابي', 'Cloud storage', '☁️', '/categories/cloud-storage.svg', p."commissionBps", 4, p."id" FROM "Category" p WHERE p."slug" = 'productivity'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_adobe', 'adobe', 'Adobe', 'Adobe', '🎨', '/categories/adobe.svg', p."commissionBps", 0, p."id" FROM "Category" p WHERE p."slug" = 'design'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_canva', 'canva', 'Canva', 'Canva', '🎨', '/categories/canva.svg', p."commissionBps", 1, p."id" FROM "Category" p WHERE p."slug" = 'design'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_capcut', 'capcut', 'CapCut', 'CapCut', '🎬', '/categories/capcut.svg', p."commissionBps", 2, p."id" FROM "Category" p WHERE p."slug" = 'design'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_stock-assets', 'stock-assets', 'صور وقوالب جاهزة', 'Stock assets', '🖼️', '/categories/stock-assets.svg', p."commissionBps", 3, p."id" FROM "Category" p WHERE p."slug" = 'design'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_netflix', 'netflix', 'Netflix', 'Netflix', '🎬', '/categories/netflix.svg', p."commissionBps", 0, p."id" FROM "Category" p WHERE p."slug" = 'streaming'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_shahid', 'shahid', 'شاهد VIP', 'Shahid VIP', '🎬', '/categories/shahid.svg', p."commissionBps", 1, p."id" FROM "Category" p WHERE p."slug" = 'streaming'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_spotify', 'spotify', 'Spotify', 'Spotify', '🎧', '/categories/spotify.svg', p."commissionBps", 2, p."id" FROM "Category" p WHERE p."slug" = 'streaming'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_anghami', 'anghami', 'أنغامي', 'Anghami', '🎧', '/categories/anghami.svg', p."commissionBps", 3, p."id" FROM "Category" p WHERE p."slug" = 'streaming'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_youtube-premium', 'youtube-premium', 'YouTube Premium', 'YouTube Premium', '▶️', '/categories/youtube-premium.svg', p."commissionBps", 4, p."id" FROM "Category" p WHERE p."slug" = 'streaming'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_disney-plus', 'disney-plus', 'Disney+', 'Disney+', '🎬', '/categories/disney-plus.svg', p."commissionBps", 5, p."id" FROM "Category" p WHERE p."slug" = 'streaming'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_prime-video', 'prime-video', 'Prime Video', 'Prime Video', '🎬', '/categories/prime-video.svg', p."commissionBps", 6, p."id" FROM "Category" p WHERE p."slug" = 'streaming'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_osn-plus', 'osn-plus', 'OSN+', 'OSN+', '🎬', '/categories/osn-plus.svg', p."commissionBps", 7, p."id" FROM "Category" p WHERE p."slug" = 'streaming'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_telegram-premium', 'telegram-premium', 'تيليجرام بريميوم', 'Telegram Premium', '✈️', '/categories/telegram-premium.svg', p."commissionBps", 0, p."id" FROM "Category" p WHERE p."slug" = 'social-media'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_telegram-stars', 'telegram-stars', 'نجوم تيليجرام', 'Telegram Stars', '⭐', '/categories/telegram-stars.svg', p."commissionBps", 1, p."id" FROM "Category" p WHERE p."slug" = 'social-media'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_discord-nitro', 'discord-nitro', 'Discord Nitro', 'Discord Nitro', '💬', '/categories/discord-nitro.svg', p."commissionBps", 2, p."id" FROM "Category" p WHERE p."slug" = 'social-media'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_tiktok-coins', 'tiktok-coins', 'عملات تيك توك', 'TikTok coins', '🎵', '/categories/tiktok-coins.svg', p."commissionBps", 3, p."id" FROM "Category" p WHERE p."slug" = 'social-media'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_snapchat-plus', 'snapchat-plus', 'Snapchat+', 'Snapchat+', '👻', '/categories/snapchat-plus.svg', p."commissionBps", 4, p."id" FROM "Category" p WHERE p."slug" = 'social-media'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_x-premium', 'x-premium', 'X Premium', 'X Premium', '✖️', '/categories/x-premium.svg', p."commissionBps", 5, p."id" FROM "Category" p WHERE p."slug" = 'social-media'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_android-apps', 'android-apps', 'تطبيقات أندرويد', 'Android apps', '🤖', '/categories/android-apps.svg', p."commissionBps", 0, p."id" FROM "Category" p WHERE p."slug" = 'mobile'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_ios-apps', 'ios-apps', 'تطبيقات آيفون', 'iOS apps', '🍎', '/categories/ios-apps.svg', p."commissionBps", 1, p."id" FROM "Category" p WHERE p."slug" = 'mobile'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_coursera', 'coursera', 'Coursera', 'Coursera', '🎓', '/categories/coursera.svg', p."commissionBps", 0, p."id" FROM "Category" p WHERE p."slug" = 'learning'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_udemy', 'udemy', 'Udemy', 'Udemy', '🎓', '/categories/udemy.svg', p."commissionBps", 1, p."id" FROM "Category" p WHERE p."slug" = 'learning'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_linkedin-learning', 'linkedin-learning', 'LinkedIn Learning', 'LinkedIn Learning', '🎓', '/categories/linkedin-learning.svg', p."commissionBps", 2, p."id" FROM "Category" p WHERE p."slug" = 'learning'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_language-learning', 'language-learning', 'تعلم لغات', 'Language learning', '🗣️', '/categories/language-learning.svg', p."commissionBps", 3, p."id" FROM "Category" p WHERE p."slug" = 'learning'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_ebooks', 'ebooks', 'كتب إلكترونية', 'E-books', '📚', '/categories/ebooks.svg', p."commissionBps", 4, p."id" FROM "Category" p WHERE p."slug" = 'learning'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_nordvpn', 'nordvpn', 'NordVPN', 'NordVPN', '🔐', '/categories/nordvpn.svg', p."commissionBps", 0, p."id" FROM "Category" p WHERE p."slug" = 'vpn'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_expressvpn', 'expressvpn', 'ExpressVPN', 'ExpressVPN', '🔐', '/categories/expressvpn.svg', p."commissionBps", 1, p."id" FROM "Category" p WHERE p."slug" = 'vpn'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_surfshark', 'surfshark', 'Surfshark', 'Surfshark', '🔐', '/categories/surfshark.svg', p."commissionBps", 2, p."id" FROM "Category" p WHERE p."slug" = 'vpn'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_proton-vpn', 'proton-vpn', 'Proton VPN', 'Proton VPN', '🔐', '/categories/proton-vpn.svg', p."commissionBps", 3, p."id" FROM "Category" p WHERE p."slug" = 'vpn'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
INSERT INTO "Category" ("id", "slug", "nameAr", "nameEn", "icon", "imageUrl", "commissionBps", "sortOrder", "parentId") SELECT 'cat_password-managers', 'password-managers', 'مديري الباسوردات', 'Password managers', '🔑', '/categories/password-managers.svg', p."commissionBps", 4, p."id" FROM "Category" p WHERE p."slug" = 'vpn'
  ON CONFLICT ("slug") DO UPDATE SET "imageUrl" = EXCLUDED."imageUrl";
