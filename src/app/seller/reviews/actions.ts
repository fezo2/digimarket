"use server";
import { requireSeller } from "@/lib/auth";
import { replyReview } from "@/lib/reviews";
import { communityId } from "@/lib/community-rules";
import { communityActionError } from "@/lib/community-action-error";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/components/action-form";
export async function sendReply(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { user } = await requireSeller();
  try {
    await replyReview(
      user.id,
      communityId.parse(form.get("reviewId")),
      z.string().trim().min(1).max(1000).parse(form.get("reply")),
    );
    revalidatePath("/", "layout");
    return { success: "الرد اتحفظ" };
  } catch (error) {
    return communityActionError(error);
  }
}
