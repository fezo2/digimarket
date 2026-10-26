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

## الدفع والتسليم

- شغّل `npx prisma migrate deploy` لتطبيق ترحيل `checkout` قبل تشغيل النسخة الجديدة.
- في التطوير، `PAYMENT_PROVIDER=test` بيفتح صفحة دفع تجريبي فيها نجاح وفشل، من غير خصم فلوس. شغّلها بـ `npm run dev`.
- في الإنتاج لازم `PAYMENT_PROVIDER=paymob`. التطبيق بيرفض التشغيل ببوابة الاختبار أو بإعدادات Paymob ناقصة.
- اضبط `PAYMOB_SECRET_KEY` و`PAYMOB_PUBLIC_KEY` و`PAYMOB_HMAC_SECRET` و`PAYMOB_INTEGRATION_IDS` (أرقام تكامل الكارت والمحفظة مفصولة بفواصل) و`APP_URL` برابط HTTPS للموقع. المتغيرات موجودة في `.env.example`.
- رابط الإشعار: `/api/payments/paymob/webhook`، ورابط الرجوع: `/api/payments/paymob/return`. الرجوع للموقع مش إثبات دفع؛ التسليم معتمد على إشعار موثّق بالـ HMAC وربطه برقم طلب Paymob المحفوظ وقت إنشاء الدفع.
- حجز الأكواد مدته 30 دقيقة. الطلبات المنتهية بتتحرر عند طلب شراء جديد أو فتح صفحات الطلبات/المنتج. الدفع المتأخر بيحاول يحجز أكواد متاحة من جديد؛ اختلاف المبلغ أو نقص المخزون بيظهر للإدارة كطلب مدفوع من غير تسليم، من غير إضافة أرباح للتاجر.
- الأسعار والاختيارات والتسليم والعمولة بتتثبت وقت إنشاء الطلب. تعديل الكوبون متاح قبل بدء الدفع فقط، عشان مبلغ صفحة الدفع يفضل مطابق للطلب.
- ملفات التسليم بتفضل في التخزين الخاص، والتنزيل بيتطلب إن المشتري صاحب طلب مدفوع ومتسلّم. تأكد إن `STORAGE_DIR` تخزين دائم في بيئة الاستضافة.

تكامل Paymob مبني على [Intention API](https://developers.paymob.com/paymob-docs/intention-apis/create-intention) و[Transaction callbacks](https://developers.paymob.com/paymob-docs/developers/webhook-callbacks-and-hmac/transaction-callbacks).

## الاختبارات

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

اختبارات التسعير والـ HMAC بتشتغل من غير قاعدة بيانات. لاختبار معاملات الحجز والدفع والتزامن، استخدم قاعدة PostgreSQL اختبار منفصلة بعد تطبيق الترحيلات:

```powershell
$env:TEST_DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/digiegy_test"
npm run test:integration
```

اختبارات التكامل بتنظف بياناتها التجريبية بعد الانتهاء. اختبار Paymob بيحاكي الرد الخارجي وبيختبر الإشعار الموقّع؛ التجربة الفعلية مع البوابة بتحتاج بيانات تكامل Paymob الخاصة بيك.

## ملاحظات على التصميم

- الفلوس محفوظة كأرقام صحيحة بالقرش (1 ج.م = 100 قرش).
- العمولة بتتحدد لكل قسم (basis points: 1000 = 10%) وبتتثبّت على الطلب وقت الشراء.
- رصيد التاجر بيتحسب من دفتر حركات (`LedgerEntry`). الحركة بتبقى "قابلة للسحب" بعد `availableAt`، والمدة أقصر للشركات من الأفراد (`src/lib/config.ts`).
- مستندات الـ KYC بتتحفظ في تخزين خاص (`STORAGE_DIR` محلياً، و Cloudflare R2 في الإنتاج) ومحدش يقدر يفتحها غير الأدمن.
