"use server";
import { requireSeller } from "@/lib/auth";
import { db } from "@/lib/db";
import { createTelegramLink } from "@/lib/telegram";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { addReply, deleteReply, toolError } from "@/lib/seller-tools";
import type { ActionState } from "@/components/action-form";
export async function telegramSettings(
  _: { error?: string; link?: string; success?: string },
  form: FormData,
): Promise<{ error?: string; link?: string; success?: string }> {
  const { seller } = await requireSeller();
  const action = z.enum(["link", "unlink"]).safeParse(form.get("operation"));
  if (!action.success || !process.env.TELEGRAM_BOT_TOKEN)
    return { error: "الربط مش متاح" };
  if (action.data === "link")
    return { link: await createTelegramLink(seller.id) };
  await db.$transaction([
    db.sellerProfile.update({
      where: { id: seller.id },
      data: { telegramChatId: null, telegramLinkedAt: null },
    }),
    db.telegramLinkToken.deleteMany({ where: { sellerId: seller.id } }),
  ]);
  return { success: "اتلغى الربط" };
}

export async function saveReply(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { seller } = await requireSeller();
  try {
    await addReply(seller.id, {
      title: String(form.get("title") ?? ""),
      body: String(form.get("body") ?? ""),
    });
    revalidatePath("/seller/settings");
    return { success: "الرد اتحفظ" };
  } catch (error) {
    return toolError(error);
  }
}

export async function removeReply(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { seller } = await requireSeller();
  await deleteReply(seller.id, String(form.get("id") ?? ""));
  revalidatePath("/seller/settings");
  return { success: "اتمسح" };
}
