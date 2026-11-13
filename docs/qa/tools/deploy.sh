#!/usr/bin/env bash
# Deploys origin/main to Vercel production from a clean checkout (the main working tree may contain work in progress).
set -euo pipefail
cd /home/user/deploy
git fetch -q origin main
git checkout -q -f --detach origin/main
echo "Deploying $(git log --oneline -1)"
export NODE_USE_ENV_PROXY=1 VERCEL_TELEMETRY_DISABLED=1 NODE_NO_WARNINGS=1
timeout 1200 vercel deploy --prod --yes --token proxyinjectedPLACEHOLDER000000 --scope maksim-pokhiliys-projects 2>&1 | grep -E '"message"|Error|error|failed|readyState' | head -20
curl -sS --max-time 30 https://project-x-ten-omega.vercel.app/api/health; echo
