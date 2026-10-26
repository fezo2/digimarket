import "server-only";
import { r2 } from "./r2";
import { savePrivateFile } from "./storage";
import { UploadError, type UploadKind } from "./storage-rules";
export async function finalizeUpload(
  userId: string,
  folder: string,
  kind: UploadKind,
  file: File | string,
) {
  if (typeof file === "string") {
    if (process.env.STORAGE_DRIVER !== "r2")
      throw new UploadError("الرفع المباشر مش متاح");
    return r2().finalize(userId, file, folder, kind);
  }
  if (process.env.STORAGE_DRIVER === "r2")
    throw new UploadError("استخدم الرفع المباشر");
  return savePrivateFile(folder, file);
}
