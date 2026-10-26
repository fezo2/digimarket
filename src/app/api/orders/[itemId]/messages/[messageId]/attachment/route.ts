import { requireUser } from "@/lib/auth";
import { readAttachment } from "@/lib/chat";
import { communityId } from "@/lib/community-rules";
import { z } from "zod";
export const runtime = "nodejs";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ itemId: string; messageId: string }> },
) {
  const user = await requireUser();
  try {
    const v = z
      .object({ itemId: communityId, messageId: communityId })
      .parse(await params);
    const file = await readAttachment(user.id, v.itemId, v.messageId);
    return new Response(new Uint8Array(file.body), {
      headers: {
        "Content-Type": file.type,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
