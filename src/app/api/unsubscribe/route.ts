import { db } from "@/lib/db";
import { unsubscribeTokenValid } from "@/lib/checkout-reminder-text";

// One-click unsubscribe (RFC 8058): mail apps POST here straight from the
// List-Unsubscribe header, and the /unsubscribe page's button posts here too.
// GET never unsubscribes, so link scanners can't do it by opening the link.
export async function POST(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("u") ?? "";
  const token = url.searchParams.get("t") ?? "";
  if (!unsubscribeTokenValid(userId, token, process.env.AUTH_SECRET))
    return new Response(null, { status: 400 });
  await db.user.updateMany({
    where: { id: userId, checkoutRemindersOffAt: null },
    data: { checkoutRemindersOffAt: new Date() },
  });
  // The page's form wants to land back on the page; mail apps ignore this.
  if (request.headers.get("content-type")?.includes("application/x-www-form-urlencoded")) {
    const form = await request.formData();
    if (form.get("from") === "page") {
      const back = new URL("/unsubscribe", url);
      back.searchParams.set("done", "1");
      return Response.redirect(back, 303);
    }
  }
  return new Response(null, { status: 200 });
}
