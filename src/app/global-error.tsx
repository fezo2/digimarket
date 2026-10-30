"use client";
import Link from "next/link";

// Replaces the root layout when it fails, so it brings its own <html>.
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  return (
    <html lang="ar" dir="rtl">
      <body style={{ fontFamily: "system-ui, sans-serif", textAlign: "center", padding: "4rem 1rem" }}>
        <h1>حصل خطأ، جرّب تاني بعد شوية</h1>
        <p>Something went wrong, please try again shortly.</p>
        {error.digest && <p style={{ fontSize: 12, color: "#64748b" }}>Ref: {error.digest}</p>}
        <Link href="/">ارجع للرئيسية · Home</Link>
      </body>
    </html>
  );
}
