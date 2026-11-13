/** Whether `pnpm db:migrate` may run in this environment, and why (see migrate-policy.mjs). */
export function migrationDecision(env: Record<string, string | undefined>): { run: boolean; reason: string };
