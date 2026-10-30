"use client";
import { useEffect, useRef } from "react";
import { useI18n } from "@/components/i18n-provider";

type Turnstile = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
let loading: Promise<void> | null = null;

// Injected from this (nonce-trusted) bundle, so 'strict-dynamic' allows it.
function loadScript() {
  if (window.turnstile) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error("Turnstile failed to load"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

// Adds the cf-turnstile-response field to the surrounding form. Pass the
// form's state as resetKey: each token works once, so it renews per submit.
export function Captcha({ resetKey }: { resetKey?: unknown }) {
  const { lang } = useI18n();
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!SITE_KEY) return;
    let gone = false;
    loadScript()
      .then(() => {
        if (gone || !box.current || !window.turnstile) return;
        widget.current = window.turnstile.render(box.current, {
          sitekey: SITE_KEY,
          language: lang,
          theme: "auto",
        });
      })
      .catch(() => {});
    return () => {
      gone = true;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = undefined;
    };
  }, [lang]);

  useEffect(() => {
    if (widget.current) window.turnstile?.reset(widget.current);
  }, [resetKey]);

  if (!SITE_KEY) return null;
  return <div ref={box} className="min-h-[65px]" />;
}
