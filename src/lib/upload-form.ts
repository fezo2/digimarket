"use client";
import { createUploadUrl } from "@/app/uploads/actions";
import type { UploadKind } from "./storage-rules";
// Runs in the useActionState callback before invoking the mutation, so large blobs
// never travel through the Server Action request in R2 mode.
export async function prepareUploads(
  form: FormData,
  kind: UploadKind,
  fields: string[],
  context = "",
) {
  for (const name of fields) {
    const file = form.get(name);
    if (!(file instanceof File) || !file.size) continue;
    const result = await createUploadUrl(kind, file.size, file.type, context);
    if (result.local) continue;
    const response = await fetch(result.url, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!response.ok) throw new Error("رفع الملف فشل، جرّب تاني");
    form.delete(name);
    form.set(name + "Pending", result.key);
  }
  return form;
}
