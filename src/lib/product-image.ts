import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { r2 } from "./r2";
import {
  UploadError,
  checkMagic,
  fileType,
  productImageExt,
  validateKey,
} from "./storage-rules";

// Product photos live in the private bucket under images/<seller>/ and are
// served publicly by /img/<seller>/<file> (src/app/img), so the bucket
// itself never needs public access.
const ROOT = path.resolve(process.env.STORAGE_DIR ?? "./storage");
const PUBLIC_PREFIX = "/img/";

export async function saveProductImage(sellerId: string, file: File) {
  const ext = productImageExt(file.size, file.type);
  const bytes = new Uint8Array(await file.arrayBuffer());
  checkMagic(bytes, file.type);
  const key = validateKey(`images/${sellerId}/${randomUUID()}.${ext}`);
  if (process.env.STORAGE_DRIVER === "r2") await r2().put(key, bytes, file.type);
  else {
    const target = path.resolve(ROOT, key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }
  return PUBLIC_PREFIX + key.slice("images/".length);
}

export async function readProductImage(seller: string, name: string) {
  const key = validateKey(`images/${seller}/${name}`);
  const body =
    process.env.STORAGE_DRIVER === "r2"
      ? await r2().read(key)
      : await readFile(path.resolve(ROOT, key));
  return { body, type: fileType(key) };
}

export { UploadError };
