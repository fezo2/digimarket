import type { parseNotice } from "./payments/sms-parse";

export type Candidate = {
  id: string;
  number: number;
  total: number;
  payAmount: number | null;
  payFrom: string | null;
  manualPayment: { reference: string; status: string } | null;
};

// Pure decision, exported for tests. Strongest evidence first: the sender's
// number plus the amount, then the unique amount, then the buyer's reference.
export function pickOrder(
  notice: ReturnType<typeof parseNotice>,
  candidates: Candidate[],
): { order?: Candidate; reason: string } {
  const amountFits = (c: Candidate) =>
    notice.amounts.includes(c.total) ||
    (c.payAmount !== null && notice.amounts.includes(c.payAmount));
  const one = (list: Candidate[]) => (list.length === 1 ? list[0] : undefined);
  const byPhone = candidates.filter(
    (c) => c.payFrom && notice.phones.includes(c.payFrom) && amountFits(c),
  );
  if (one(byPhone)) return { order: byPhone[0], reason: "الرقم والمبلغ" };
  const byAmount = candidates.filter(
    (c) => c.payAmount !== null && notice.amounts.includes(c.payAmount),
  );
  if (one(byAmount)) return { order: byAmount[0], reason: "المبلغ المميز" };
  const byRef = candidates.filter(
    (c) =>
      c.manualPayment?.status === "SUBMITTED" &&
      notice.references.includes(c.manualPayment.reference) &&
      amountFits(c),
  );
  if (one(byRef)) return { order: byRef[0], reason: "رقم العملية والمبلغ" };
  if (byPhone.length > 1 || byAmount.length > 1 || byRef.length > 1)
    return { reason: "أكتر من طلب ينفع، محتاج مراجعة" };
  return { reason: "مفيش طلب مفتوح بالمبلغ ده" };
}
