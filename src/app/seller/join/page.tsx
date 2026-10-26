import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { SELLER_TIERS } from "@/lib/config";
import { JoinForm } from "./join-form";

export const metadata = { title: "ابدأ البيع" };

export default async function JoinPage() {
  const user = await requireUser("/seller/join");
  if (user.seller) redirect("/seller");

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold">ابدأ البيع</h1>
      <p className="mt-2 text-slate-600">
        هتعمل متجرك في دقيقة، وبعدها هنطلب منك توثيق الهوية. منتجاتك هتظهر للناس بعد ما نراجع التوثيق.
      </p>
      <div className="my-6 grid gap-4 sm:grid-cols-2">
        {(["INDIVIDUAL", "COMPANY"] as const).map((t) => (
          <div key={t} className="card p-5">
            <p className="text-lg font-bold">{SELLER_TIERS[t].label}</p>
            <p className="mb-3 text-sm text-slate-500">
              {t === "INDIVIDUAL" ? "بالبطاقة الشخصية" : "بالسجل التجاري والبطاقة الضريبية"}
            </p>
            <ul className="space-y-1 text-sm">
              <li>• الأرباح متاحة للسحب بعد {SELLER_TIERS[t].holdDays} أيام</li>
              <li>• لحد {SELLER_TIERS[t].maxActiveProducts.toLocaleString("ar-EG")} منتج نشط</li>
              <li>• شارة &quot;{SELLER_TIERS[t].badge}&quot;</li>
            </ul>
          </div>
        ))}
      </div>
      <JoinForm />
    </div>
  );
}
