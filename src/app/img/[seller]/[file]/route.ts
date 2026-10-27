import { readProductImage } from "@/lib/product-image";

// Public product photos. Names are random and never reused, so the CDN and
// browsers may keep them forever.
export async function GET(
  _: Request,
  { params }: { params: Promise<{ seller: string; file: string }> },
) {
  const { seller, file } = await params;
  try {
    const { body, type } = await readProductImage(seller, file);
    if (!type.startsWith("image/")) throw new Error("not an image");
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
