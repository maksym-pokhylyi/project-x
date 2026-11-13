#!/bin/bash
# Runs the four module browser suites (each with its own build, port and database) one after another and prints one line each.
# usage: e2e-others.sh [dir] [config ...]
DIR=${1:-/home/user/project-x}; shift
cd "$DIR" || exit 1
CONFIGS=${@:-procurement bids notifications outreach}
for c in $CONFIGS; do
  rm -rf .next/cache/fetch-cache
  E2E_PORT=3190 timeout 1500 pnpm exec playwright test -c playwright.$c.config.ts --trace off > /tmp/e2e-$c.out 2>&1
  code=$?
  echo "$c: exit $code — $(grep -E '^\s+[0-9]+ (passed|failed|skipped|flaky|did not run)' /tmp/e2e-$c.out | tr -s ' ' | tr '\n' ' ')"
  if [ $code -ne 0 ]; then grep -E "^\s+[0-9]+\) |✘|Error: |Build error|Type error" /tmp/e2e-$c.out | head -12 | cut -c1-240; fi
done
