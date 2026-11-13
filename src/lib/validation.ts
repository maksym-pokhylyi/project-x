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
/**
 * Person and workspace names are shown to other people and placed in the subject and body
 * of e-mails sent from our domain (invitations). So: no control characters and nothing
 * that reads as a link — otherwise a name becomes a phishing message with our sender.
 */
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f\u2028\u2029]/;
const LOOKS_LIKE_A_LINK = /(?:[a-z][a-z0-9+.-]*:\/\/|\bwww\.|\b[a-z0-9-]+\.[a-z]{2,}\/)/i;

const displayText = (schema: z.ZodString) =>
  schema
    .refine((value) => !CONTROL_CHARACTERS.test(value), "Remove line breaks and control characters.")
    .refine((value) => !LOOKS_LIKE_A_LINK.test(value), "Names cannot contain links.");

export const nameSchema = displayText(z.string().trim().min(1, "Enter your name.").max(80, "Use at most 80 characters."));

/** Best-effort clean-up for names we do not get to reject (e.g. from an OAuth profile). */
export function sanitizeDisplayName(value: string, fallback: string): string {
  const cleaned = value
    .replace(new RegExp(CONTROL_CHARACTERS.source, "g"), " ")
    .replace(/[a-z][a-z0-9+.-]*:\/\/\S*/gi, " ")
    .replace(/\bwww\.\S*/gi, " ")
    .replace(/\b[a-z0-9-]+\.[a-z]{2,}\/\S*/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
    .trim();
  return cleaned || fallback;
}

export const signUpSchema = z.object({ name: nameSchema, email: emailSchema, password: passwordSchema });
export const signInSchema = z.object({ email: emailSchema, password: z.string().min(1, "Enter your password.") });
export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({ password: passwordSchema });

export const profileSchema = z.object({ name: nameSchema });

export const workspaceNameSchema = displayText(
  z.string().trim().min(2, "Use at least 2 characters.").max(60, "Use at most 60 characters."),
);
export const workspaceSchema = z.object({ name: workspaceNameSchema });
/** Lowercase letters, digits and single dashes — what slugify() produces. */
export const workspaceSlugSchema = z
  .string()
  .min(2)
  .max(48)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, digits and dashes.");

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
