import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

// Time-based one-time codes (RFC 6238) as Google Authenticator, Microsoft
// Authenticator, Authy and 1Password make them: SHA-1, 6 digits, 30 seconds.

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const TOTP_PERIOD = 30;

export function base32Encode(bytes: Uint8Array) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string) {
  const clean = text.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const index = ALPHABET.indexOf(ch);
    if (index < 0) throw new Error("Invalid base32");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

// 160 random bits, the size RFC 4226 recommends.
export function newTotpSecret() {
  return base32Encode(randomBytes(20));
}

export function totpStep(now = Date.now()) {
  return Math.floor(now / 1000 / TOTP_PERIOD);
}

export function totpCode(secret: string, step: number) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 15;
  const number = hmac.readUInt32BE(offset) & 0x7fffffff;
  return String(number % 1_000_000).padStart(6, "0");
}

// The time step the code belongs to, allowing one step of clock drift either
// way, or null. Steps at or before lastStep were already used: a code read
// over someone's shoulder can't be replayed.
export function matchTotp(
  secret: string,
  code: string,
  lastStep: number | null = null,
  now = Date.now(),
) {
  const digits = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(digits)) return null;
  const current = totpStep(now);
  for (const step of [current - 1, current, current + 1]) {
    if (lastStep !== null && step <= lastStep) continue;
    const expected = Buffer.from(totpCode(secret, step));
    if (timingSafeEqual(expected, Buffer.from(digits))) return step;
  }
  return null;
}

export function otpauthUrl(secret: string, account: string, issuer: string) {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: String(TOTP_PERIOD),
  });
  return `otpauth://totp/${label}?${params}`;
}

// Backup codes look like "k7m2-x9qp": no 0/o/1/l to misread.
const BACKUP_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function newBackupCodes(count = 10) {
  return Array.from({ length: count }, () => {
    let code = "";
    for (let i = 0; i < 8; i++)
      code += BACKUP_ALPHABET[randomInt(BACKUP_ALPHABET.length)];
    return `${code.slice(0, 4)}-${code.slice(4)}`;
  });
}

export function normalizeBackupCode(code: string) {
  return code.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function looksLikeTotp(code: string) {
  return /^\d{6}$/.test(code.replace(/\s/g, ""));
}
