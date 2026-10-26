"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSeller } from "@/lib/auth";
import { db } from "@/lib/db";
import { productInput } from "@/lib/product-input";
import { productSaveStatus } from "@/lib/product-review";
import { addStockCodes } from "@/lib/product-stock";
import { savePrivateFile, deletePrivateFile, UploadError } from "@/lib/storage";
import { SELLER_TIERS } from "@/lib/config";
import { slugify, uniqueSuffix } from "@/lib/slug";

export type State = { error?: string; message?: string } | undefined;
class ProductError extends Error {}
const idInput = z.string().min(1).max(100);

async function lockSeller(tx: Prisma.TransactionClient, id: string) {
  // Serialize tier checks and stock deduplication across the seller's requests.
  await tx.$queryRaw`SELECT id FROM "SellerProfile" WHERE id = ${id} FOR UPDATE`;
  const seller = await tx.sellerProfile.findUniqueOrThrow({ where: { id } });
  if (seller.kycStatus !== "APPROVED")
    throw new ProductError("لازم توثّق حسابك الأول");
  return seller;
}
function refresh() {
  revalidatePath("/seller/products", "layout");
  revalidatePath("/", "layout");
}
function failure(error: unknown): State {
  if (error instanceof ProductError || error instanceof UploadError)
    return { error: error.message };
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  )
    return { error: "في تعارض، جرّب تحفظ تاني" };
  throw error;
}

export async function saveProduct(_: State, form: FormData): Promise<State> {
  const { seller } = await requireSeller();
  if (seller.kycStatus !== "APPROVED")
    return { error: "لازم توثّق حسابك الأول" };
  const id = String(form.get("id") ?? "");
  if (id && !idInput.safeParse(id).success)
    return { error: "المنتج غير موجود" };
  let json;
  try {
    json = {
      options: JSON.parse(String(form.get("options") ?? "[]")),
      discounts: JSON.parse(String(form.get("discounts") ?? "[]")),
    };
  } catch {
    return { error: "راجع الاختيارات والخصومات" };
  }
  const parsed = productInput.safeParse({
    ...Object.fromEntries(form),
    ...json,
  });
  if (!parsed.success) {
    const message = parsed.error.issues[0].message;
    return {
      error: /[\u0600-\u06ff]/.test(message)
        ? message
        : "راجع البيانات المطلوبة والأسعار والاختيارات",
    };
  }
  const v = parsed.data;
  let savedId = "";
  let uploadedFileKey: string | undefined;
  try {
    const file = form.get("deliveryFile");
    if (v.deliveryType === "FILE" && file instanceof File && file.size) {
      // Check ownership before writing; recheck it inside the transaction too.
      if (
        id &&
        !(await db.product.findFirst({
          where: { id, sellerId: seller.id },
          select: { id: true },
        }))
      )
        throw new ProductError("المنتج غير موجود");
      uploadedFileKey = await savePrivateFile(`products/${seller.id}`, file);
    }
    savedId = await db.$transaction(
      async (tx) => {
        const currentSeller = await lockSeller(tx, seller.id);
        const old = id
          ? await tx.product.findFirst({
              where: { id, sellerId: seller.id },
              include: {
                options: { include: { values: true } },
                quantityDiscounts: true,
              },
            })
          : null;
        if (id && !old) throw new ProductError("المنتج غير موجود");
        if (!(await tx.category.findUnique({ where: { id: v.categoryId } })))
          throw new ProductError("اختار قسم صحيح");
        let content: string | null =
          v.deliveryType === "UNIQUE_CODES" ? null : v.deliveryContent;
        if (v.deliveryType === "FILE") {
          // Never accept a storage key supplied by the browser.
          content =
            uploadedFileKey ??
            (old?.deliveryType === "FILE" ? old.deliveryContent : null);
          if (!content) throw new ProductError("ارفع ملف التسليم");
        }
        const status = productSaveStatus(
          old,
          { ...v, deliveryContent: content, quantityDiscounts: v.discounts },
          v.intent,
        );
        if (status === "PENDING_REVIEW") {
          const count = await tx.product.count({
            where: {
              sellerId: seller.id,
              status: { in: ["ACTIVE", "PENDING_REVIEW"] },
              ...(id ? { id: { not: id } } : {}),
            },
          });
          if (count >= SELLER_TIERS[currentSeller.type].maxActiveProducts)
            throw new ProductError(
              "وصلت للحد الأقصى للمنتجات النشطة وقيد المراجعة",
            );
        }
        let slug = old?.slug ?? slugify(v.title);
        if (!old && (await tx.product.findUnique({ where: { slug } })))
          slug += `-${uniqueSuffix()}`;
        const data = {
          title: v.title,
          slug,
          categoryId: v.categoryId,
          description: v.description,
          imageUrl: v.imageUrl || null,
          price: v.price,
          compareAtPrice: v.compareAtPrice,
          deliveryType: v.deliveryType,
          deliveryContent: content,
          instructions: v.instructions || null,
          minQty: v.minQty,
          maxQty: v.maxQty,
          status,
          reviewNote: null,
        };
        const product = old
          ? await tx.product.update({ where: { id: old.id }, data })
          : await tx.product.create({ data: { ...data, sellerId: seller.id } });
        await tx.productOption.deleteMany({ where: { productId: product.id } });
        await tx.quantityDiscount.deleteMany({
          where: { productId: product.id },
        });
        for (const [sortOrder, o] of v.options.entries())
          await tx.productOption.create({
            data: {
              productId: product.id,
              name: o.name,
              kind: o.kind,
              required: o.required,
              sortOrder,
              values: {
                create:
                  o.kind === "select"
                    ? o.values.map((x, sortOrder) => ({ ...x, sortOrder }))
                    : [],
              },
            },
          });
        if (v.discounts.length)
          await tx.quantityDiscount.createMany({
            data: v.discounts.map((d) => ({ ...d, productId: product.id })),
          });
        return product.id;
      },
      { timeout: 30000 },
    );
  } catch (error) {
    // Only remove this attempt's upload; an existing file can be shared by clones.
    if (uploadedFileKey) {
      try {
        await deletePrivateFile(uploadedFileKey);
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          "Product save failed and its delivery upload could not be removed",
        );
      }
    }
    return failure(error);
  }
  refresh();
  redirect(`/seller/products/${savedId}?saved=1`);
}

export async function manageProduct(_: State, form: FormData): Promise<State> {
  const { seller } = await requireSeller();
  if (seller.kycStatus !== "APPROVED")
    return { error: "لازم توثّق حسابك الأول" };
  const parsed = z
    .object({
      id: z.string().max(100),
      operation: z.enum(["toggle", "clone", "stopAll"]),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "طلب غير صحيح" };
  const { id, operation } = parsed.data;
  let clonedId: string | undefined;
  try {
    await db.$transaction(async (tx) => {
      await lockSeller(tx, seller.id);
      if (operation === "stopAll") {
        await tx.product.updateMany({
          where: { sellerId: seller.id },
          data: { salesEnabled: false },
        });
        return;
      }
      const p = await tx.product.findFirst({
        where: { id, sellerId: seller.id },
        include: {
          options: { include: { values: true } },
          quantityDiscounts: true,
        },
      });
      if (!p) throw new ProductError("المنتج غير موجود");
      if (operation === "toggle") {
        await tx.product.update({
          where: { id: p.id },
          data: { salesEnabled: !p.salesEnabled },
        });
        return;
      }
      const copy = await tx.product.create({
        data: {
          sellerId: seller.id,
          categoryId: p.categoryId,
          title: `${p.title} (نسخة)`,
          slug: `${slugify(p.title)}-${uniqueSuffix()}`,
          description: p.description,
          imageUrl: p.imageUrl,
          price: p.price,
          compareAtPrice: p.compareAtPrice,
          deliveryType: p.deliveryType,
          deliveryContent: p.deliveryContent,
          instructions: p.instructions,
          minQty: p.minQty,
          maxQty: p.maxQty,
          status: "DRAFT",
          salesEnabled: true,
          options: {
            create: p.options.map((o) => ({
              name: o.name,
              kind: o.kind,
              required: o.required,
              sortOrder: o.sortOrder,
              values: {
                create: o.values.map((x) => ({
                  label: x.label,
                  priceDelta: x.priceDelta,
                  sortOrder: x.sortOrder,
                })),
              },
            })),
          },
          quantityDiscounts: {
            create: p.quantityDiscounts.map((d) => ({
              minQty: d.minQty,
              percentOff: d.percentOff,
            })),
          },
        },
      });
      clonedId = copy.id;
    });
  } catch (error) {
    return failure(error);
  }
  refresh();
  if (clonedId) redirect(`/seller/products/${clonedId}`);
  return {
    message:
      operation === "stopAll" ? "كل المبيعات اتوقفت" : "حالة المبيعات اتغيّرت",
  };
}

export async function manageStock(_: State, form: FormData): Promise<State> {
  const { seller } = await requireSeller();
  if (seller.kycStatus !== "APPROVED")
    return { error: "لازم توثّق حسابك الأول" };
  const parsed = z
    .object({
      id: idInput,
      operation: z.enum(["add", "delete"]),
      stockId: z.string().max(100).optional(),
      codes: z.string().max(2_000_000).optional(),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "طلب غير صحيح أو حجم الأكواد كبير" };
  const v = parsed.data;
  try {
    let text = v.codes ?? "";
    const file = form.get("codesFile");
    if (v.operation === "add" && file instanceof File && file.size) {
      if (!file.name.toLowerCase().endsWith(".txt") || file.size > 2_000_000)
        return { error: "ارفع ملف txt بحد أقصى 2 ميجا" };
      text += `\n${await file.text()}`;
    }
    const lines = text
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean);
    if (lines.length > 10000 || lines.some((x) => x.length > 10000))
      return { error: "ارفع بحد أقصى 10000 كود، وكل كود أقل من 10000 حرف" };
    if (v.operation === "add" && !lines.length)
      return { error: "اكتب الأكواد أو ارفع ملف" };
    const message = await db.$transaction(async (tx) => {
      await lockSeller(tx, seller.id);
      const p = await tx.product.findFirst({
        where: { id: v.id, sellerId: seller.id, deliveryType: "UNIQUE_CODES" },
      });
      if (!p) throw new ProductError("المنتج غير موجود أو مش بيستخدم أكواد");
      if (v.operation === "delete") {
        const result = await tx.stockItem.deleteMany({
          where: { id: v.stockId ?? "", productId: p.id, status: "AVAILABLE" },
        });
        if (!result.count) throw new ProductError("الكود مش متاح للحذف");
        return "الكود اتحذف";
      }
      const result = await addStockCodes(tx.stockItem, p.id, lines);
      return `اتضاف ${result.added}، اتشال ${result.duplicates} مكرر`;
    });
    refresh();
    return { message };
  } catch (error) {
    return failure(error);
  }
}
