# ديجي مصر (Digiegy)

سوق مصري متعدد التجار للمنتجات الرقمية فقط (اشتراكات، حسابات، برامج ومفاتيح تفعيل)، مع توثيق هوية إلزامي للتجار (KYC).

A multi-vendor marketplace for digital products in Egypt, with mandatory seller KYC.

## التشغيل محلياً

المتطلبات: Node.js 20+ و PostgreSQL.

```bash
cp .env.example .env        # عدّل DATABASE_URL و AUTH_SECRET
npm install
npm run db:migrate          # ينشئ الجداول
npm run db:seed             # أقسام + حسابات تجريبية
npm run dev
```

حسابات تجريبية بعد الـ seed (الباسورد `password123`):

| الدور | الإيميل |
| --- | --- |
| أدمن | admin@digiegy.test |
| تاجر موثّق | seller@digiegy.test |
| مشتري | buyer@digiegy.test |

## التقنيات

Next.js (App Router) · TypeScript · Tailwind CSS · PostgreSQL · Prisma

## ملاحظات على التصميم

- الفلوس محفوظة كأرقام صحيحة بالقرش (1 ج.م = 100 قرش).
- العمولة بتتحدد لكل قسم (basis points: 1000 = 10%) وبتتثبّت على الطلب وقت الشراء.
- رصيد التاجر بيتحسب من دفتر حركات (`LedgerEntry`). الحركة بتبقى "قابلة للسحب" بعد `availableAt`، والمدة أقصر للشركات من الأفراد (`src/lib/config.ts`).
- مستندات الـ KYC بتتحفظ في تخزين خاص (`STORAGE_DIR` محلياً، و Cloudflare R2 في الإنتاج) ومحدش يقدر يفتحها غير الأدمن.
