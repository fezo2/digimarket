// All amounts are integer piasters (1 EGP = 100 piasters).

const formatter = new Intl.NumberFormat("ar-EG", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatEGP(piasters: number): string {
  return `${formatter.format(piasters / 100)} ج.م`;
}

export function toPiasters(egp: string | number): number {
  const value = typeof egp === "number" ? egp : Number.parseFloat(egp);
  if (!Number.isFinite(value)) throw new Error("Invalid amount");
  return Math.round(value * 100);
}

export function commissionFor(amount: number, bps: number): number {
  return Math.round((amount * bps) / 10_000);
}

export function formatBps(bps: number): string {
  return `${bps / 100}%`;
}
