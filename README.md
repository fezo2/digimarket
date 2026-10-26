# ديجي مصر (Digiegy)

سوق مصري متعدد التجار للمنتجات الرقمية فقط (اشتراكات، حسابات، برامج ومفاتيح تفعيل)، مع توثيق هوية إلزامي للتجار (KYC).

A multi-vendor marketplace for digital products in Egypt, with mandatory seller KYC.

## التشغيل محلياً

المتطلبات: Node.js 20+ و PostgreSQL.

```bash
cp .env.example .env        # عدّل DATABASE_URL و DIRECT_URL و AUTH_SECRET
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


## المحفظة والسحب والاسترداد (المرحلة ٤)

- طبّق ترحيل `wallet_payouts` بـ `npx prisma migrate deploy` قبل تشغيل النسخة الجديدة.
- `/seller/wallet` بيعرض المتاح والمعلّق والإجمالي من دفتر الحركات، وحركات الرصيد ٣٠ في الصفحة. الحساب الكامل ظاهر لصاحبه بس؛ سجل السحب بيعرض آخر ٤ حروف.
- حفظ حساب InstaPay / بنك / محفظة محتاج الباسورد الحالي وبيقفل السحب ٢٤ ساعة. `TEST_PAYOUT_LOCK_MS` بيغيّر المدة فقط لما `NODE_ENV=test`؛ مالوش تأثير في التطوير أو الإنتاج.
- طلب السحب بيخصم المتاح فورًا. الإدارة بتحوّل الفلوس خارج الموقع، وبعدين تسجّل المرجع في `/admin/payouts`. الرفض بيضيف حركة عكسية؛ تأكيد الدفع مش بيخصم تاني.
- `/admin/orders?review=1` بيعرض الطلبات المدفوعة اللي متسلّمتش وسبب المراجعة. إعادة التسليم بتراجع المبلغ المدفوع والمخزون والكوبون، ومش بتضيف أرباح مرتين.
- زر «تم رد الفلوس للمشتري» لتسجيل استرداد اتعمل بالفعل خارج الموقع. بيضيف حركة استرداد بتاريخ إتاحة أرباح البيع الأصلي؛ الأكواد المباعة بتفضل مباعة ومحتوى الطلب بيختفي من صفحة المشتري والتنزيل. استرداد بعد السحب ممكن يخلي المتاح سالب.
- `/admin/sellers` بيوصل لدفتر كل تاجر وآخر ٥٠ حركة. التسوية اليدوية محتاجة سبب وباسورد الأدمن، وبتضيف حركة جديدة من غير تعديل القديم.
- الحسابات القديمة في طلبات السحب مالهاش اسم صاحب حساب موثّق في الطلب نفسه؛ الاسم بيتساب فاضي والإدارة لازم تراجعه. الطلبات المدفوعة قبل الترحيل مالهاش `paidAmount` محفوظ: إعادة تسليم طلب قديم متوقف بترفض التخمين وبتوضح إن المبلغ مش مسجل.
- اختبارات PostgreSQL بتغطي حدود السحب وقفل الحساب، التزامن ومنع طلبين مفتوحين، عكس الرفض، عدم تكرار الدفع أو الاسترداد أو التسليم، استرداد الأرباح المعلّقة، الرصيد السالب، وإخفاء بيانات الحساب من سجل التدقيق. تغيير `availableAt` في الاختبار فقط بيحاكي انتهاء فترة التعليق؛ كود التطبيق لا يعدّل ولا يحذف حركات قديمة.


## الشات والتقييمات والشكاوى (المرحلة ٥)

- طبّق ترحيل `chat_reviews_disputes` بـ `npx prisma migrate deploy`. الترحيل بيحسب عدادات التقييمات القديمة وبيمنع أكتر من شكوى مفتوحة لنفس العنصر بفهرس جزئي فريد.
- الشات للطلب المدفوع أو المسترد فقط: المشتري، تاجر الطلب، والإدارة. الإرسال لمدة ٣٠ يوم من الدفع، أو طول ما فيه شكوى مفتوحة؛ القراءة بتفضل متاحة. التحديث كل ١٠ ثواني في التبويب الظاهر، وبيقف بعد ٣٠ دقيقة خمول.
- الرسائل نص عادي، وأرقام الموبايل وروابط واتساب وتليجرام بتتخفى مع علامة للإدارة؛ الإيميلات بتفضل عشان بيانات تسجيل الدخول. الحد ٢٠ رسالة للشخص في الطلب خلال ١٠ دقايق، داخل معاملة قاعدة البيانات.
- الصور JPG / PNG / WEBP لحد ٥ ميجا في التخزين الخاص. صورة الشكوى بتتحفظ مع رسالة فتح الشكوى في الشات. رابط تنزيل الصورة بيتحقق من صاحب الجلسة في كل طلب، من غير كشف مفتاح التخزين أو تخزين الرد في الكاش.
- المشتري يقيّم خلال ٣٠ يوم من التسليم، ويعدّل مرة خلال ٧ أيام من إنشاء التقييم. التاجر يرد مرة واحدة، بما فيها الردود القديمة. الإخفاء والإظهار والاسترداد بيعدّلوا عدادات المنتج والمتجر في نفس المعاملة؛ التقييم المسترد ماينفعش يظهر تاني.
- الشكوى خلال ٧ أيام من التسليم. الأرباح المتاحة للعنصر بتتجمّد لحد الإغلاق أو قرار الإدارة، والمتاح للسحب في المحفظة بيخصم التجميد. فحص السحب جوه قفل التاجر الحالي؛ مفيش رصيد مخزّن أو تعديل لحركة مالية قديمة.
- رد الفلوس من الشكوى بيسجل استرداد اتعمل خارج الموقع، باستخدام نفس `refundOrder` من المرحلة ٤، في معاملة واحدة مع قرار الشكوى والتدقيق ورسالة النظام. رفض الشكوى أو إغلاقها من المشتري بيفك التجميد تلقائياً.
- اختبارات التكامل بتغطي الصلاحيات والصور الخاصة، حد الرسائل والتزامن، عدادات التقييمات، فتح الشكاوى بالتوازي، السحب مع التجميد، عدم تكرار الاسترداد، ومنع الشكاوى بعد ٣ قرارات رفض خلال ٩٠ يوم.


## Production database / قاعدة بيانات الإنتاج

استخدم PostgreSQL مُدار (Neon أو Supabase)، وخلّي `DATABASE_URL` رابط الـ pooler للتطبيق و`DIRECT_URL` الرابط المباشر للترحيلات. محلياً الاتنين ممكن يبقوا نفس الرابط. قبل كل نشر شغّل `npx prisma migrate deploy` على الرابط المباشر، وفعّل الاسترجاع لنقطة زمنية أو النسخ الاحتياطي اليومي. اختبر استرجاع نسخة في قاعدة منفصلة. الأقفال في التطبيق داخل المعاملة فقط؛ مفيش session advisory locks ولا اعتماد على session SET.

Use a managed PostgreSQL database, a pooled application URL, and a direct migration URL. Run migrations before every deploy, enable PITR/daily backups, and rehearse restores in a separate database. Interactive transactions use transaction-scoped locks and work with transaction pooling.

## دليل الإطلاق / Launch runbook

1. **قاعدة البيانات / Database:** أنشئ Neon أو Supabase، اضبط `DATABASE_URL` و`DIRECT_URL` وشغّل `npx prisma migrate deploy`. Create the database, configure pooled/direct URLs, then apply migrations before deploying.
2. **التخزين / Storage:** أنشئ bucket خاص في R2 من غير public access، وAPI token بصلاحية قراءة/كتابة للبكت ده فقط. اضبط متغيرات `R2_*` و`STORAGE_DRIVER=r2`. Add a lifecycle rule for the `pending/` prefix to expire objects after **1 day**. Configure bucket CORS for the exact app origin, methods PUT/GET/HEAD, allowed headers Content-Type, and expose ETag; do not allow unrelated origins. Never put secrets or signed URLs into database rows, analytics or logs. Final objects retain private keys only.
3. **الاستضافة / Hosting:** أنشئ مشروع Vercel من الريبو وأضف كل متغيرات `.env.example` بقيم حقيقية في إعدادات المشروع فقط. استخدم `PAYMENT_PROVIDER=paymob` بمفاتيح اختبار الأول. Configure Node 22, a long random AUTH_SECRET and CRON_SECRET, HTTPS APP_URL, and R2. `vercel.json` only has daily safety-net crons, because Vercel Hobby rejects anything more frequent. Frequent jobs run from an external scheduler (for example cron-job.org, free): create two GET jobs with the header `Authorization: Bearer <CRON_SECRET>`: `<APP_URL>/api/cron/send-notifications` every minute and `<APP_URL>/api/cron/release-expired-orders` every 5 minutes. On Vercel Pro you may move them back into `vercel.json`. Vercel Hobby is for non-commercial use; switch to Pro before taking real orders. Runtime validation fails closed on incomplete production settings.
4. **Paymob callbacks:** transaction processed callback → `<APP_URL>/api/payments/paymob/webhook`، response callback → `<APP_URL>/api/payments/paymob/return`. Browser redirects are never proof of payment.
5. **تليجرام / Telegram:** أنشئ البوت من BotFather، واضبط `TELEGRAM_BOT_TOKEN` و`TELEGRAM_BOT_USERNAME` (من غير @) و`TELEGRAM_WEBHOOK_SECRET`. Call Telegram `setWebhook` securely with `url=<APP_URL>/api/telegram/webhook` and `secret_token=<TELEGRAM_WEBHOOK_SECRET>`; keep the token out of shell history/logs. التاجر يفتح إعدادات المتجر ويضغط «اربط تليجرام»، وبعدها Start في البوت خلال ١٥ دقيقة. Existing free-text chat IDs are cleared by the launch migration and must be linked again. Leave all three settings empty to hide this feature.
6. **الإيميل / Email:** وثّق الدومين في Resend واضبط `RESEND_API_KEY` و`EMAIL_FROM`. Leave both empty to hide password recovery. In development only, reset links are written to the local server console instead of being sent; treat that console as private. Production never logs reset tokens. Password reset revokes old sessions and restarts the seller's 24-hour payout lock.
7. **تجربة قبل الإطلاق / Smoke test:** بمفاتيح وكروت Paymob التجريبية اشتري منتج أكواد ومنتج ملف (جرّب ZIP بحجم ٤٠ ميجا)، وراجع التسليم والشات والتقييم والشكوى وطلب السحب وإشعار تليجرام واسترجاع الباسورد. Verify `/api/health`, wrong/right cron authorization, security headers on `/` and authorized downloads, and the presigned upload flow with your private bucket. R2 PUT URLs expire after 5 minutes and sign size/type; GET redirects expire after 60 seconds. Pending files are checked with HEAD and signature bytes before copy to final storage. Local development keeps normal multipart uploads with `STORAGE_DRIVER=local`.
8. **الفلوس الحقيقية — صاحب المشروع فقط / Owner-only live switch:** بعد نجاح كل الاختبارات غيّر لمفاتيح Paymob الحقيقية، اعمل شراء صغير، ارجع الفلوس من لوحة Paymob وبعدين سجّل الاسترداد في الأدمن. Do not switch to live money automatically or during CI.

### التشغيل والمتابعة / Operations

- CI uses Node 22 and PostgreSQL 16, a fresh migrated database and dummy configuration only. Integration files run serially because expiry cleanup operates across the shared database. CI never contacts R2/Telegram/Resend: integration tests inject fake S3/fetch clients.
- Cron: expired orders every 5 minutes and notifications every minute (external scheduler), cleanup and an expired-orders safety run daily (`vercel.json`). Batches are capped at 100 and stop against a 25-second budget. Notification delivery uses a 10-second timeout, retries after 1/5/30/120 minutes and fails after five attempts; 403 unlinks the bot. Inspect FAILED rows using authorized database operations. Delivery is at-least-once: a process crash after Telegram accepts but before the DB commit may duplicate a notification.
- Notification payloads allow only event metadata (order number, title, amount, internal IDs), never chat bodies, delivery codes, buyer contacts or full payout accounts. URLs lead back to authenticated seller pages.
- Deploy the `launch` migration before the new code. Existing JWTs without a session version require login again. Existing files remain on their configured storage backend; before switching an existing installation from local to R2, copy the private objects with their exact keys into the private bucket and verify authorized downloads. Do not delete the local backup until verified.
- A signed download URL is a short-lived bearer capability: anybody who receives it can use it until expiry. Do not share it. Security headers apply to the authenticated application redirect; R2 responses use the signed response disposition/cache settings. Configure R2 CORS as above.

References: [AWS SDK presigning](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-s3-request-presigner/), [Telegram Bot API](https://core.telegram.org/bots/api).
