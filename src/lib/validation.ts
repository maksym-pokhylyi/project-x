import { z } from "zod";
import { BILLING_INTERVALS, PAID_PLAN_KEYS } from "@/config/plans";
import { ValidationError } from "./errors";

/**
 * Zod schemas shared by client forms and the server (Server Actions re-validate
 * everything; client-side validation is only for fast feedback).
 */
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Enter a valid e-mail address.").max(254));
export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(128, "Use at most 128 characters.");
export const nameSchema = z.string().trim().min(1, "Enter your name.").max(80, "Use at most 80 characters.");

export const signUpSchema = z.object({ name: nameSchema, email: emailSchema, password: passwordSchema });
export const signInSchema = z.object({ email: emailSchema, password: z.string().min(1, "Enter your password.") });
export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({ password: passwordSchema });

export const profileSchema = z.object({ name: nameSchema });

export const workspaceNameSchema = z
  .string()
  .trim()
  .min(2, "Use at least 2 characters.")
  .max(60, "Use at most 60 characters.");
export const workspaceSchema = z.object({ name: workspaceNameSchema });

export const inviteRoleSchema = z.enum(["member", "admin"]);
export const inviteSchema = z.object({ email: emailSchema, role: inviteRoleSchema });
export const memberRoleSchema = z.enum(["member", "admin", "owner"]);

export const changePlanSchema = z.object({
  plan: z.enum(PAID_PLAN_KEYS as [string, ...string[]]),
  interval: z.enum(BILLING_INTERVALS),
});

export type FieldErrors = Record<string, string[]>;

/** Field errors keyed by the first path segment, for showing under inputs. */
export function fieldErrorsFrom(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

/** Server-side parse that throws the typed ValidationError (400) on failure. */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) throw new ValidationError(undefined, fieldErrorsFrom(result.error));
  return result.data;
}
