import { i18n } from "@/lib/prefs";
import { TelegramForm } from "./telegram-form";
import { requireSeller } from "@/lib/auth";
import { StoreProfileForm } from "../store-profile-form";
import { db } from "@/lib/db";
import { PasswordForm } from "@/components/password-form";
import { RepliesSection } from "./replies";

export default async function SettingsPage() {
  const { t } = await i18n();
  const { seller } = await requireSeller();
  const replies = await db.sellerReply.findMany({
    where: { sellerId: seller.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true, body: true },
  });
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold">{t("إعدادات المتجر")}</h1>
      <div className="card p-6">
        <StoreProfileForm
          defaults={{
            description: seller.description ?? "",
            businessHours: seller.businessHours ?? "",
          }}
        />
      </div>
      {process.env.TELEGRAM_BOT_TOKEN && (
        <TelegramForm linked={!!seller.telegramLinkedAt} />
      )}
      <RepliesSection replies={replies} />
      <PasswordForm />
    </div>
  );
}
