"use client";

import { useEffect, useState } from "react";

// Phone-only bar above the tab bar on product pages: keeps the price and a buy
// button in reach while the buyer reads, and scrolls to the real buy box
// (options, quantity, checkout). Hidden while that box is on screen.
export function MobileBuyBar({ price, label, target }: { price: string; label: string; target: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const box = document.getElementById(target);
    if (!box) return;
    const io = new IntersectionObserver(([entry]) => setVisible(!entry.isIntersecting));
    io.observe(box);
    return () => io.disconnect();
  }, [target]);

  if (!visible) return null;
  return (
    <div className="fixed inset-x-0 bottom-16 z-30 border-t border-slate-200 bg-(--surface) px-4 py-2.5 shadow-[0_-4px_16px_rgb(0_0_0/0.06)] md:hidden">
      <div className="flex items-center gap-3">
        <span className="flex-1 text-xl font-extrabold">{price}</span>
        <button
          type="button"
          onClick={() => document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "center" })}
          className="btn h-11 bg-yellow-400 px-6 font-bold text-brand-950 hover:bg-yellow-300"
        >
          {label}
        </button>
      </div>
    </div>
  );
}
