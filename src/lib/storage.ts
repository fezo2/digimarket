import "server-only";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { r2 } from "./r2";
import { validateKey, UploadError } from "./storage-rules";
export { UploadError } from "./storage-rules";
import { randomUUID } from "node:crypto";

// Private file storage. Local disk for development; the same interface
// will be backed by Cloudflare R2 in production.

const ROOT = path.resolve(process.env.STORAGE_DIR ?? "./storage");
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["application/pdf", "pdf"],
]);

export async function savePrivateFile(
  folder: string,
  file: File,
): Promise<string> {
  if (!file || file.size === 0) throw new UploadError("الملف مطلوب");
  const productUpload = /^products\/[^/\\]+$/.test(folder);
  const limit = productUpload ? 50 * 1024 * 1024 : MAX_BYTES;
  if (file.size > limit)
    throw new UploadError(`حجم الملف أكبر من ${productUpload ? 50 : 8} ميجا`);
  const ext =
    productUpload &&
    ["application/zip", "application/x-zip-compressed"].includes(file.type)
      ? "zip"
      : ALLOWED.get(file.type);
  if (!ext)
    throw new UploadError(
      productUpload
        ? "نوع الملف لازم يكون ZIP أو PDF أو صورة"
        : "نوع الملف لازم يكون صورة أو PDF",
    );

  const key = `${folder}/${randomUUID()}.${ext}`;
  if (process.env.STORAGE_DRIVER === "r2") {
    await r2().put(key, new Uint8Array(await file.arrayBuffer()), file.type);
    return key;
  }
  const target = resolveKey(key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, Buffer.from(await file.arrayBuffer()));
  return key;
}

export async function readPrivateFile(key: string) {
  const ext = key.split(".").pop() ?? "";
  const type =
    ext === "zip"
      ? "application/zip"
      : ([...ALLOWED].find(([, e]) => e === ext)?.[0] ??
        "application/octet-stream");
  validateKey(key);
  return {
    body:
      process.env.STORAGE_DRIVER === "r2"
        ? await r2().read(key)
        : await readFile(resolveKey(key)),
    type,
  };
}

export async function deletePrivateFile(key: string) {
  validateKey(key);
  if (process.env.STORAGE_DRIVER === "r2") {
    await r2().remove(key);
    return;
  }
  await rm(resolveKey(key), { force: true });
}

function resolveKey(key: string) {
  validateKey(key);
  const target = path.resolve(ROOT, key);
  if (!target.startsWith(ROOT + path.sep)) throw new UploadError("Invalid key");
  return target;
}
