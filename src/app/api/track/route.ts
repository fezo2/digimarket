import { cookies, headers } from "next/headers";
import { getSession } from "@/lib/auth";
import { recordProductEvent, visitorKey } from "@/lib/product-analytics";
import { VISITOR_COOKIE } from "@/lib/visitor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Product page view beacon, sent once by the page's script (see
// components/view-tracker.tsx). Crawlers that don't run scripts never reach
// it; the rest are filtered by user agent. Same-origin only (src/lib/cors.ts).
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { p?: unknown } | null;
  const productId = typeof body?.p === "string" && body.p.length <= 40 ? body.p : null;
  if (!productId) return new Response(null, { status: 400 });
  const h = await headers();
  // Prefetches and other non-navigation fetches are not views.
  if (h.get("sec-purpose")?.includes("prefetch")) return new Response(null, { status: 204 });
  const session = await getSession();
  // Admins checking listings aren't shoppers.
  if (session?.role !== "ADMIN") {
    const agent = h.get("user-agent");
    await recordProductEvent({
      productId,
      kind: "VIEW",
      agent,
      userId: session?.userId,
      visitor: visitorKey({
        cookie: (await cookies()).get(VISITOR_COOKIE)?.value,
        ip: h.get("x-forwarded-for")?.split(",")[0].trim(),
        agent,
      }),
    });
  }
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
