import { z } from "zod";
import { WalletError } from "./wallet";
export function walletActionError(error: unknown) {
  if (error instanceof WalletError) return { error: error.message };
  if (error instanceof z.ZodError)
    return { error: error.issues[0]?.message ?? "راجع البيانات" };
  console.error("Wallet action failed", {
    kind: error instanceof Error ? error.name : "unknown",
  });
  return { error: "حصل خطأ، جرّب تاني" };
}
