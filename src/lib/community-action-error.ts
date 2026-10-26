import { notFound } from "next/navigation";
import { z } from "zod";
import { CommunityError, ParticipantError } from "./community-error";
import { UploadError } from "./storage";
export function communityActionError(error: unknown) {
  if (error instanceof ParticipantError) notFound();
  if (error instanceof CommunityError || error instanceof UploadError)
    return { error: error.message };
  if (error instanceof z.ZodError)
    return { error: error.issues[0]?.message ?? "راجع البيانات" };
  return { error: "حصل خطأ، جرّب تاني" };
}
export function optionalImage(form: FormData) {
  const value = form.get("image");
  if (value === null || value === "") return undefined;
  return z.instanceof(File).parse(value);
}
