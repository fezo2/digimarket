import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { privateDownload } from "@/lib/private-download";

export const runtime = "nodejs";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 404 });
  const { itemId } = await params;
  const item = await db.orderItem.findFirst({
    where: {
      id: itemId,
      deliveryType: "FILE",
      deliveredAt: { not: null },
      order: { buyerId: user.id, status: "PAID" },
    },
    select: { deliveryContent: true },
  });
  if (!item?.deliveryContent) return new Response(null, { status: 404 });
  try {
    return await privateDownload(item.deliveryContent);
  } catch {
    return new Response(null, { status: 404 });
  }
}
