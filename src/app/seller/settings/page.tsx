import { requireSeller } from "@/lib/auth";
import { StoreProfileForm } from "../store-profile-form";

export default async function SettingsPage() {
  const { seller } = await requireSeller();
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-4 text-2xl font-bold">بيانات المتجر</h1>
      <div className="card p-6">
        <StoreProfileForm
          defaults={{
            description: seller.description ?? "",
            businessHours: seller.businessHours ?? "",
            telegramChatId: seller.telegramChatId ?? "",
          }}
        />
      </div>
    </div>
  );
}
