#!/bin/bash
# Merge a branch into main, verify everything, commit, push and deploy — in one go. Stops at the first failure.
# usage: merge-verify.sh <branch> <commit message file>
set -o pipefail
BR=$1; MSG=$2
cd /home/user/project-x || exit 1
if [ -n "$(git status --short)" ]; then echo "STOP: working tree not clean"; git status --short | head; exit 1; fi
git merge --no-ff --no-commit "$BR" > /tmp/merge.out 2>&1
if git status --short | grep -qE '^(UU|AA|DU|UD|AU|UA)'; then echo "STOP: conflicts"; git status --short | grep -E '^(UU|AA|DU|UD|AU|UA)'; exit 2; fi
if [ -x /home/user/tools/post-merge-fix.sh ]; then bash /home/user/tools/post-merge-fix.sh || { echo "STOP: post-merge fix failed"; exit 3; }; fi
pnpm install > /tmp/install.out 2>&1 || { echo "STOP: install"; tail -5 /tmp/install.out; exit 3; }
node scripts/ui-smells.mjs --json > tests/ui-smells.baseline.json
echo "ratchet: $(tr -d '\n ' < tests/ui-smells.baseline.json)"
pnpm typecheck > /tmp/tc.out 2>&1 || { echo "STOP: typecheck"; tail -15 /tmp/tc.out; exit 4; }
pnpm lint > /tmp/lint.out 2>&1 || { echo "STOP: lint"; tail -15 /tmp/lint.out; exit 5; }
TEST_DATABASE_URL=postgres://app:app@localhost:5432/bidfolio_merge_test pnpm test > /tmp/unit.out 2>&1 || { echo "STOP: unit tests"; grep -E " FAIL |AssertionError| × |Test Files|Tests " /tmp/unit.out | head -20 | cut -c1-260; exit 6; }
grep -E "Test Files|Tests " /tmp/unit.out | tr '\n' ' '; echo
PGPASSWORD=app psql -h localhost -U app -d postgres -qc 'DROP DATABASE IF EXISTS bidfolio_main_e2e' -c 'CREATE DATABASE bidfolio_main_e2e' > /dev/null 2>&1
E2E_DATABASE_URL=postgres://app:app@localhost:5432/bidfolio_main_e2e E2E_PORT=3182 pnpm e2e > /tmp/e2e.out 2>&1 || { echo "STOP: build or e2e"; grep -E "✘|Error:|failed|Build error|did not run" /tmp/e2e.out | head -20 | cut -c1-260; exit 7; }
grep -E "passed|skipped|failed" /tmp/e2e.out | tail -3 | tr '\n' ' '; echo
git add -A && git commit -q -F "$MSG" && git push -q origin main || { echo "STOP: commit/push"; exit 8; }
git log --oneline -1
bash /home/user/tools/deploy.sh 2>&1 | tail -2
