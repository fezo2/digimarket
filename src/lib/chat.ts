import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { lockOrder } from "./orders";
import { communityId, messageBody, maskContact } from "./community-rules";
import { CommunityError, ParticipantError } from "./community-error";
import {
  savePrivateFile,
  deletePrivateFile,
  readPrivateFile,
  UploadError,
} from "./storage";
type Tx = Prisma.TransactionClient;
export async function participant(tx: Tx, userId: string, orderId: string) {
  communityId.parse(orderId);
  communityId.parse(userId);
  const [user, order] = await Promise.all([
    tx.user.findUnique({ where: { id: userId }, select: { role: true } }),
    tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        number: true,
        buyerId: true,
        status: true,
        paidAt: true,
        items: {
          select: {
            id: true,
            sellerId: true,
            seller: { select: { userId: true } },
          },
        },
      },
    }),
  ]);
  if (
    !user ||
    !order ||
    !["PAID", "REFUNDED"].includes(order.status) ||
    (user.role !== "ADMIN" &&
      order.buyerId !== userId &&
      !order.items.some((i) => i.seller.userId === userId))
  )
    throw new ParticipantError("الطلب مش موجود");
  return {
    order,
    role:
      user.role === "ADMIN"
        ? "الإدارة"
        : order.buyerId === userId
          ? "المشتري"
          : "التاجر",
    admin: user.role === "ADMIN",
  };
}
async function sendAllowed(tx: Tx, order: { id: string; paidAt: Date | null }) {
  return (
    Boolean(
      order.paidAt && Date.now() <= order.paidAt.getTime() + 30 * 86400000,
    ) ||
    Boolean(
      await tx.dispute.findFirst({
        where: { status: "OPEN", orderItem: { orderId: order.id } },
      }),
    )
  );
}
export async function saveChatImage(orderId: string, file?: File) {
  if (!file || file.size === 0) return null;
  if (
    file.size > 5 * 1024 * 1024 ||
    !["image/jpeg", "image/png", "image/webp"].includes(file.type)
  )
    throw new UploadError("الصورة لازم JPG أو PNG أو WEBP وبحد أقصى ٥ ميجا");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const valid =
    file.type === "image/jpeg"
      ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : file.type === "image/png"
        ? [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)
        : Buffer.from(bytes.slice(0, 4)).toString() === "RIFF" &&
          Buffer.from(bytes.slice(8, 12)).toString() === "WEBP";
  if (!valid) throw new UploadError("محتوى الصورة مش صحيح");
  return savePrivateFile(`chat/${orderId}`, file);
}
export async function sendMessage(
  userId: string,
  orderId: string,
  body: string,
  image?: File,
) {
  const value = messageBody.parse(body);
  await participant(db, userId, orderId);
  const attachmentKey = await saveChatImage(orderId, image);
  try {
    return await db.$transaction(async (tx) => {
      await lockOrder(tx, orderId);
      const access = await participant(tx, userId, orderId);
      if (!(await sendAllowed(tx, access.order)))
        throw new CommunityError("مدة إرسال الرسائل انتهت");
      if (
        (await tx.message.count({
          where: {
            orderId,
            senderId: userId,
            createdAt: { gt: new Date(Date.now() - 600000) },
          },
        })) >= 20
      )
        throw new CommunityError(
          "استنى شوية، الحد الأقصى ٢٠ رسالة كل ١٠ دقايق",
        );
      const masked = access.admin
        ? { body: value, flagged: false }
        : maskContact(value);
      await tx.message.create({
        data: { orderId, senderId: userId, ...masked, attachmentKey },
      });
      return { flagged: masked.flagged };
    });
  } catch (error) {
    if (attachmentKey) await deletePrivateFile(attachmentKey);
    throw error;
  }
}
export async function readChat(userId: string, orderId: string) {
  return db.$transaction(async (tx) => {
    await lockOrder(tx, orderId);
    const access = await participant(tx, userId, orderId);
    const messages = await tx.message.findMany({
      where: { orderId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        body: true,
        flagged: true,
        attachmentKey: true,
        createdAt: true,
        senderId: true,
        sender: { select: { role: true } },
      },
    });
    await tx.orderRead.upsert({
      where: { orderId_userId: { orderId, userId } },
      create: { orderId, userId, lastReadAt: new Date() },
      update: { lastReadAt: new Date() },
    });
    return {
      canSend: await sendAllowed(tx, access.order),
      messages: messages.map((m) => ({
        id: m.id,
        body: m.body,
        createdAt: m.createdAt,
        flagged: access.admin && m.flagged,
        hasAttachment: Boolean(m.attachmentKey),
        role:
          m.sender.role === "ADMIN"
            ? "الإدارة"
            : m.senderId === access.order.buyerId
              ? "المشتري"
              : "التاجر",
      })),
    };
  });
}
export async function readAttachment(
  userId: string,
  orderId: string,
  messageId: string,
) {
  communityId.parse(messageId);
  await participant(db, userId, orderId);
  const message = await db.message.findFirst({
    where: { id: messageId, orderId },
    select: { attachmentKey: true },
  });
  if (!message?.attachmentKey) throw new ParticipantError("الصورة مش موجودة");
  return readPrivateFile(message.attachmentKey);
}
export async function unreadCounts(
  userId: string,
  onlyDisputes = false,
  scope: "all" | "buyer" | "seller" = "all",
) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!user) return new Map<string, number>();
  const orders = await db.order.findMany({
    where: {
      status: { in: ["PAID", "REFUNDED"] },
      ...(scope === "buyer"
        ? { buyerId: userId }
        : scope === "seller"
          ? { items: { some: { seller: { userId } } } }
          : user.role === "ADMIN"
            ? {}
            : {
                OR: [
                  { buyerId: userId },
                  { items: { some: { seller: { userId } } } },
                ],
              }),
      ...(onlyDisputes
        ? { items: { some: { disputes: { some: { status: "OPEN" } } } } }
        : {}),
    },
    select: { id: true },
  });
  if (!orders.length) return new Map<string, number>();
  const rows = await db.$queryRaw<
    { orderId: string; count: bigint }[]
  >`SELECT m."orderId", count(*) FROM "Message" m LEFT JOIN "OrderRead" r ON r."orderId" = m."orderId" AND r."userId" = ${userId} WHERE m."orderId" IN (${Prisma.join(orders.map((o) => o.id))}) AND m."senderId" <> ${userId} AND (r."lastReadAt" IS NULL OR m."createdAt" > r."lastReadAt") GROUP BY m."orderId"`;
  return new Map(rows.map((r) => [r.orderId, Number(r.count)]));
}
