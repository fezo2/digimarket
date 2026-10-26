"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export function ChatRefresh() {
  const router = useRouter();
  useEffect(() => {
    let lastActivity = Date.now();
    const activity = () => {
      lastActivity = Date.now();
    };
    const events = ["pointerdown", "keydown", "scroll"];
    events.forEach((event) =>
      window.addEventListener(event, activity, { passive: true }),
    );
    const timer = setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastActivity < 30 * 60000
      )
        router.refresh();
    }, 10000);
    return () => {
      clearInterval(timer);
      events.forEach((event) => window.removeEventListener(event, activity));
    };
  }, [router]);
  return null;
}
