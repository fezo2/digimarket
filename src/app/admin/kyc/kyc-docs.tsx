import { i18n } from "@/lib/prefs";

type Docs = {
  idFrontKey: string;
  idBackKey: string;
  selfieKey: string;
  commercialRegKey: string | null;
  taxCardKey: string | null;
};

// Thumbnails of a KYC submission's private files, served through the
// admin-only file route (short-lived signed links, never public URLs).
export async function KycDocs({ s, small = false }: { s: Docs; small?: boolean }) {
  const { t } = await i18n();
  const docs = [
    [t("البطاقة (وش)"), s.idFrontKey],
    [t("البطاقة (ضهر)"), s.idBackKey],
    [t("سيلفي بالبطاقة"), s.selfieKey],
    [t("السجل التجاري"), s.commercialRegKey],
    [t("البطاقة الضريبية"), s.taxCardKey],
  ].filter((d): d is [string, string] => Boolean(d[1]));

  return (
    <div className={small ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" : "grid gap-4 sm:grid-cols-2"}>
      {docs.map(([label, key]) => {
        const url = `/api/admin/files/${key}`;
        return (
          <a
            key={key}
            href={url}
            target="_blank"
            rel="noopener"
            className="card block overflow-hidden hover:border-brand-500"
          >
            <p className="p-2 text-sm font-semibold">{label}</p>
            {key.endsWith(".pdf") ? (
              <p className="p-6 text-center text-brand-600">{t("فتح ملف PDF")}</p>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt={label}
                loading="lazy"
                className="aspect-[4/3] w-full bg-slate-100 object-contain"
              />
            )}
          </a>
        );
      })}
    </div>
  );
}
