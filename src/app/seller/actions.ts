"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSeller, requireVerifiedUser } from "@/lib/auth";
import { deletePrivateFile, UploadError } from "@/lib/storage";
import { finalizeUpload } from "@/lib/finalize-upload";
import { slugify, uniqueSuffix } from "@/lib/slug";

export type FormState = { error?: string } | undefined;

const joinSchema = z.object({
  storeName: z
    .string()
    .trim()
    .min(3, "اسم المتجر لازم 3 حروف على الأقل")
    .max(40),
  type: z.enum(["INDIVIDUAL", "COMPANY"]),
});

export async function joinAsSeller(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const user = await requireVerifiedUser("/seller/join");
  if (user.seller) redirect("/seller");

  const parsed = joinSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  let slug = slugify(parsed.data.storeName);
  if (await db.sellerProfile.findUnique({ where: { slug } }))
    slug = `${slug}-${uniqueSuffix()}`;

  await db.$transaction([
    db.sellerProfile.create({
      data: {
        userId: user.id,
        storeName: parsed.data.storeName,
        slug,
        type: parsed.data.type,
      },
    }),
    db.user.update({
      where: { id: user.id },
      data: { role: user.role === "ADMIN" ? "ADMIN" : "SELLER" },
    }),
  ]);
  redirect("/seller/kyc");
}

const kycSchema = z
  .object({
    type: z.enum(["INDIVIDUAL", "COMPANY"]),
    fullName: z.string().trim().min(5, "اكتب الاسم كامل زي البطاقة"),
    nationalId: z
      .string()
      .trim()
      .regex(/^[23]\d{13}$/, "الرقم القومي لازم 14 رقم"),
    phone: z
      .string()
      .trim()
      .regex(/^01[0125]\d{8}$/, "رقم الموبايل مش صحيح"),
    companyName: z.string().trim().optional(),
    commercialRegNo: z.string().trim().optional(),
    taxCardNo: z.string().trim().optional(),
    payoutMethod: z.enum(["INSTAPAY", "BANK_TRANSFER", "MOBILE_WALLET"]),
    payoutAccount: z.string().trim().min(5, "اكتب بيانات استلام الأرباح"),
    payoutAccountName: z.string().trim().min(3, "اكتب اسم صاحب الحساب"),
  })
  .superRefine((v, ctx) => {
    if (v.type === "COMPANY") {
      if (!v.companyName)
        ctx.addIssue({ code: "custom", message: "اكتب اسم الشركة" });
      if (!v.commercialRegNo)
        ctx.addIssue({ code: "custom", message: "اكتب رقم السجل التجاري" });
      if (!v.taxCardNo)
        ctx.addIssue({ code: "custom", message: "اكتب رقم البطاقة الضريبية" });
    }
  });

export async function submitKyc(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const { user, seller } = await requireSeller();
  if (seller.kycStatus === "PENDING" || seller.kycStatus === "APPROVED")
    redirect("/seller");

  const parsed = kycSchema.safeParse(
    Object.fromEntries([...form].filter(([, v]) => typeof v === "string")),
  );
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  const folder = `kyc/${seller.id}`;
  const created: string[] = [];
  async function upload(name: string) {
    const key = await finalizeUpload(
      user.id,
      folder,
      "kyc",
      (form.get(name + "Pending") || form.get(name)) as File | string,
    );
    created.push(key);
    return key;
  }
  try {
    const idFrontKey = await upload("idFront");
    const idBackKey = await upload("idBack");
    const selfieKey = await upload("selfie");
    const commercialRegKey =
      data.type === "COMPANY" ? await upload("commercialReg") : null;
    const taxCardKey = data.type === "COMPANY" ? await upload("taxCard") : null;

    await db.$transaction([
      db.kycSubmission.create({
        data: {
          sellerId: seller.id,
          type: data.type,
          fullName: data.fullName,
          nationalId: data.nationalId,
          phone: data.phone,
          idFrontKey,
          idBackKey,
          selfieKey,
          companyName: data.type === "COMPANY" ? data.companyName : null,
          commercialRegNo:
            data.type === "COMPANY" ? data.commercialRegNo : null,
          taxCardNo: data.type === "COMPANY" ? data.taxCardNo : null,
          commercialRegKey,
          taxCardKey,
          payoutMethod: data.payoutMethod,
          payoutAccount: data.payoutAccount,
          payoutAccountName: data.payoutAccountName,
        },
      }),
      db.sellerProfile.update({
        where: { id: seller.id },
        data: { kycStatus: "PENDING", type: data.type },
      }),
    ]);
  } catch (e) {
    await Promise.all(created.map((key) => deletePrivateFile(key)));
    if (e instanceof UploadError) return { error: e.message };
    throw e;
  }

  revalidatePath("/seller");
  redirect("/seller");
}

const profileSchema = z.object({
  description: z.string().trim().max(500).optional(),
  businessHours: z.string().trim().max(100).optional(),
});

export async function updateStoreProfile(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const { seller } = await requireSeller();
  const parsed = profileSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await db.sellerProfile.update({
    where: { id: seller.id },
    data: {
      description: parsed.data.description || null,
      businessHours: parsed.data.businessHours || null,
    },
  });
  revalidatePath("/seller");
  return {};
}
