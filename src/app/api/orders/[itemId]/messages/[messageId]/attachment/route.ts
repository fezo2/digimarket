import { requireUser } from "@/lib/auth";
import { privateDownload } from "@/lib/private-download";
import { attachmentKey } from "@/lib/chat";
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
    return await privateDownload(
      await attachmentKey(user.id, v.itemId, v.messageId),
      true,
    );
  } catch {
    return new Response(null, { status: 404 });
  }
}
