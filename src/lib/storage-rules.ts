export class UploadError extends Error {}
export type UploadKind = "product" | "kyc" | "chat";
const types: Record<string, string> = {
  "application/zip": "zip",
  "application/x-zip-compressed": "zip",
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
export function validateKey(key: string) {
  if (
    !/^(kyc|products|chat|pending)\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\.(jpg|png|webp|pdf|zip)$/.test(
      key,
    ) ||
    key.includes("..")
  )
    throw new UploadError("مفتاح الملف مش صحيح");
  return key;
}
export function uploadSpec(kind: UploadKind, size: number, type: string) {
  const limit = kind === "product" ? 50 : kind === "chat" ? 5 : 8;
  const ext = types[type];
  if (
    !Number.isSafeInteger(size) ||
    size <= 0 ||
    size > limit * 1024 * 1024 ||
    !ext ||
    (kind !== "product" && ext === "zip") ||
    (kind === "chat" && ext === "pdf")
  )
    throw new UploadError("نوع أو حجم الملف مش مسموح");
  return ext;
}
export function checkMagic(bytes: Uint8Array, type: string) {
  const b = Buffer.from(bytes);
  const ok = type.includes("zip")
    ? b.subarray(0, 4).equals(Buffer.from([80, 75, 3, 4]))
    : type === "application/pdf"
      ? b.subarray(0, 4).toString() === "%PDF"
      : type === "image/jpeg"
        ? b[0] === 255 && b[1] === 216 && b[2] === 255
        : type === "image/png"
          ? b
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : type === "image/webp" &&
            b.subarray(0, 4).toString() === "RIFF" &&
            b.subarray(8, 12).toString() === "WEBP";
  if (!ok) throw new UploadError("محتوى الملف مش مطابق لنوعه");
}
export function fileType(key: string) {
  const ext = key.split(".").pop();
  return (
    Object.entries(types).find(([, e]) => e === ext)?.[0] ||
    "application/octet-stream"
  );
}
