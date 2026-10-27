// Development data: categories with commission rates, an admin, and one verified demo seller.
import { PrismaClient, type DeliveryType } from "@prisma/client";
import bcrypt from "bcryptjs";
import { CATEGORY_TREE } from "./category-tree";

const db = new PrismaClient();


const PRODUCTS: {
  category: string;
  title: string;
  price: number;
  compareAt?: number;
  delivery: DeliveryType;
  sold: number;
  description: string;
}[] = [
  { category: "ai", title: "ChatGPT Plus — شهر | حساب خاص", price: 45000, compareAt: 55000, delivery: "UNIQUE_CODES", sold: 94, description: "حساب ChatGPT Plus خاص بيك لمدة شهر.\nالتسليم فوري بعد الدفع، وضمان طول مدة الاشتراك." },
  { category: "ai", title: "Gemini AI Pro — 6 شهور + 5TB تخزين", price: 16000, delivery: "LINK", sold: 127, description: "رابط تفعيل Gemini AI Pro لمدة 6 شهور مع مساحة 5 تيرا على Google One." },
  { category: "ai", title: "Perplexity Pro — سنة | ضمان كامل", price: 55000, delivery: "UNIQUE_CODES", sold: 12, description: "كود تفعيل Perplexity Pro لمدة 12 شهر." },
  { category: "design", title: "CapCut Pro — شهر | جهازين", price: 11000, delivery: "UNIQUE_CODES", sold: 28, description: "حساب CapCut Pro لمدة 30 يوم، يشتغل على جهازين." },
  { category: "design", title: "Canva Pro — سنة | دعوة لفريق", price: 15000, delivery: "TEXT", sold: 40, description: "اشتراك Canva Pro سنة كاملة عن طريق دعوة على إيميلك." },
  { category: "productivity", title: "Microsoft Office 365 Plus — سنة | 5 أجهزة", price: 16000, delivery: "UNIQUE_CODES", sold: 3, description: "اشتراك Microsoft 365 لمدة سنة على 5 أجهزة." },
  { category: "learning", title: "Coursera Plus — 12 شهر | حساب خاص", price: 21000, delivery: "UNIQUE_CODES", sold: 3, description: "حساب Coursera Plus خاص لمدة سنة." },
  { category: "vpn", title: "Express VPN — شهر | مفتاح عالمي", price: 11300, delivery: "UNIQUE_CODES", sold: 1, description: "مفتاح Express VPN لمدة شهر، يشتغل في كل الدول." },
];

async function main() {
  for (const [i, { children, ...c }] of CATEGORY_TREE.entries()) {
    const imageUrl = `/categories/${c.slug}.svg`;
    const parent = await db.category.upsert({
      where: { slug: c.slug },
      update: { imageUrl, sortOrder: i },
      create: { ...c, imageUrl, sortOrder: i },
    });
    for (const [j, s] of children.entries()) {
      await db.category.upsert({
        where: { slug: s.slug },
        update: { imageUrl: `/categories/${s.slug}.svg` },
        create: {
          ...s,
          imageUrl: `/categories/${s.slug}.svg`,
          parentId: parent.id,
          commissionBps: c.commissionBps,
          sortOrder: j,
        },
      });
    }
  }

  const password = await bcrypt.hash("password123", 12);
  await db.user.upsert({
    where: { email: "admin@digiegy.test" },
    update: {},
    create: { email: "admin@digiegy.test", name: "الإدارة", role: "ADMIN", passwordHash: password },
  });

  const sellerUser = await db.user.upsert({
    where: { email: "seller@digiegy.test" },
    update: {},
    create: { email: "seller@digiegy.test", name: "تاجر تجريبي", role: "SELLER", passwordHash: password },
  });
  const seller = await db.sellerProfile.upsert({
    where: { userId: sellerUser.id },
    update: {},
    create: {
      userId: sellerUser.id,
      storeName: "CloudCart",
      slug: "cloudcart",
      type: "COMPANY",
      kycStatus: "APPROVED",
      verifiedAt: new Date(),
      description: "اشتراكات AI وبرامج أصلية بتسليم فوري.",
      businessHours: "يومياً من 10 ص لـ 12 م",
    },
  });

  await db.user.upsert({
    where: { email: "buyer@digiegy.test" },
    update: {},
    create: { email: "buyer@digiegy.test", name: "مشتري تجريبي", passwordHash: password },
  });

  for (const [i, p] of PRODUCTS.entries()) {
    const category = await db.category.findUniqueOrThrow({ where: { slug: p.category } });
    const slug = `demo-${i + 1}`;
    if (await db.product.findUnique({ where: { slug } })) continue;
    await db.product.create({
      data: {
        slug,
        sellerId: seller.id,
        categoryId: category.id,
        title: p.title,
        description: p.description,
        price: p.price,
        compareAtPrice: p.compareAt,
        deliveryType: p.delivery,
        deliveryContent: p.delivery === "UNIQUE_CODES" ? null : "تفاصيل التفعيل التجريبية",
        status: "ACTIVE",
        soldCount: p.sold,
        stock:
          p.delivery === "UNIQUE_CODES"
            ? { create: Array.from({ length: 5 }, (_, n) => ({ content: `DEMO-${i + 1}-${n + 1}` })) }
            : undefined,
        quantityDiscounts: i === 0 ? { create: [{ minQty: 3, percentOff: 5 }] } : undefined,
        options:
          i === 0
            ? {
                create: [
                  {
                    name: "المدة",
                    values: {
                      create: [
                        { label: "شهر", priceDelta: 0, sortOrder: 0 },
                        { label: "3 شهور", priceDelta: 80000, sortOrder: 1 },
                      ],
                    },
                  },
                ],
              }
            : undefined,
      },
    });
  }
  console.log("Seeded. Logins (password: password123): admin@, seller@, buyer@digiegy.test");
}

main().finally(() => db.$disconnect());
