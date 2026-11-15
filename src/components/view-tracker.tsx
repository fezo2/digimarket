"use client";

import { useEffect } from "react";
import { VISITOR_COOKIE, validVisitorId } from "@/lib/visitor";

function visitorId() {
  const found = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${VISITOR_COOKIE}=`))
    ?.slice(VISITOR_COOKIE.length + 1);
  if (validVisitorId(found)) return found;
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const id = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${VISITOR_COOKIE}=${id}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax${secure}`;
  return id;
}

// Counts one product page view. The server keeps one per visitor per day,
// so re-renders and refreshes are harmless.
export function ViewTracker({ productId }: { productId: string }) {
  useEffect(() => {
    // Automated browsers announce themselves here.
    if (navigator.webdriver) return;
    visitorId();
    const timer = setTimeout(() => {
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ p: productId }),
        keepalive: true,
      }).catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
  }, [productId]);
  return null;
}
