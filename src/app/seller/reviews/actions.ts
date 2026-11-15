"use server";
import { requireSeller } from "@/lib/auth";
import { replyReview } from "@/lib/reviews";
import { communityId } from "@/lib/community-rules";
import { communityActionError } from "@/lib/community-action-error";
import { z } from "zod";
import { revalidatePath, revalidateTag } from "next/cache";
import { CATALOG_TAG } from "@/lib/storefront";
import type { ActionState } from "@/components/action-form";
export async function sendReply(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { seller } = await requireSeller("MESSAGES");
  try {
    await replyReview(
      seller.userId,
      communityId.parse(form.get("reviewId")),
      z.string().trim().min(1).max(1000).parse(form.get("reply")),
    );
    revalidatePath("/", "layout");
    revalidateTag(CATALOG_TAG);
    return { success: "الرد اتحفظ" };
  } catch (error) {
    return communityActionError(error);
  }
}
