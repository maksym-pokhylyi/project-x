#!/bin/bash
# After conflicts are resolved by hand (merge still in progress, everything staged or not): verify, commit, push, deploy.
# usage: merge-continue.sh <commit message file> [--no-deploy]
set -o pipefail
MSG=$1
cd /home/user/project-x || exit 1
if git diff --name-only --diff-filter=U | grep -q .; then echo "STOP: unresolved conflicts"; git diff --name-only --diff-filter=U; exit 2; fi
if grep -rIl --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git --exclude-dir=.claude -E '^(<<<<<<<|>>>>>>>) ' src tests e2e scripts docs drizzle *.md *.ts *.json 2>/dev/null | head -5 | grep -q .; then echo "STOP: conflict markers left"; grep -rIl --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git --exclude-dir=.claude -E '^(<<<<<<<|>>>>>>>) ' src tests e2e scripts docs drizzle *.md *.ts *.json | head; exit 2; fi
pnpm install > /tmp/install.out 2>&1 || { echo "STOP: install"; tail -5 /tmp/install.out; exit 3; }
node scripts/ui-smells.mjs --json > tests/ui-smells.baseline.json
echo "ratchet: $(tr -d '\n ' < tests/ui-smells.baseline.json)"
pnpm typecheck > /tmp/tc.out 2>&1 || { echo "STOP: typecheck"; grep -E "error TS" /tmp/tc.out | head -25 | cut -c1-240; exit 4; }
pnpm lint > /tmp/lint.out 2>&1 || { echo "STOP: lint"; grep -B2 -E "error" /tmp/lint.out | head -30 | cut -c1-240; exit 5; }
if [ -z "$SKIP_UNIT" ]; then
PGPASSWORD=app psql -h localhost -U app -d postgres -qc 'DROP DATABASE IF EXISTS bidfolio_merge_test' -c 'CREATE DATABASE bidfolio_merge_test' > /dev/null 2>&1
TEST_DATABASE_URL=postgres://app:app@localhost:5432/bidfolio_merge_test pnpm test > /tmp/unit.out 2>&1 || { echo "STOP: unit tests"; grep -E " FAIL |AssertionError| × |Test Files|Tests " /tmp/unit.out | head -30 | cut -c1-260; exit 6; }
grep -E "Test Files|Tests " /tmp/unit.out | tr '\n' ' '; echo
else echo "unit tests: skipped (passed on this tree in the previous run)"; fi
PGPASSWORD=app psql -h localhost -U app -d postgres -qc 'DROP DATABASE IF EXISTS bidfolio_main_e2e' -c 'CREATE DATABASE bidfolio_main_e2e' > /dev/null 2>&1
rm -rf .next/cache/fetch-cache
E2E_DATABASE_URL=postgres://app:app@localhost:5432/bidfolio_main_e2e E2E_PORT=3182 pnpm e2e > /tmp/e2e.out 2>&1 || { echo "STOP: build or e2e"; grep -E "✘|Error:|failed|Build error|did not run|Type error" /tmp/e2e.out | head -30 | cut -c1-260; exit 7; }
grep -E "passed|skipped|failed" /tmp/e2e.out | tail -3 | tr '\n' ' '; echo
git add -A && git commit -q -F "$MSG" && git push -q origin main || { echo "STOP: commit/push"; exit 8; }
git log --oneline -1
if [ "$2" != "--no-deploy" ]; then bash /home/user/tools/deploy.sh 2>&1 | tail -2; fi
