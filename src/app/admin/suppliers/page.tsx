import { i18n } from "@/lib/prefs";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { ActionForm } from "@/components/action-form";
import { SUPPLIER, supplierSettings } from "@/lib/supplier";
import { guessCategorySlug, supplierPrice } from "@/lib/supplier-pricing";
import {
  getBalance,
  listProducts,
  prodsellerConfigured,
  type SupplierProduct,
} from "@/lib/suppliers/prodseller";
import { importProducts, saveSettings, syncNow } from "./actions";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: (await i18n()).t("ProdSeller") };
}

const usd = (mills: number) => `$${(mills / 1000).toFixed(2)}`;

export default async function Suppliers() {
  const { t, num, money, date } = await i18n();
  await requireAdmin();
  if (!prodsellerConfigured())
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold">ProdSeller</h1>
        <section className="card space-y-2 p-5 text-sm">
          <p>{t("مفتاح الـ API مش متضاف لسه.")}</p>
          <p>
            {t(
              "من لوحة ProdSeller اعمل مفتاح من API Manager، وحطه في Vercel باسم PRODSELLER_API_KEY، وبعدين اعمل Redeploy.",
            )}
          </p>
        </section>
      </div>
    );

  const settings = await supplierSettings();
  const [sellers, categories, imported] = await Promise.all([
    db.sellerProfile.findMany({
      select: { id: true, storeName: true },
      orderBy: { createdAt: "asc" },
    }),
    db.category.findMany({
      where: { parentId: { not: null } },
      select: { id: true, slug: true, nameAr: true, parent: { select: { nameAr: true } } },
      orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }],
    }),
    db.product.findMany({
      where: { supplier: SUPPLIER },
      select: { supplierProductId: true, supplierSyncedAt: true },
    }),
  ]);
  const allCategories = await db.category.findMany({ select: { id: true, slug: true } });
  const bySlug = new Map(allCategories.map((c) => [c.slug, c.id]));
  const done = new Set(imported.map((p) => p.supplierProductId));
  const lastSync = imported
    .map((p) => p.supplierSyncedAt)
    .filter(Boolean)
    .sort((a, b) => b!.getTime() - a!.getTime())[0];

  let balance: string | null = null;
  let catalog: SupplierProduct[] = [];
  let problem: string | null = null;
  try {
    const [b, list] = await Promise.all([getBalance(), listProducts()]);
    balance = `${b.balance.toFixed(2)} USDT`;
    catalog = list;
  } catch (error) {
    problem = error instanceof Error ? error.message : "ProdSeller مش بيرد";
  }
  const fresh = catalog.filter((p) => !done.has(p.id));

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">ProdSeller</h1>
      {problem && (
        <p role="alert" className="card p-4 text-red-700">
          {problem}
        </p>
      )}
      <section className="card grid gap-3 p-5 text-sm sm:grid-cols-3">
        <div>
          <div className="text-slate-500">{t("رصيدك في ProdSeller")}</div>
          <div className="text-lg font-bold">{balance ?? "—"}</div>
        </div>
        <div>
          <div className="text-slate-500">{t("منتجات مربوطة")}</div>
          <div className="text-lg font-bold">{num(imported.length)}</div>
        </div>
        <div>
          <div className="text-slate-500">{t("آخر تحديث للأسعار والمخزون")}</div>
          <div className="text-lg font-bold">{lastSync ? date(lastSync) : "—"}</div>
        </div>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-bold">{t("الإعدادات")}</h2>
        <ActionForm action={saveSettings} button={t("احفظ وحدّث الأسعار")}>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="label">
              {t("المتجر اللي هيبيع")}
              <select className="input" name="sellerId" defaultValue={settings.sellerId ?? ""} required>
                <option value="">{t("اختار")}</option>
                {sellers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.storeName}
                  </option>
                ))}
              </select>
            </label>
            <label className="label">
              {t("سعر الدولار بالجنيه")}
              <input className="input" name="usdRate" type="number" step="0.01" min="1" defaultValue={settings.usdRate / 100} required />
            </label>
            <label className="label">
              {t("مضاعف السعر (2.5 = سعرك 2.5 ضعف التكلفة)")}
              <input className="input" name="multiplier" type="number" step="0.01" min="1" defaultValue={settings.multiplierBps / 10000} required />
            </label>
          </div>
        </ActionForm>
        <p className="text-xs text-slate-500">
          {t(
            "السعر = تكلفة ProdSeller بالدولار × سعر الدولار × المضاعف، مقرّب لأعلى لأقرب جنيه. عمولة المنصة بتتخصم منه زي أي بيع. الأسعار والمخزون بيتحدثوا مع كل تشغيل لمهمة supplier-sync.",
          )}
        </p>
        <ActionForm action={syncNow} button={t("حدّث الأسعار والمخزون دلوقتي")} />
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-bold">
          {t("منتجات ProdSeller اللي لسه مش على المتجر")} ({num(fresh.length)})
        </h2>
        {fresh.length === 0 ? (
          <p className="text-sm text-slate-500">{t("مفيش منتجات جديدة")}</p>
        ) : (
          <ActionForm action={importProducts} button={t("ضيف المنتجات المختارة")}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-start text-slate-500">
                  <tr>
                    <th className="p-2 text-start">✓</th>
                    <th className="p-2 text-start">{t("المنتج")}</th>
                    <th className="p-2 text-start">{t("التكلفة")}</th>
                    <th className="p-2 text-start">{t("سعرك")}</th>
                    <th className="p-2 text-start">{t("المخزون")}</th>
                    <th className="p-2 text-start">{t("القسم")}</th>
                  </tr>
                </thead>
                <tbody>
                  {fresh.map((p) => {
                    const off = p.needsEmail || !p.priceMills;
                    return (
                      <tr key={p.id} className="border-t border-slate-200 dark:border-slate-700">
                        <td className="p-2">
                          <input type="checkbox" name="pick" value={p.id} disabled={off} defaultChecked={!off && p.stock !== 0} />
                        </td>
                        <td className="p-2">
                          {p.name}
                          {p.needsEmail && (
                            <div className="text-xs text-amber-700">
                              {t("بيتفعّل على إيميل المشتري يدويًا، مش بيتسلم فوري")}
                            </div>
                          )}
                        </td>
                        <td className="whitespace-nowrap p-2">{usd(p.priceMills)}</td>
                        <td className="whitespace-nowrap p-2 font-semibold">
                          {money(
                            supplierPrice({
                              costMills: p.priceMills,
                              usdRate: settings.usdRate,
                              multiplierBps: settings.multiplierBps,
                            }),
                          )}
                        </td>
                        <td className="p-2">{p.stock === null ? "✓" : num(p.stock)}</td>
                        <td className="p-2">
                          <select
                            className="input py-1"
                            name={`cat_${p.id}`}
                            defaultValue={bySlug.get(guessCategorySlug(p.name)) ?? ""}
                          >
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.parent?.nameAr} / {c.nameAr}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </ActionForm>
        )}
      </section>
    </div>
  );
}
