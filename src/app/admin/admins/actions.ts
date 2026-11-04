"use server";
import { revalidatePath } from "next/cache";
import { requireFullAdmin } from "@/lib/auth";
import {
  addStaffAdmin,
  adminActionError,
  removeStaffAdmin,
  setStaffDataFrom,
} from "@/lib/admin-control";
import type { ActionState } from "@/components/action-form";

const text = (form: FormData, key: string) => String(form.get(key) ?? "");

async function run(
  work: (actorId: string) => Promise<unknown>,
  done: string,
): Promise<ActionState> {
  const admin = await requireFullAdmin();
  try {
    await work(admin.id);
    revalidatePath("/admin/admins");
    return { success: done };
  } catch (error) {
    return adminActionError(error);
  }
}

export async function addStaff(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  return run(
    (a) =>
      addStaffAdmin(a, {
        name: text(form, "name"),
        email: text(form, "email"),
        password: text(form, "password"),
        dataFrom: text(form, "dataFrom"),
      }),
    "الأدمن اتضاف، يقدر يدخل دلوقتي من موقع الأدمن",
  );
}

export async function staffDate(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  return run(
    (a) => setStaffDataFrom(a, text(form, "userId"), text(form, "dataFrom")),
    "التاريخ اتغيّر",
  );
}

export async function removeStaff(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  return run(
    (a) => removeStaffAdmin(a, text(form, "userId")),
    "صلاحية الأدمن اتشالت",
  );
}
