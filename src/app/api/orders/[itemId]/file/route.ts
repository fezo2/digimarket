import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { readPrivateFile } from "@/lib/storage";

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
    const file = await readPrivateFile(item.deliveryContent);
    return new Response(new Uint8Array(file.body), {
      headers: {
        "Content-Type": file.type,
        "Content-Disposition": "attachment",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
