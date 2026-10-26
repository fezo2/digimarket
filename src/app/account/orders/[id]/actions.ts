"use server";
import { requireUser } from "@/lib/auth";
import { sendMessage } from "@/lib/chat";
import { writeReview } from "@/lib/reviews";
import { openDispute, closeDispute } from "@/lib/disputes";
import {
  communityId,
  messageBody,
  reviewInput,
  disputeReason,
} from "@/lib/community-rules";
import {
  communityActionError,
  optionalImage,
} from "@/lib/community-action-error";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/action-form";
export async function sendChat(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  try {
    const result = await sendMessage(
      user.id,
      communityId.parse(form.get("orderId")),
      messageBody.parse(form.get("body")),
      optionalImage(form),
    );
    revalidatePath("/", "layout");
    return {
      success: result.flagged
        ? "مش مسموح بمشاركة وسائل تواصل خارج الموقع"
        : "الرسالة اتبعتت",
    };
  } catch (error) {
    return communityActionError(error);
  }
}
export async function submitReview(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  try {
    const positive =
      z.enum(["true", "false"]).parse(form.get("positive")) === "true";
    await writeReview(
      user.id,
      communityId.parse(form.get("itemId")),
      reviewInput.parse({ positive, comment: form.get("comment") ?? "" }),
      z.enum(["create", "edit"]).parse(form.get("mode")),
    );
    revalidatePath("/", "layout");
    return { success: "التقييم اتحفظ" };
  } catch (error) {
    return communityActionError(error);
  }
}
export async function submitDispute(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  try {
    await openDispute(
      user.id,
      communityId.parse(form.get("itemId")),
      disputeReason.parse(form.get("reason")),
      optionalImage(form),
    );
    revalidatePath("/", "layout");
    return { success: "الشكوى اتفتحت" };
  } catch (error) {
    return communityActionError(error);
  }
}
export async function solveDispute(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  try {
    const changed = await closeDispute(
      user.id,
      communityId.parse(form.get("disputeId")),
    );
    revalidatePath("/", "layout");
    return { success: changed ? "الشكوى اتقفلت" : "الشكوى اتعالجت قبل كده" };
  } catch (error) {
    return communityActionError(error);
  }
}
