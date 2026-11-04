import type { Site } from "./sites";

// Each portal (store, seller, admin) has its own password for the same email.
// The seller and admin passwords start out null and then fall back to the
// store password, so an account works everywhere until it changes one.

type Passwords = {
  passwordHash: string;
  sellerPasswordHash: string | null;
  adminPasswordHash: string | null;
};

type Versions = {
  sessionVersion: number;
  storeSessionVersion: number;
  sellerSessionVersion: number;
  adminSessionVersion: number;
};

// The hash a sign in on this portal is checked against.
export function passwordHashFor(user: Passwords, site: Site) {
  if (site === "seller") return user.sellerPasswordHash ?? user.passwordHash;
  if (site === "admin") return user.adminPasswordHash ?? user.passwordHash;
  return user.passwordHash;
}

// The per-portal sign-out counter a session cookie on this portal carries.
export function siteSessionVersion(user: Versions, site: Site) {
  if (site === "seller") return user.sellerSessionVersion;
  if (site === "admin") return user.adminSessionVersion;
  return user.storeSessionVersion;
}

// Prisma update data that sets this portal's password and signs out its
// other sessions. When the store password changes, a seller or admin still
// on the fallback first keeps the old one, so their portal is unaffected.
export function sitePasswordUpdate(
  user: Passwords & { role: string; hasStore: boolean },
  site: Site,
  hash: string,
) {
  if (site === "seller")
    return {
      sellerPasswordHash: hash,
      sellerSessionVersion: { increment: 1 },
    };
  if (site === "admin")
    return { adminPasswordHash: hash, adminSessionVersion: { increment: 1 } };
  return {
    passwordHash: hash,
    storeSessionVersion: { increment: 1 },
    ...(user.hasStore && !user.sellerPasswordHash
      ? { sellerPasswordHash: user.passwordHash }
      : {}),
    ...(user.role === "ADMIN" && !user.adminPasswordHash
      ? { adminPasswordHash: user.passwordHash }
      : {}),
  };
}

export function isSite(value: unknown): value is Site {
  return value === "store" || value === "seller" || value === "admin";
}
