import { randomBytes } from "node:crypto";

// Keeps Arabic letters so store and product URLs stay readable.
export function slugify(input: string): string {
  const base = input
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "item";
}

export function uniqueSuffix() {
  return randomBytes(3).toString("hex");
}
