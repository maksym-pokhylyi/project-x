import { requestState } from "./request-state";

/** Test double for `next/headers` (see tests/helpers/auth.ts). */
export async function headers(): Promise<Headers> {
  return requestState.headers;
}

export async function cookies() {
  return {
    get: () => undefined,
    getAll: () => [],
    has: () => false,
    set: () => undefined,
    delete: () => undefined,
  };
}
