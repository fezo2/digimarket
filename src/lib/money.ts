// All amounts are integer piasters (1 EGP = 100 piasters).

const formatter = new Intl.NumberFormat("ar-EG", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatEGP(piasters: number): string {
  return `${formatter.format(piasters / 100)} ج.م`;
}

export function toPiasters(egp: string | number): number {
  const text = String(egp);
  if (!/^-?\d+(\.\d{1,2})?$/.test(text)) throw new Error("Invalid amount");
  const [whole, fraction = ""] = text.replace(/^-/, "").split(".");
  return (
    (text.startsWith("-") ? -1 : 1) *
    (Number(whole) * 100 + Number(fraction.padEnd(2, "0")))
  );
}

export function commissionFor(amount: number, bps: number): number {
  return Math.round((amount * bps) / 10_000);
}

export function formatBps(bps: number): string {
  return `${bps / 100}%`;
}

export function parseEGP(value: string): number {
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(value)) throw new Error("Invalid amount");
  return toPiasters(value);
}
