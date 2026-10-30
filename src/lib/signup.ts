import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { sendEmail, withinLimit } from "./account-security";

const CODE_TTL = 15 * 60000;
const MAX_ATTEMPTS = 5;

export class SignupError extends Error {}

// Keyed with AUTH_SECRET: a leaked table can't be brute-forced offline in
// the million tries a 6-digit code would otherwise take.
function codeHash(id: string, code: string) {
  return createHmac("sha256", process.env.AUTH_SECRET || "")
    .update(id + ":" + code)
    .digest("hex");
}

function newCode() {
  return String(randomInt(0, 1000000)).padStart(6, "0");
}

type Deliver = (to: string, subject: string, text: string) => Promise<void>;

async function mailCode(email: string, code: string, deliver: Deliver) {
  await deliver(
    email,
    `كود تأكيد ديجي مصر: ${code}`,
    `كود تأكيد حسابك على ديجي مصر هو:\n\n${code}\n\nالكود شغال ١٥ دقيقة. لو انت ماعملتش حساب، تجاهل الرسالة دي.`,
  );
}

// Step 1: hold the sign-up and email a code. Returns the pending id for the
// browser cookie. Starting again with the same email replaces the old one.
export async function startSignup(
  input: { name: string; email: string; password: string; next?: string },
  deliver: Deliver = sendEmail,
) {
  if (await db.user.findUnique({ where: { email: input.email } }))
    throw new SignupError("الإيميل ده مسجّل قبل كده");
  if (!(await withinLimit("signup-code:" + input.email, 5, 3600000)))
    throw new SignupError("بعتنا أكواد كتير للإيميل ده، جرّب بعد شوية");
  const passwordHash = await bcrypt.hash(input.password, 12);
  const code = newCode();
  const data = {
    name: input.name,
    passwordHash,
    next: input.next ?? null,
    attempts: 0,
    codeHash: "",
    expiresAt: new Date(Date.now() + CODE_TTL),
  };
  const pending = await db.pendingSignup.upsert({
    where: { email: input.email },
    create: { email: input.email, ...data },
    update: data,
  });
  await db.pendingSignup.update({
    where: { id: pending.id },
    data: { codeHash: codeHash(pending.id, code) },
  });
  await mailCode(input.email, code, deliver);
  return pending.id;
}

export async function pendingSignup(id: string | undefined) {
  if (!id || id.length > 100) return null;
  const row = await db.pendingSignup.findUnique({ where: { id } });
  return row && row.expiresAt > new Date() ? row : null;
}

export async function resendSignupCode(id: string, deliver: Deliver = sendEmail) {
  const row = await pendingSignup(id);
  if (!row) throw new SignupError("التسجيل ده انتهى، ابدأ من الأول");
  if (!(await withinLimit("signup-code:" + row.email, 5, 3600000)))
    throw new SignupError("بعتنا أكواد كتير للإيميل ده، جرّب بعد شوية");
  const code = newCode();
  await db.pendingSignup.update({
    where: { id },
    data: {
      codeHash: codeHash(id, code),
      attempts: 0,
      expiresAt: new Date(Date.now() + CODE_TTL),
    },
  });
  await mailCode(row.email, code, deliver);
}

// Step 2: the right code creates the user, already verified.
export async function completeSignup(id: string, code: string) {
  if (!/^\d{6}$/.test(code)) throw new SignupError("الكود ٦ أرقام");
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "PendingSignup" WHERE id = ${id} FOR UPDATE`;
    const row = await tx.pendingSignup.findUnique({ where: { id } });
    if (!row || row.expiresAt <= new Date())
      throw new SignupError("الكود انتهى، ابدأ التسجيل من الأول");
    if (row.attempts >= MAX_ATTEMPTS)
      throw new SignupError("محاولات غلط كتير، اطلب كود جديد");
    const ok = timingSafeEqual(
      Buffer.from(row.codeHash, "hex"),
      Buffer.from(codeHash(id, code), "hex"),
    );
    if (!ok) {
      await tx.pendingSignup.update({
        where: { id },
        data: { attempts: { increment: 1 } },
      });
      return null;
    }
    await tx.pendingSignup.delete({ where: { id } });
    try {
      const user = await tx.user.create({
        data: {
          name: row.name,
          email: row.email,
          passwordHash: row.passwordHash,
          emailVerifiedAt: new Date(),
        },
      });
      return { user, next: row.next };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
        throw new SignupError("الإيميل ده مسجّل قبل كده");
      throw e;
    }
  });
}
