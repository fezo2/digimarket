import { jwtVerify } from "jose";
import type { Role } from "@prisma/client";

// Edge-safe: used by middleware as well as server code.

export const SESSION_COOKIE = "dm_session";

export type Session = { userId: string; role: Role; sessionVersion?: number };

export function authSecret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32)
    throw new Error("AUTH_SECRET must be at least 32 characters");
  return new TextEncoder().encode(value);
}

export async function readSessionToken(
  token: string | undefined,
): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, authSecret());
    return {
      userId: String(payload.userId),
      role: payload.role as Role,
      sessionVersion:
        typeof payload.sessionVersion === "number"
          ? payload.sessionVersion
          : undefined,
    };
  } catch {
    return null;
  }
}
