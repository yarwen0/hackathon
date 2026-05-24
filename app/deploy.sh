#!/usr/bin/env bash
# Deploy EGI Workbench to Vercel.
# Prerequisites:
#   1. Vercel account (https://vercel.com/signup)
#   2. `npx vercel login` already completed
# This script links the project, sets env vars, deploys to production,
# and runs a smoke test.

set -euo pipefail

cd "$(dirname "$0")"

# Pull GROQ_API_KEY + AUTH_SECRET from .env.local so we don't have to retype.
if [[ ! -f .env.local ]]; then
  echo "✗ .env.local not found. Cannot continue."
  exit 1
fi

AUTH_SECRET=$(grep '^AUTH_SECRET=' .env.local | cut -d= -f2-)
GROQ_KEY=$(grep '^GROQ_API_KEY=' .env.local | cut -d= -f2-)

if [[ -z "$AUTH_SECRET" || "$AUTH_SECRET" == "replace_with_64_char_hex_string" ]]; then
  echo "✗ AUTH_SECRET missing in .env.local."
  exit 1
fi

if [[ -z "$GROQ_KEY" || "$GROQ_KEY" == "PASTE_YOUR_GROQ_KEY_HERE" ]]; then
  echo "! GROQ_API_KEY missing — deployment will fall back to chip-only mode."
  GROQ_KEY=""
fi

echo "→ Linking this folder to a Vercel project (first time only)..."
npx vercel link --yes 2>&1 | tail -5

echo
echo "→ Setting environment variables on production..."
printf '%s' "$AUTH_SECRET" | npx vercel env add AUTH_SECRET production --force 2>&1 | tail -3 || true

if [[ -n "$GROQ_KEY" ]]; then
  printf '%s' "$GROQ_KEY" | npx vercel env add GROQ_API_KEY production --force 2>&1 | tail -3 || true
fi

# KV vars — only set if user has already provisioned KV and added them
# locally via `vercel env pull`. Otherwise the app falls back to in-memory.
for VAR in KV_REST_API_URL KV_REST_API_TOKEN; do
  VAL=$(grep "^${VAR}=" .env.local | cut -d= -f2-)
  if [[ -n "$VAL" ]]; then
    printf '%s' "$VAL" | npx vercel env add "$VAR" production --force 2>&1 | tail -3 || true
  fi
done

echo
echo "→ Deploying to production..."
URL=$(npx vercel deploy --prod --yes 2>&1 | tail -1)
echo
echo "✓ Deployed to: $URL"
echo
echo "→ Smoke testing..."
sleep 5
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$URL/login")
echo "  GET $URL/login → HTTP $CODE"
if [[ "$CODE" == "200" ]]; then
  echo "✓ Production deployment looks healthy."
else
  echo "! Unexpected status — check Vercel logs: npx vercel logs $URL"
fi

# Save URL for the next step
echo "$URL" > .deployed-url
echo
echo "Next step: paste $URL into README.md where it says 'add your Vercel URL'."
