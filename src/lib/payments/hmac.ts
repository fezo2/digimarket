import { createHmac, timingSafeEqual } from "node:crypto";

const fields = [
  "amount_cents",
  "created_at",
  "currency",
  "error_occured",
  "has_parent_transaction",
  "id",
  "integration_id",
  "is_3d_secure",
  "is_auth",
  "is_capture",
  "is_refunded",
  "is_standalone_payment",
  "is_voided",
  "order.id",
  "owner",
  "pending",
  "source_data.pan",
  "source_data.sub_type",
  "source_data.type",
  "success",
];

export function paymobHmac(obj: Record<string, unknown>, secret: string) {
  const data = fields
    .map((field) => {
      let value: unknown = obj;
      for (const key of field.split("."))
        value =
          value && typeof value === "object"
            ? (value as Record<string, unknown>)[key]
            : undefined;
      return value === undefined || value === null ? "" : String(value);
    })
    .join("");
  return createHmac("sha512", secret).update(data).digest("hex");
}

export function verifyPaymobHmac(
  obj: Record<string, unknown>,
  received: string | null,
  secret: string,
) {
  if (!secret || !received || !/^[a-f0-9]{128}$/i.test(received)) return false;
  return timingSafeEqual(
    Buffer.from(paymobHmac(obj, secret), "hex"),
    Buffer.from(received, "hex"),
  );
}
