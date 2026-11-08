import { getCurrentUser, hiddenFromAdmin, onAdminPortal } from "@/lib/auth";
import { db } from "@/lib/db";
import { privateDownload } from "@/lib/private-download";

// Serves private KYC documents and payment receipts to admins only.
// The file must belong to a record the admin is allowed to see, so a
// staff admin can't open documents from before their start date.
export async function GET(
  _: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN" || !(await onAdminPortal())) return notFound();

  const key = (await params).key.join("/");
  const createdAt = await ownerDate(key);
  if (!createdAt || hiddenFromAdmin(user, createdAt)) return notFound();
  try {
    return await privateDownload(key, true);
  } catch {
    return notFound();
  }
}

function notFound() {
  return new Response("Not found", { status: 404 });
}

async function ownerDate(key: string) {
  if (key.startsWith("kyc/")) {
    const s = await db.kycSubmission.findFirst({
      where: {
        OR: [
          { idFrontKey: key },
          { idBackKey: key },
          { selfieKey: key },
          { commercialRegKey: key },
          { taxCardKey: key },
        ],
      },
      select: { submittedAt: true },
    });
    return s?.submittedAt;
  }
  if (key.startsWith("receipts/")) {
    const p = await db.manualPayment.findFirst({
      where: { receiptKey: key },
      select: { createdAt: true },
    });
    return p?.createdAt;
  }
  return undefined;
}
