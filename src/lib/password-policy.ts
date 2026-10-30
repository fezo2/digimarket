import { z } from "zod";

// Enforced whenever a password is set (sign up, reset, change). Existing
// passwords keep working until their owner changes them.
export const PASSWORD_MIN = 10;

// The most guessed passwords; a match is refused even if it passes the rules.
const COMMON = new Set([
  "password1!",
  "password123!",
  "p@ssw0rd123",
  "p@ssword123",
  "qwerty123!",
  "qwerty@123",
  "admin@1234",
  "admin12345!",
  "welcome123!",
  "abc12345678!",
  "1q2w3e4r5t!",
  "iloveyou123!",
  "123456789a!",
  "a123456789!",
  "123456789@a",
  "egypt12345!",
  "digiegy123!",
]);

export function passwordProblem(password: string, email?: string) {
  if (password.length < PASSWORD_MIN)
    return "الباسورد لازم ١٠ حروف على الأقل";
  if (password.length > 200) return "الباسورد طويل أوي";
  if (!/\p{L}/u.test(password) || !/\p{N}/u.test(password))
    return "الباسورد لازم يكون فيه حروف وأرقام";
  if (!/[^\p{L}\p{N}\s]/u.test(password))
    return "الباسورد لازم يكون فيه رمز زي ! أو @ أو #";
  if (/^(.)\1+$/u.test(password) || COMMON.has(password.toLowerCase()))
    return "الباسورد ده سهل التخمين، اختار غيره";
  const name = email?.split("@")[0].toLowerCase();
  if (name && name.length >= 4 && password.toLowerCase().includes(name))
    return "الباسورد ماينفعش يكون فيه اسم الإيميل";
  return null;
}

export const strongPassword = z.string().superRefine((value, ctx) => {
  const problem = passwordProblem(value);
  if (problem) ctx.addIssue({ code: "custom", message: problem });
});
