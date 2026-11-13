// Preload for CLI scripts that import app modules:  tsx --import ./scripts/register-server-only.mjs <script>
//
// App modules start with `import "server-only"`, a marker package that throws outside the
// Next.js server bundle. Scripts ARE server code, so resolve it to an empty module here.
// (Vitest does the same through an alias in vitest.config.ts.)
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { url: "data:text/javascript,export {};", shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
