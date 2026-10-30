// Public information pages (/pages/<slug>), written in both languages here
// instead of through t() because they are long-form text.
// Draft text: have a lawyer review it before relying on it.

export type Lang = "ar" | "en";
type Text = Record<Lang, string>;

export type PolicyPage = {
  title: Text;
  description: Text;
  sections: { heading: Text; paragraphs: Text[] }[];
};

export type Faq = { q: Text; a: Text };

export const POLICIES_UPDATED = "2026-10-30";

export const POLICY_PAGES: Record<string, PolicyPage> = {
  about: {
    title: { ar: "من نحن", en: "About us" },
    description: {
      ar: "ديجي مصر سوق مصري للمنتجات الرقمية: اشتراكات وبرامج وكروت شحن وألعاب من تجار موثّقين، بتسليم فوري وضمان لحق المشتري.",
      en: "Digiegy is an Egyptian marketplace for digital products: subscriptions, software, gift cards and games from verified sellers, delivered instantly with buyer protection.",
    },
    sections: [
      {
        heading: { ar: "إحنا مين", en: "Who we are" },
        paragraphs: [
          {
            ar: "ديجي مصر (Digiegy) سوق إلكتروني مصري بيجمع تجار المنتجات الرقمية والمشترين في مكان واحد: اشتراكات الذكاء الاصطناعي والترفيه، البرامج ومفاتيح التفعيل، كروت الشحن، شحن الألعاب، والكورسات.",
            en: "Digiegy is an Egyptian online marketplace that brings sellers and buyers of digital products together: AI and streaming subscriptions, software and activation keys, gift cards, game top-ups and courses.",
          },
          {
            ar: "إحنا مش بنبيع المنتجات بنفسنا. كل منتج بيعرضه تاجر مستقل، وإحنا بنوفّر المنصة، والدفع الآمن، والتسليم الفوري، وحل المشاكل بين الطرفين.",
            en: "We do not sell the products ourselves. Each product is listed by an independent seller; we provide the platform, safe payment, instant delivery and dispute resolution.",
          },
        ],
      },
      {
        heading: { ar: "ليه تشتري من ديجي مصر", en: "Why buy on Digiegy" },
        paragraphs: [
          {
            ar: "كل تاجر لازم يوثّق هويته بالبطاقة الشخصية أو السجل التجاري قبل ما يقدر يبيع.",
            en: "Every seller verifies their identity with a national ID or commercial register before they can sell.",
          },
          {
            ar: "الكود أو الحساب أو الملف بيوصلك على صفحة الطلب أول ما الدفع يتأكد.",
            en: "The code, account or file appears on your order page as soon as the payment is confirmed.",
          },
          {
            ar: "فلوس التاجر بتفضل متعلّقة عندنا فترة بعد البيع، فلو المنتج مش شغّال تقدر تفتح شكوى وتسترد فلوسك.",
            en: "The seller's money stays on hold with us for a period after each sale, so if a product does not work you can open a dispute and get your money back.",
          },
        ],
      },
    ],
  },

  terms: {
    title: { ar: "الشروط والأحكام", en: "Terms and conditions" },
    description: {
      ar: "شروط استخدام ديجي مصر للمشترين والتجار: الحسابات، الدفع، التسليم، العمولات، المنتجات الممنوعة، والشكاوى.",
      en: "Terms of use of Digiegy for buyers and sellers: accounts, payment, delivery, commissions, prohibited products and disputes.",
    },
    sections: [
      {
        heading: { ar: "١. الموافقة على الشروط", en: "1. Accepting these terms" },
        paragraphs: [
          {
            ar: "باستخدامك للموقع أو عمل حساب عليه، إنت موافق على الشروط دي وعلى سياسة الخصوصية وسياسة الاسترداد. لو مش موافق، متستخدمش الموقع.",
            en: "By using the site or creating an account you agree to these terms, the privacy policy and the refund policy. If you do not agree, do not use the site.",
          },
          {
            ar: "لازم يكون عندك 18 سنة على الأقل، أو تستخدم الموقع بموافقة ولي أمرك.",
            en: "You must be at least 18 years old, or use the site with a parent's or guardian's consent.",
          },
        ],
      },
      {
        heading: { ar: "٢. دور المنصة", en: "2. Our role" },
        paragraphs: [
          {
            ar: "ديجي مصر وسيط بين المشتري والتاجر. التاجر مسؤول عن المنتج، ووصفه، وصلاحيته، وإنه من حقه يبيعه. المنصة مسؤولة عن تشغيل الموقع، واستلام الدفع، وتعليق أرباح التاجر لحد انتهاء فترة الضمان، والفصل في الشكاوى.",
            en: "Digiegy is an intermediary between buyer and seller. The seller is responsible for the product, its description, that it works and that they have the right to sell it. We run the site, collect payment, hold the seller's earnings until the guarantee period ends, and decide disputes.",
          },
        ],
      },
      {
        heading: { ar: "٣. الحسابات", en: "3. Accounts" },
        paragraphs: [
          {
            ar: "إنت مسؤول عن سرية الباسورد وعن أي حاجة بتحصل من حسابك. بلّغنا فوراً لو حسيت إن حد دخل حسابك.",
            en: "You are responsible for keeping your password secret and for everything done from your account. Tell us immediately if you think someone else has accessed it.",
          },
          {
            ar: "من حقنا نوقف أو نقفل أي حساب بيخالف الشروط، أو بيحاول يحتال، أو بيأذي مستخدمين تانيين.",
            en: "We may suspend or close any account that breaks these terms, attempts fraud or harms other users.",
          },
        ],
      },
      {
        heading: { ar: "٤. الشراء والدفع والتسليم", en: "4. Buying, payment and delivery" },
        paragraphs: [
          {
            ar: "الأسعار بالجنيه المصري. الدفع بيتم بالطرق الظاهرة وقت الشراء (زي الكروت البنكية والمحافظ الإلكترونية وإنستاباي)، والطلب بيتأكد بعد ما الدفع يوصل ويتراجع.",
            en: "Prices are in Egyptian pounds. Payment is made by the methods shown at checkout (such as bank cards, mobile wallets and InstaPay), and an order is confirmed once the payment arrives and is checked.",
          },
          {
            ar: "المنتج بيظهر على صفحة الطلب في حسابك بعد تأكيد الدفع. اتأكد إن المنتج شغّال أول ما تستلمه.",
            en: "The product appears on the order page in your account after the payment is confirmed. Check that it works as soon as you receive it.",
          },
        ],
      },
      {
        heading: { ar: "٥. شروط التجار", en: "5. Seller terms" },
        paragraphs: [
          {
            ar: "التاجر لازم يوثّق هويته (فرد بالبطاقة الشخصية أو شركة بالسجل التجاري) قبل ما منتجاته تظهر، والبيانات لازم تكون صحيحة ومطابقة لبيانات السحب.",
            en: "Sellers must verify their identity (individuals with a national ID, companies with a commercial register) before their products are shown, and the details must be accurate and match their payout details.",
          },
          {
            ar: "المنصة بتاخد عمولة على كل بيعة حسب قسم المنتج، والعمولة بتتثبّت على الطلب وقت الشراء. أرباح التاجر بتتعلّق فترة (7 أيام للأفراد و3 أيام للشركات حالياً) قبل ما تبقى متاحة للسحب.",
            en: "We charge a commission on each sale according to the product's category, fixed on the order at the time of purchase. Seller earnings are held for a period (currently 7 days for individuals and 3 days for companies) before they can be withdrawn.",
          },
          {
            ar: "التاجر ملتزم بالرد على المشتري وحل المشاكل بسرعة. لو فيه شكوى مفتوحة ممكن الإدارة توقف البيع أو السحب مؤقتاً لحد ما تتحل.",
            en: "Sellers must answer buyers and solve problems promptly. While a dispute is open, we may pause the seller's sales or payouts until it is resolved.",
          },
        ],
      },
      {
        heading: { ar: "٦. المنتجات الممنوعة", en: "6. Prohibited products" },
        paragraphs: [
          {
            ar: "ممنوع بيع: حسابات أو بطاقات مسروقة أو متاخدة بطريقة احتيالية، محتوى مقرصن، أدوات اختراق، أو أي حاجة مخالفة للقانون المصري. التاجر مسؤول قانونياً عن أي منتج مخالف، ومن حقنا نشيله ونقفل الحساب ونحتجز الأرباح المرتبطة بيه.",
            en: "It is forbidden to sell stolen or fraudulently obtained accounts or cards, pirated content, hacking tools, or anything that breaks Egyptian law. The seller is legally responsible for any such product, and we may remove it, close the account and withhold the related earnings.",
          },
        ],
      },
      {
        heading: { ar: "٧. الشكاوى والاسترداد", en: "7. Disputes and refunds" },
        paragraphs: [
          {
            ar: "المشاكل بتتحل حسب سياسة الاسترداد: المشتري يفتح شكوى من صفحة الطلب، والتاجر يرد، ولو مفيش اتفاق الإدارة بتراجع الأدلة وتحكم، وقرارها نهائي على المنصة.",
            en: "Problems are handled under the refund policy: the buyer opens a dispute from the order page, the seller responds, and if they do not agree we review the evidence and decide. Our decision is final on the platform.",
          },
        ],
      },
      {
        heading: { ar: "٨. حدود المسؤولية", en: "8. Limitation of liability" },
        paragraphs: [
          {
            ar: "المنتجات الرقمية بتعتمد على شركات تانية (زي أصحاب الألعاب والبرامج والاشتراكات). إحنا مش مسؤولين عن تغييرات تعملها الشركات دي في خدماتها، ومسؤوليتنا في كل الأحوال مش أكتر من قيمة الطلب.",
            en: "Digital products depend on third parties (such as game, software and subscription companies). We are not responsible for changes those companies make to their services, and our liability is in any case limited to the value of the order.",
          },
        ],
      },
      {
        heading: { ar: "٩. تعديل الشروط والقانون المطبّق", en: "9. Changes and governing law" },
        paragraphs: [
          {
            ar: "ممكن نعدّل الشروط دي، والنسخة المنشورة هنا هي اللي بيتعمل بيها. الشروط دي خاضعة لقوانين جمهورية مصر العربية.",
            en: "We may change these terms; the version published here applies. These terms are governed by the laws of the Arab Republic of Egypt.",
          },
        ],
      },
    ],
  },

  refunds: {
    title: { ar: "سياسة الاسترداد", en: "Refund policy" },
    description: {
      ar: "إزاي تسترد فلوسك على ديجي مصر لو المنتج الرقمي مش شغّال أو مش زي الوصف: فتح شكوى، رد التاجر، وحكم الإدارة.",
      en: "How to get your money back on Digiegy if a digital product does not work or is not as described: open a dispute, seller response, and our decision.",
    },
    sections: [
      {
        heading: { ar: "إمتى تقدر تسترد فلوسك", en: "When you can get a refund" },
        paragraphs: [
          {
            ar: "لو الكود أو الحساب مش شغّال، أو المنتج مش زي الوصف، أو التاجر مسلّمش اللي اتفق عليه.",
            en: "If the code or account does not work, the product is not as described, or the seller did not deliver what was agreed.",
          },
          {
            ar: "لازم تفتح الشكوى خلال فترة الضمان، وهي الفترة اللي فلوس التاجر بتفضل متعلّقة فيها بعد الطلب. عشان كده اختبر المنتج أول ما تستلمه.",
            en: "You must open the dispute within the guarantee period, which is the time the seller's money stays on hold after the order. Test the product as soon as you receive it.",
          },
        ],
      },
      {
        heading: { ar: "خطوات الاسترداد", en: "How it works" },
        paragraphs: [
          {
            ar: "١. افتح صفحة الطلب من «مشترياتي» واضغط «فتح شكوى»، واكتب المشكلة وارفق صورة لو تقدر.",
            en: "1. Open the order from \"My purchases\", choose \"Open a dispute\", describe the problem and attach a screenshot if you can.",
          },
          {
            ar: "٢. التاجر بيتواصل معاك في شات الطلب، ويقدر يصلّح المشكلة أو يبدّل المنتج أو يرجّعلك المبلغ كله أو جزء منه.",
            en: "2. The seller talks to you in the order chat and can fix the problem, replace the product, or refund all or part of the price.",
          },
          {
            ar: "٣. لو مفيش اتفاق، الإدارة بتراجع الشات والأدلة وتحكم. لو الحكم لصالحك الفلوس بترجعلك بنفس طريقة الدفع أو بتحويل يدوي.",
            en: "3. If you do not agree, we review the chat and evidence and decide. If we rule in your favour, the money is returned by the same payment method or by manual transfer.",
          },
        ],
      },
      {
        heading: { ar: "حالات مفيهاش استرداد", en: "When refunds do not apply" },
        paragraphs: [
          {
            ar: "المنتج اتسلّم وشغّال زي الوصف، أو المشتري غيّر رأيه بعد الاستلام، أو المشكلة سببها المشتري (زي تغيير بيانات حساب متسلّم ضد تعليمات التاجر)، أو الشكوى اتفتحت بعد انتهاء فترة الضمان.",
            en: "The product was delivered and works as described, the buyer changed their mind after delivery, the problem was caused by the buyer (such as changing a delivered account's details against the seller's instructions), or the dispute was opened after the guarantee period.",
          },
        ],
      },
    ],
  },

  privacy: {
    title: { ar: "سياسة الخصوصية", en: "Privacy policy" },
    description: {
      ar: "إيه البيانات اللي ديجي مصر بتجمعها، وبنستخدمها في إيه، وبنشاركها مع مين، وإزاي تطلب تعديلها أو مسحها.",
      en: "What data Digiegy collects, how we use it, who we share it with, and how to ask us to correct or delete it.",
    },
    sections: [
      {
        heading: { ar: "البيانات اللي بنجمعها", en: "Data we collect" },
        paragraphs: [
          {
            ar: "بيانات الحساب: الاسم والإيميل والباسورد (متخزّن مشفّر). بيانات الطلبات: المنتجات والمبالغ وطريقة الدفع وعنوان الـ IP والدولة وقت الشراء لمنع الاحتيال. الرسايل في شات الطلب والشكاوى.",
            en: "Account data: name, email and password (stored hashed). Order data: products, amounts, payment method, and IP address and country at checkout to prevent fraud. Messages in order chats and disputes.",
          },
          {
            ar: "للتجار كمان: بيانات التوثيق (صورة البطاقة أو السجل التجاري) وبيانات السحب. المستندات دي متخزّنة في مساحة خاصة ومحدش بيشوفها غير الإدارة.",
            en: "For sellers also: verification documents (ID or commercial register) and payout details. These documents are kept in private storage and only our admins can see them.",
          },
        ],
      },
      {
        heading: { ar: "بنستخدم البيانات في إيه", en: "How we use it" },
        paragraphs: [
          {
            ar: "تشغيل حسابك وتنفيذ الطلبات وتسليمها، التحقق من التجار، منع الاحتيال، حل الشكاوى، إرسال إيميلات الأمان زي إعادة تعيين الباسورد، والالتزام بالقانون.",
            en: "To run your account, process and deliver orders, verify sellers, prevent fraud, resolve disputes, send security emails such as password resets, and comply with the law.",
          },
          {
            ar: "التاجر بيشوف من بياناتك اللي يلزمه لتنفيذ طلبك بس (زي الاسم والإيميل). مش بنبيع بياناتك لحد.",
            en: "A seller sees only what they need to fulfil your order (such as your name and email). We do not sell your data.",
          },
        ],
      },
      {
        heading: { ar: "مزوّدي الخدمة", en: "Service providers" },
        paragraphs: [
          {
            ar: "بنستخدم شركات موثوقة لتشغيل الموقع: الاستضافة (Vercel)، قاعدة البيانات (Neon)، تخزين الملفات (Cloudflare R2)، والإيميلات (Resend)، وتيليجرام للإشعارات اللي التاجر يفعّلها. السيرفرات في الاتحاد الأوروبي.",
            en: "We use trusted companies to run the site: hosting (Vercel), database (Neon), file storage (Cloudflare R2), email (Resend), and Telegram for notifications a seller turns on. The servers are in the European Union.",
          },
        ],
      },
      {
        heading: { ar: "الكوكيز", en: "Cookies" },
        paragraphs: [
          {
            ar: "بنستخدم كوكيز ضرورية بس: كوكي تسجيل الدخول، وكوكيز بتفتكر اللغة والوضع الليلي اللي اخترتهم. مش بنستخدم كوكيز إعلانات.",
            en: "We use only essential cookies: the sign-in cookie, and cookies that remember the language and dark mode you chose. We do not use advertising cookies.",
          },
        ],
      },
      {
        heading: { ar: "حقوقك والاحتفاظ بالبيانات", en: "Your rights and retention" },
        paragraphs: [
          {
            ar: "من حقك تطلب نسخة من بياناتك أو تعديلها أو مسح حسابك من صفحة «تواصل معانا»، طبقاً لقانون حماية البيانات الشخصية المصري رقم 151 لسنة 2020. بنحتفظ بسجلات الطلبات والمعاملات المالية المدة اللي يطلبها القانون حتى بعد مسح الحساب.",
            en: "You may ask for a copy of your data, a correction, or the deletion of your account through the contact page, under Egypt's Personal Data Protection Law No. 151 of 2020. We keep order and payment records for as long as the law requires, even after an account is deleted.",
          },
        ],
      },
    ],
  },

  contact: {
    title: { ar: "تواصل معانا", en: "Contact us" },
    description: {
      ar: "إزاي تتواصل مع ديجي مصر: مشاكل الطلبات من صفحة الطلب، والاستفسارات العامة وطلبات البيانات بالإيميل.",
      en: "How to reach Digiegy: order problems from the order page, general questions and data requests by email.",
    },
    sections: [
      {
        heading: { ar: "مشكلة في طلب؟", en: "A problem with an order?" },
        paragraphs: [
          {
            ar: "أسرع طريقة: افتح الطلب من «مشترياتي» وكلّم التاجر في شات الطلب. لو المشكلة متحلّتش افتح شكوى من نفس الصفحة والإدارة هتتدخل.",
            en: "The fastest way: open the order from \"My purchases\" and message the seller in the order chat. If that does not solve it, open a dispute from the same page and we will step in.",
          },
        ],
      },
      {
        heading: { ar: "عايز تبيع على ديجي مصر؟", en: "Want to sell on Digiegy?" },
        paragraphs: [
          {
            ar: "اعمل حساب تاجر من «ابدأ البيع» وارفع بيانات التوثيق، وهنراجعها في أسرع وقت.",
            en: "Create a seller account from \"Start selling\" and upload your verification details; we review them as quickly as we can.",
          },
        ],
      },
    ],
  },
};

export const FAQ_PAGE = {
  title: { ar: "الأسئلة الشائعة", en: "Frequently asked questions" },
  description: {
    ar: "إجابات أشهر الأسئلة عن الشراء على ديجي مصر: الدفع، التسليم، الضمان، الاسترداد، والبيع.",
    en: "Answers to common questions about buying on Digiegy: payment, delivery, guarantee, refunds and selling.",
  },
};

export const FAQS: Faq[] = [
  {
    q: { ar: "الشراء من ديجي مصر آمن؟", en: "Is buying on Digiegy safe?" },
    a: {
      ar: "أيوه. كل تاجر متحقّق من هويته، وفلوس التاجر بتفضل متعلّقة عندنا فترة بعد البيع، فلو المنتج مش شغّال تقدر تفتح شكوى وتسترد فلوسك.",
      en: "Yes. Every seller is identity-verified, and the seller's money stays on hold with us for a while after the sale, so if the product does not work you can open a dispute and get your money back.",
    },
  },
  {
    q: { ar: "بدفع إزاي؟", en: "How do I pay?" },
    a: {
      ar: "بالطرق اللي بتظهرلك في صفحة الدفع: كارت بنكي (فيزا، ماستركارد، ميزة) أو محفظة إلكترونية، وطلبك بيتأكد تلقائي أول ما الدفع ينجح. ولو صفحة الدفع طلبت تحويل إنستاباي أو محفظة، حوّل واكتب رقم العملية، وطلبك بيتأكد أول ما التحويل يتراجع.",
      en: "With the methods shown on the payment page: a bank card (Visa, Mastercard, Meeza) or a mobile wallet, and your order is confirmed automatically once the payment goes through. If the page asks for an InstaPay or wallet transfer instead, transfer and enter the transaction reference; your order is confirmed as soon as the transfer is checked.",
    },
  },
  {
    q: { ar: "المنتج بيوصلني إمتى؟", en: "When do I receive the product?" },
    a: {
      ar: "فوراً بعد تأكيد الدفع. الكود أو الحساب أو الملف بيظهر على صفحة الطلب في «مشترياتي».",
      en: "Immediately after the payment is confirmed. The code, account or file appears on the order page under \"My purchases\".",
    },
  },
  {
    q: { ar: "لو الكود مش شغّال أعمل إيه؟", en: "What if the code does not work?" },
    a: {
      ar: "كلّم التاجر في شات الطلب، ولو المشكلة متحلّتش افتح شكوى من صفحة الطلب خلال فترة الضمان. الإدارة بتراجع وتحكم، ولو الحق معاك فلوسك بترجع.",
      en: "Message the seller in the order chat, and if that does not solve it, open a dispute from the order page within the guarantee period. We review it, and if you are right you get your money back.",
    },
  },
  {
    q: { ar: "إيه الفرق بين الحساب الخاص والمشترك؟", en: "What is the difference between a private and a shared account?" },
    a: {
      ar: "الحساب الخاص بيتسلّم ليك لوحدك، والمشترك بيستخدمه أكتر من شخص بسعر أقل. اقرا وصف المنتج كويس قبل الشراء.",
      en: "A private account is delivered to you alone; a shared one is used by several people at a lower price. Read the product description carefully before buying.",
    },
  },
  {
    q: { ar: "أقدر أبيع منتجاتي على ديجي مصر؟", en: "Can I sell my products on Digiegy?" },
    a: {
      ar: "أيوه. اعمل حساب تاجر من «ابدأ البيع»، ووثّق هويتك بالبطاقة أو السجل التجاري، وبعد الموافقة تقدر تضيف منتجاتك وتستلم أرباحك.",
      en: "Yes. Create a seller account from \"Start selling\", verify your identity with an ID or commercial register, and once approved you can list products and withdraw your earnings.",
    },
  },
];
