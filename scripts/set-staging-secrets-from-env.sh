#!/usr/bin/env bash
# Push staging secrets from .env to Cloudflare Worker (non-interactive).
# Usage: npm run set-secrets:stg   or   ./scripts/set-staging-secrets-from-env.sh

set -e

ENV_FILE="${ENV_FILE:-.env}"
ENV="staging"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ $ENV_FILE not found"
  exit 1
fi

secrets=(
  SUPABASE_URL
  SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  REPLICATE_API_TOKEN
  OPENAI_API_KEY
  ELEVENLABS_API_KEY
  ELEVENLABS_DEFAULT_VOICE_ID
  ELEVENLABS_MODEL_ID
)

echo "🔐 Pushing secrets from $ENV_FILE to staging"
echo "=============================================="

for name in "${secrets[@]}"; do
  line=$(grep -E "^${name}=" "$ENV_FILE" 2>/dev/null || true)
  if [ -z "$line" ]; then
    echo "⚠️  Skipping $name (not in $ENV_FILE)"
    continue
  fi
  value="${line#*=}"
  if [ -z "$value" ]; then
    echo "⚠️  Skipping $name (empty value)"
    continue
  fi
  echo "📝 Setting $name..."
  echo "$value" | npx wrangler secret put "$name" --env "$ENV"
  echo "✅ $name"
done

echo "=============================================="
echo "✨ Done. Staging secrets synced from $ENV_FILE"
