import { i18n } from "@/lib/prefs";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { FAQ_PAGE, FAQS, POLICIES_UPDATED, POLICY_PAGES } from "@/content/policies";
import { Breadcrumbs } from "@/components/store-ui";
import { absolute, jsonLd } from "@/lib/seo";

type Props = { params: Promise<{ page: string }> };

// Every information page, in the order the side menu lists them.
const MENU = ["about", "faq", "terms", "refunds", "privacy", "contact"] as const;

function pageFor(slug: string) {
  if (slug === "faq") return FAQ_PAGE;
  return POLICY_PAGES[slug];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await i18n();
  const slug = (await params).page;
  const page = pageFor(slug);
  if (!page) return {};
  const url = `/pages/${slug}`;
  return {
    title: page.title[lang],
    description: page.description[lang],
    alternates: { canonical: url },
    openGraph: { url, title: page.title[lang], description: page.description[lang] },
  };
}

export default async function InfoPage({ params }: Props) {
  const { t, lang, day } = await i18n();
  const slug = (await params).page;
  const page = pageFor(slug);
  if (!page) notFound();
  const sections = slug === "faq" ? [] : POLICY_PAGES[slug].sections;
  const support = process.env.SUPPORT_EMAIL?.trim();

  const structured = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: t("الرئيسية"), item: absolute("/") },
        { "@type": "ListItem", position: 2, name: page.title[lang], item: absolute(`/pages/${slug}`) },
      ],
    },
    ...(slug === "faq"
      ? [
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQS.map((f) => ({
              "@type": "Question",
              name: f.q[lang],
              acceptedAnswer: { "@type": "Answer", text: f.a[lang] },
            })),
          },
        ]
      : []),
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structured) }} />
      <Breadcrumbs items={[{ label: t("الرئيسية"), href: "/" }, { label: page.title[lang] }]} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="card no-scrollbar flex gap-1 overflow-x-auto p-2 text-sm lg:flex-col lg:self-start">
          {MENU.map((s) => (
            <Link
              key={s}
              href={`/pages/${s}`}
              className={`shrink-0 rounded-lg px-3 py-2 whitespace-nowrap ${s === slug ? "bg-brand-600 font-semibold text-white" : "hover:bg-slate-50"}`}
            >
              {pageFor(s)!.title[lang]}
            </Link>
          ))}
        </nav>

        <article className="card p-6 sm:p-8">
          <h1 className="text-2xl font-extrabold sm:text-3xl">{page.title[lang]}</h1>
          <p className="mt-2 leading-7 text-slate-500">{page.description[lang]}</p>

          {slug === "faq" ? (
            <div className="mt-6 divide-y divide-slate-100">
              {FAQS.map((f) => (
                <details key={f.q.ar} className="group py-4" open>
                  <summary className="cursor-pointer list-none text-lg font-bold marker:hidden">
                    {f.q[lang]}
                  </summary>
                  <p className="mt-2 leading-8 text-slate-700">{f.a[lang]}</p>
                </details>
              ))}
            </div>
          ) : (
            <div className="mt-6 space-y-8">
              {sections.map((section) => (
                  <section key={section.heading.ar}>
                    <h2 className="mb-2 text-lg font-bold">{section.heading[lang]}</h2>
                    <div className="space-y-3 leading-8 text-slate-700">
                      {section.paragraphs.map((p) => (
                        <p key={p.ar}>{p[lang]}</p>
                      ))}
                    </div>
                  </section>
                ))}
              {slug === "contact" && support && (
                <section>
                  <h2 className="mb-2 text-lg font-bold">{t("الإيميل")}</h2>
                  <p className="leading-8 text-slate-700">
                    {t("للاستفسارات العامة وطلبات البيانات الشخصية:")}{" "}
                    <a href={`mailto:${support}`} className="font-semibold text-brand-600 hover:underline" dir="ltr">
                      {support}
                    </a>
                  </p>
                </section>
              )}
            </div>
          )}

          <p className="mt-10 border-t border-slate-100 pt-4 text-xs text-slate-400">
            {t("آخر تحديث: ")}{day(new Date(POLICIES_UPDATED))}
          </p>
        </article>
      </div>
    </div>
  );
}
