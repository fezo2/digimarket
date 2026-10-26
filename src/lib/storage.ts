import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
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

export class UploadError extends Error {}

export async function savePrivateFile(folder: string, file: File): Promise<string> {
  if (!file || file.size === 0) throw new UploadError("الملف مطلوب");
  if (file.size > MAX_BYTES) throw new UploadError("حجم الملف أكبر من 8 ميجا");
  const ext = ALLOWED.get(file.type);
  if (!ext) throw new UploadError("نوع الملف لازم يكون صورة أو PDF");

  const key = `${folder}/${randomUUID()}.${ext}`;
  const target = resolveKey(key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, Buffer.from(await file.arrayBuffer()));
  return key;
}

export async function readPrivateFile(key: string) {
  const ext = key.split(".").pop() ?? "";
  const type = [...ALLOWED].find(([, e]) => e === ext)?.[0] ?? "application/octet-stream";
  return { body: await readFile(resolveKey(key)), type };
}

function resolveKey(key: string) {
  const target = path.resolve(ROOT, key);
  if (!target.startsWith(ROOT + path.sep)) throw new UploadError("Invalid key");
  return target;
}
