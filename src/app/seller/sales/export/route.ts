import { requireSeller } from "@/lib/auth";
import { db } from "@/lib/db";
import { salesWhere, toCsv } from "@/lib/seller-tools";

const egp = (piasters: number) => (piasters / 100).toFixed(2);

export async function GET(req: Request) {
  const { seller } = await requireSeller();
  const p = new URL(req.url).searchParams;
  const items = await db.orderItem.findMany({
    where: salesWhere(
      seller.id,
      Object.fromEntries(
        ["q", "p", "from", "to", "product", "promo", "status", "delivery", "review"].map((k) => [k, p.get(k) ?? ""]),
      ),
    ),
    orderBy: { order: { paidAt: "desc" } },
    take: 10000,
    select: {
      title: true,
      quantity: true,
      total: true,
      commissionAmount: true,
      sellerNet: true,
      refundedAmount: true,
      deliveredAt: true,
      order: { select: { number: true, paidAt: true } },
    },
  });
  const csv = toCsv([
    ["التاريخ", "رقم الطلب", "المنتج", "الكمية", "الإجمالي", "العمولة", "الصافي", "المسترد", "اتسلّم"],
    ...items.map((i) => [
      i.order.paidAt?.toISOString().slice(0, 16).replace("T", " ") ?? "",
      i.order.number,
      i.title,
      i.quantity,
      egp(i.total),
      egp(i.commissionAmount),
      egp(i.sellerNet),
      egp(i.refundedAmount),
      i.deliveredAt ? "نعم" : "لا",
    ]),
  ]);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sales-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
