"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  adminActionError,
  createAnnouncement,
  forceLogout,
  setAnnouncementActive,
  setPayoutsFrozen,
  setSalesSuspended,
  setSellerTerms,
  suspendUser,
  unsuspendUser,
  updateUserProfile,
} from "@/lib/admin-control";
import type { ActionState } from "@/components/action-form";

const text = (form: FormData, key: string) => String(form.get(key) ?? "");
const flag = (form: FormData, key: string) => form.get(key) === "true";

async function run(
  work: (actorId: string) => Promise<boolean | string>,
  done: string,
  again = "اتنفّذ قبل كده",
): Promise<ActionState> {
  const admin = await requireAdmin();
  try {
    const changed = await work(admin.id);
    revalidatePath("/", "layout");
    return { success: changed ? done : again };
  } catch (error) {
    return adminActionError(error);
  }
}

export async function userSuspension(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const userId = text(form, "userId");
  return flag(form, "suspend")
    ? run((a) => suspendUser(a, userId, text(form, "reason")), "الحساب اتوقف")
    : run((a) => unsuspendUser(a, userId), "الحساب اترجّع");
}

export async function userLogout(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  return run(
    (a) => forceLogout(a, text(form, "userId")),
    "اتعمل خروج من كل الأجهزة",
  );
}

export async function userProfile(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  return run(
    (a) =>
      updateUserProfile(a, text(form, "userId"), {
        name: text(form, "name"),
        phone: text(form, "phone"),
        adminNote: text(form, "adminNote"),
      }),
    "البيانات اتحفظت",
  );
}

export async function sellerSales(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const suspend = flag(form, "suspend");
  return run(
    (a) =>
      setSalesSuspended(a, text(form, "sellerId"), suspend, text(form, "reason")),
    suspend ? "البيع اتوقف في المتجر" : "البيع رجع في المتجر",
  );
}

export async function sellerPayouts(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const freeze = flag(form, "freeze");
  return run(
    (a) =>
      setPayoutsFrozen(a, text(form, "sellerId"), freeze, text(form, "reason")),
    freeze ? "السحب اتجمّد" : "السحب اتفك",
  );
}

export async function sellerTerms(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  return run(
    (a) =>
      setSellerTerms(a, text(form, "sellerId"), {
        commission: text(form, "commission"),
        holdDays: text(form, "holdDays"),
      }),
    "الشروط اتحفظت",
  );
}

export async function newAnnouncement(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  return run(
    (a) =>
      createAnnouncement(a, {
        title: text(form, "title"),
        body: text(form, "body"),
      }),
    "الإعلان اتنشر للتجار",
  );
}

export async function announcementVisibility(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const active = flag(form, "active");
  return run(
    (a) => setAnnouncementActive(a, text(form, "id"), active),
    active ? "الإعلان ظاهر" : "الإعلان اتخفى",
  );
}
