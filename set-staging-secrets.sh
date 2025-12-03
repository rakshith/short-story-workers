#!/bin/bash

# Script to set all required secrets for staging environment
# Usage: ./set-staging-secrets.sh

set -e

ENV="staging"
WORKER_NAME="create-story-worker-staging"

echo "🔐 Setting secrets for $WORKER_NAME"
echo "======================================"
echo ""

# Array of secrets to set
secrets=(
  "SUPABASE_URL"
  "SUPABASE_ANON_KEY"
  "SUPABASE_SERVICE_ROLE_KEY"
  "REPLICATE_API_TOKEN"
  "OPENAI_API_KEY"
  "ELEVENLABS_API_KEY"
  "ELEVENLABS_DEFAULT_VOICE_ID"
  "ELEVENLABS_MODEL_ID"
)

# Function to set a secret
set_secret() {
  local secret_name=$1
  local secret_value=$2
  
  if [ -z "$secret_value" ]; then
    echo "⚠️  Skipping $secret_name (empty value)"
    return
  fi
  
  echo "📝 Setting $secret_name..."
  echo "$secret_value" | npx wrangler secret put "$secret_name" --env "$ENV"
  
  if [ $? -eq 0 ]; then
    echo "✅ Successfully set $secret_name"
  else
    echo "❌ Failed to set $secret_name"
    return 1
  fi
  echo ""
}

# Prompt for each secret
for secret in "${secrets[@]}"; do
  echo "Enter value for $secret (press Enter to skip):"
  read -s secret_value
  echo ""
  
  set_secret "$secret" "$secret_value"
done

echo "======================================"
echo "✨ Done! All secrets have been set for staging environment."
echo ""
echo "Note: If you skipped any secrets, you can set them individually with:"
echo "  npx wrangler secret put SECRET_NAME --env staging"

