"use server";
import { requireAdmin } from "@/lib/auth";
import { resolveDispute } from "@/lib/disputes";
import { communityId } from "@/lib/community-rules";
import { communityActionError } from "@/lib/community-action-error";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/components/action-form";
export async function decideDispute(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const user = await requireAdmin();
  try {
    const changed = await resolveDispute(
      user.id,
      communityId.parse(form.get("id")),
      z.enum(["true", "false"]).parse(form.get("refund")) === "true",
      z.string().trim().min(1).max(1000).parse(form.get("note")),
    );
    revalidatePath("/", "layout");
    return {
      success: changed ? "قرار الشكوى اتسجل" : "الشكوى اتعالجت قبل كده",
    };
  } catch (error) {
    return communityActionError(error);
  }
}
