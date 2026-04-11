#!/usr/bin/env bash
# Canonical deploy runner for sites.
# Instead of each repo keeping its own copy of deploy-site.mjs,
# repos can use this one-liner:
#
#   aws s3 cp s3://mullmania.com-data/_tools/deploy.sh - | bash -s -- apply
#
# Or keep this script locally and run:
#   bash scripts/deploy.sh apply
#
# It downloads the latest deploy-site.mjs from S3 and runs it.
# Requires: node, aws cli (authenticated), site.json or mullmania.site.json in repo root.
# Set DEPLOY_BASE_URL environment variable to target a specific deployment (defaults to mullmania.com).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

TOOLS_BUCKET="mullmania.com-data"
AWS_REGION="${AWS_REGION:-us-west-2}"
SCRIPT_KEY="_tools/deploy-site.mjs"
S3_URI="s3://${TOOLS_BUCKET}/${SCRIPT_KEY}"

TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIR"' EXIT

DEPLOY_SCRIPT="$TEMP_DIR/deploy-site.mjs"
LOCAL_DEPLOY_SCRIPT="$SCRIPT_DIR/deploy-site.mjs"

echo "Fetching canonical deploy script..."
if aws s3 cp "$S3_URI" "$DEPLOY_SCRIPT" --region "$AWS_REGION" >/dev/null 2>&1; then
  :
elif [[ -f "$LOCAL_DEPLOY_SCRIPT" ]]; then
  echo "Falling back to local canonical deploy script..."
  DEPLOY_SCRIPT="$LOCAL_DEPLOY_SCRIPT"
else
  echo "Failed to fetch canonical deploy script and no local fallback exists." >&2
  exit 1
fi

echo "Running deploy..."
node "$DEPLOY_SCRIPT" "$@"
