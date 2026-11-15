import { indexNowKey } from "@/lib/indexnow";

// Proves to IndexNow that this site owns INDEXNOW_KEY (see src/lib/indexnow.ts).
export function GET() {
  const key = indexNowKey();
  if (!key) return new Response(null, { status: 404 });
  return new Response(key, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
