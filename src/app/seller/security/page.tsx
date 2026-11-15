import { i18n } from "@/lib/prefs";
import { requireSeller } from "@/lib/auth";
import { PasswordForm } from "@/components/password-form";
import { TwoFactorSection } from "@/components/two-factor-section";
import { STAFF_PERMISSIONS } from "@/lib/seller-staff";
import { LeaveStoreForm } from "./leave-form";

export async function generateMetadata() {
  return { title: (await i18n()).t("أمان حسابي") };
}

// The owner and every staff member manage their own sign in here.
export default async function SellerSecurityPage() {
  const { t } = await i18n();
  const { user, seller, staff } = await requireSeller("ANY");
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold">{t("أمان حسابي")}</h1>
      <PasswordForm />
      <TwoFactorSection user={user} />
      {staff && (
        <section className="card space-y-3 p-6">
          <h2 className="text-lg font-bold">{t("شغلك في المتجر")}</h2>
          <p className="text-sm text-slate-600">
            {t("انت موظف في متجر {store} وتقدر تفتح:", { store: seller.storeName })}{" "}
            {STAFF_PERMISSIONS.filter((p) => staff.permissions.includes(p.key))
              .map((p) => t(p.label))
              .join("، ")}
          </p>
          <LeaveStoreForm />
        </section>
      )}
    </div>
  );
}
