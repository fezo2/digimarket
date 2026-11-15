"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  TwoFactorError,
  confirmTwoFactorSetup,
  disableTwoFactor,
  regenerateBackupCodes,
  startTwoFactorSetup,
} from "@/lib/two-factor";

export type TwoFactorState = {
  error?: string;
  success?: string;
  setup?: { qr: string; secret: string };
  codes?: string[];
};

async function run(work: () => Promise<TwoFactorState>): Promise<TwoFactorState> {
  try {
    const result = await work();
    revalidatePath("/", "layout");
    return result;
  } catch (e) {
    if (e instanceof TwoFactorError) return { error: e.message };
    throw e;
  }
}

export async function beginTwoFactor(): Promise<TwoFactorState> {
  const user = await requireUser();
  return run(async () => {
    const { qr, secret } = await startTwoFactorSetup(user.id);
    return { setup: { qr, secret } };
  });
}

export async function finishTwoFactor(
  prev: TwoFactorState,
  form: FormData,
): Promise<TwoFactorState> {
  const user = await requireUser();
  const result = await run(async () => ({
    codes: await confirmTwoFactorSetup(user.id, String(form.get("code") ?? "")),
    success: "التحقق بخطوتين اتفعّل",
  }));
  // A wrong code keeps the QR on screen.
  return result.error ? { ...result, setup: prev.setup } : result;
}

export async function turnOffTwoFactor(
  _: TwoFactorState,
  form: FormData,
): Promise<TwoFactorState> {
  const user = await requireUser();
  return run(async () => {
    await disableTwoFactor(user.id, String(form.get("code") ?? ""));
    return { success: "التحقق بخطوتين اتقفل" };
  });
}

export async function renewBackupCodes(
  _: TwoFactorState,
  form: FormData,
): Promise<TwoFactorState> {
  const user = await requireUser();
  return run(async () => ({
    codes: await regenerateBackupCodes(user.id, String(form.get("code") ?? "")),
    success: "الأكواد الاحتياطية القديمة اتلغت",
  }));
}
