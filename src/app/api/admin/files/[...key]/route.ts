import { getCurrentUser } from "@/lib/auth";
import { readPrivateFile } from "@/lib/storage";

// Serves private KYC documents to admins only.
export async function GET(_: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") return new Response("Not found", { status: 404 });

  const { key } = await params;
  try {
    const file = await readPrivateFile(key.join("/"));
    return new Response(new Uint8Array(file.body), {
      headers: { "Content-Type": file.type, "Cache-Control": "private, no-store" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
