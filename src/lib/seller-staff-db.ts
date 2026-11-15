import "server-only";
import { z } from "zod";
import type { StaffPermission } from "@prisma/client";
import { db } from "./db";
import { MAX_STAFF, isStaffPermission } from "./seller-staff";

export class StaffError extends Error {}

const email = z.string().trim().toLowerCase().email("الإيميل مش صحيح").max(254);

function permissionsFrom(values: unknown[]): StaffPermission[] {
  const list = [...new Set(values.filter(isStaffPermission))];
  if (!list.length) throw new StaffError("اختار صلاحية واحدة على الأقل");
  return list;
}

// The employee signs up on the site first, then the owner adds that email.
export async function addStaff(sellerId: string, rawEmail: string, values: unknown[]) {
  const address = email.parse(rawEmail);
  const permissions = permissionsFrom(values);
  return db.$transaction(async (tx) => {
    // One add at a time per store, so the limit holds.
    await tx.$queryRaw`SELECT id FROM "SellerProfile" WHERE id = ${sellerId} FOR UPDATE`;
    const seller = await tx.sellerProfile.findUniqueOrThrow({
      where: { id: sellerId },
      select: { userId: true, storeName: true, _count: { select: { staff: true } } },
    });
    if (seller._count.staff >= MAX_STAFF)
      throw new StaffError(`الحد الأقصى ${MAX_STAFF} موظفين`);
    const user = await tx.user.findUnique({
      where: { email: address },
      include: { seller: { select: { id: true } }, staffOf: { select: { sellerId: true } } },
    });
    if (!user)
      throw new StaffError("مفيش حساب بالإيميل ده. خلّي الموظف يعمل حساب على الموقع الأول");
    if (user.id === seller.userId) throw new StaffError("ده حسابك انت");
    if (user.role === "ADMIN") throw new StaffError("حسابات الإدارة مينفعش تبقى موظفين");
    if (user.suspendedAt) throw new StaffError("الحساب ده موقوف");
    if (user.seller) throw new StaffError("صاحب الإيميل ده عنده متجر خاص بيه");
    if (user.staffOf)
      throw new StaffError(
        user.staffOf.sellerId === sellerId
          ? "الموظف ده مضاف بالفعل"
          : "صاحب الإيميل ده موظف في متجر تاني",
      );
    const staff = await tx.sellerStaff.create({
      data: { sellerId, userId: user.id, permissions },
    });
    await tx.auditLog.create({
      data: {
        actorId: seller.userId,
        action: "seller.staff_added",
        targetId: user.id,
        data: JSON.stringify({ sellerId, permissions }),
      },
    });
    return staff;
  });
}

export async function updateStaff(sellerId: string, staffId: string, values: unknown[]) {
  const permissions = permissionsFrom(values);
  const changed = await db.sellerStaff.updateMany({
    where: { id: staffId, sellerId },
    data: { permissions },
  });
  if (!changed.count) throw new StaffError("الموظف مش موجود");
}

export async function removeStaff(sellerId: string, staffId: string) {
  const staff = await db.sellerStaff.findFirst({
    where: { id: staffId, sellerId },
    select: { userId: true, seller: { select: { userId: true } } },
  });
  if (!staff) throw new StaffError("الموظف مش موجود");
  await db.$transaction([
    db.sellerStaff.delete({ where: { id: staffId } }),
    // Their open seller-site sessions end right away.
    db.user.update({
      where: { id: staff.userId },
      data: { sellerSessionVersion: { increment: 1 } },
    }),
    db.auditLog.create({
      data: {
        actorId: staff.seller.userId,
        action: "seller.staff_removed",
        targetId: staff.userId,
        data: JSON.stringify({ sellerId }),
      },
    }),
  ]);
}

// An employee leaving on their own.
export async function leaveStore(userId: string) {
  await db.sellerStaff.deleteMany({ where: { userId } });
}


// Staff with the messages permission answer a store's order chats as the
// store, so buyers see "the seller" and the owner sees the replies too.
// Anyone else, and staff on their own purchases, act as themselves.
export async function chatActorId(
  user: {
    id: string;
    staffOf?: { sellerId: string; permissions: StaffPermission[]; seller: { userId: string } } | null;
  },
  orderId: string,
) {
  const staff = user.staffOf;
  if (!staff?.permissions.includes("MESSAGES")) return user.id;
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { buyerId: true, items: { select: { sellerId: true } } },
  });
  if (!order || order.buyerId === user.id) return user.id;
  return order.items.some((i) => i.sellerId === staff.sellerId)
    ? staff.seller.userId
    : user.id;
}
