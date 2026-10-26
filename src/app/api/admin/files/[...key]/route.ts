import { getCurrentUser } from "@/lib/auth";
import { privateDownload } from "@/lib/private-download";

// Serves private KYC documents to admins only.
export async function GET(
  _: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") return new Response("Not found", { status: 404 });

  const { key } = await params;
  try {
    return await privateDownload(key.join("/"));
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
