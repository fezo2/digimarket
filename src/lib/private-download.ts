import "server-only";
import { readPrivateFile } from "./storage";
import { r2 } from "./r2";
export async function privateDownload(key: string, inline = false) {
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": inline ? "inline" : "attachment",
  };
  if (process.env.STORAGE_DRIVER === "r2")
    return new Response(null, {
      status: 302,
      headers: { ...headers, Location: await r2().download(key, inline) },
    });
  const file = await readPrivateFile(key);
  return new Response(new Uint8Array(file.body), {
    headers: { ...headers, "Content-Type": file.type },
  });
}
