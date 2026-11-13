#!/bin/bash
# Deploys a ref (default origin/main) as a Vercel Preview deployment and points staging.bidfolio.co.uk at it.
# Staging has its own Neon branch, its own secrets, the dev outbox (DEV_TOOLS=1, secret-protected) and Paddle sandbox.
set -o pipefail
REF=${1:-origin/main}
cd /home/user/deploy
git fetch -q origin '+refs/heads/*:refs/remotes/origin/*'
git checkout -q -f --detach "$REF" || exit 1
echo "Deploying to staging: $(git log --oneline -1)"
export NODE_USE_ENV_PROXY=1 VERCEL_TELEMETRY_DISABLED=1 NODE_NO_WARNINGS=1
T="--token proxyinjectedPLACEHOLDER000000 --scope maksim-pokhiliys-projects"
OUT=$(timeout 1200 vercel deploy --yes $T 2>/tmp/staging-deploy.err)
URL=$(echo "$OUT" | grep -Eo 'https://[a-z0-9-]+\.vercel\.app' | tail -1)
if [ -z "$URL" ]; then echo "deploy failed"; grep -E 'Error|error|failed' /tmp/staging-deploy.err | head -20; exit 1; fi
echo "preview: $URL"
vercel alias set "$URL" staging.bidfolio.co.uk $T 2>&1 | grep -E 'Success|Error|error|now points' | head -3
sleep 3
curl -sS --max-time 40 https://staging.bidfolio.co.uk/api/health; echo
