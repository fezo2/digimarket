"use server";
import { requireAdmin } from "@/lib/auth";
import { moderateReview } from "@/lib/reviews";
import { communityId } from "@/lib/community-rules";
import { communityActionError } from "@/lib/community-action-error";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/action-form";
export async function changeVisibility(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const user = await requireAdmin();
  try {
    const changed = await moderateReview(
      user.id,
      communityId.parse(form.get("id")),
      z.enum(["true", "false"]).parse(form.get("hide")) === "true",
      z.string().trim().min(1).max(1000).parse(form.get("reason")),
    );
    revalidatePath("/", "layout");
    return { success: changed ? "التقييم اتحدّث" : "التقييم اتعالج قبل كده" };
  } catch (error) {
    return communityActionError(error);
  }
}
