import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Unused values are almost always a bug; allow the conventional `_` escape hatch.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      // All server logging goes through src/lib/logger.ts so output stays structured.
      "no-console": "error",
      // Design system: a control that navigates is a <ButtonLink href>, one that acts is a
      // <Button>. Button classes never go on a link by hand (docs/design/DESIGN.md §6).
      // A warning while the remaining call sites are moved; then make it an error.
      "no-restricted-syntax": [
        "warn",
        {
          selector: 'JSXElement[openingElement.name.name="Button"] > JSXElement[openingElement.name.name=/^(Link|a)$/]',
          message: "A link inside <Button asChild>: use <ButtonLink href=…> from @/components/ui/button-link instead.",
        },
      ],
    },
  },
  {
    files: ["scripts/**", "e2e/**", "tests/**", "src/lib/logger.ts"],
    rules: { "no-console": "off" },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "node_modules/**",
    "playwright-report/**",
    "test-results/**",
    "docs/**",
    ".data/**",
    // Agent/tooling worktrees are full copies of the repo; never lint them from here.
    ".claude/**",
  ]),
]);

export default eslintConfig;
