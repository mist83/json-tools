#!/usr/bin/env bash
#
# Publish JsonUtilities to the Mullmania CodeArtifact NuGet feed.
#
# Runs identically on a local dev machine and inside GitHub Actions.
# The only difference between the two is WHERE the AWS credentials come
# from: locally you have an IAM user (aws configure), in CI the runner
# assumes a role via OIDC before this script runs. Either way, by the
# time this script executes, `aws sts get-caller-identity` must succeed.
#
# Usage:
#   scripts/publish-to-codeartifact.sh                 # uses csproj version
#   DRY_RUN=1 scripts/publish-to-codeartifact.sh       # pack only, no push
#
# Exits non-zero on any failure. Version is taken from the <Version> tag
# in the csproj — bump it there, commit, tag, push.
#
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-west-2}"
DOMAIN="${CODEARTIFACT_DOMAIN:-mullmania}"
DOMAIN_OWNER="${CODEARTIFACT_DOMAIN_OWNER:-166404899495}"
REPO="${CODEARTIFACT_REPO:-nuget}"
PROJECT="${PROJECT:-src/JsonUtilities/JsonUtilities.csproj}"
ARTIFACTS_DIR="${ARTIFACTS_DIR:-artifacts/nuget}"
DRY_RUN="${DRY_RUN:-0}"

# Run from the repo root so relative paths work regardless of where the
# user invoked this from.
cd "$(dirname "$0")/.."

log() { printf '[publish] %s\n' "$*" >&2; }
die() { printf '[publish] ERROR: %s\n' "$*" >&2; exit 1; }

# ---- 1. Sanity checks -------------------------------------------------------

command -v aws     >/dev/null || die "aws CLI not found on PATH"
command -v dotnet  >/dev/null || die ".NET SDK (dotnet) not found on PATH"
[[ -f "$PROJECT" ]]           || die "project not found: $PROJECT"

log "caller:     $(aws sts get-caller-identity --query Arn --output text)"
log "region:     $AWS_REGION"
log "domain:     $DOMAIN (owner $DOMAIN_OWNER)"
log "repository: $REPO"
log "project:    $PROJECT"

# ---- 2. Fetch ephemeral auth + endpoint ------------------------------------

log "fetching auth token (valid ~12h)…"
CODEARTIFACT_AUTH_TOKEN="$(aws codeartifact get-authorization-token \
    --domain "$DOMAIN" --domain-owner "$DOMAIN_OWNER" \
    --region "$AWS_REGION" \
    --query authorizationToken --output text)"

log "fetching repository endpoint…"
ENDPOINT="$(aws codeartifact get-repository-endpoint \
    --domain "$DOMAIN" --domain-owner "$DOMAIN_OWNER" \
    --repository "$REPO" --format nuget \
    --region "$AWS_REGION" \
    --query repositoryEndpoint --output text)"

SOURCE_URL="${ENDPOINT}v3/index.json"
log "source url: $SOURCE_URL"

# ---- 3. Pack ----------------------------------------------------------------

log "cleaning $ARTIFACTS_DIR"
rm -rf "$ARTIFACTS_DIR"
mkdir -p "$ARTIFACTS_DIR"

log "packing $PROJECT (Release)…"
dotnet pack "$PROJECT" \
    --configuration Release \
    --output "$ARTIFACTS_DIR" \
    --nologo \
    --verbosity minimal

shopt -s nullglob
NUPKGS=("$ARTIFACTS_DIR"/*.nupkg)
shopt -u nullglob
[[ ${#NUPKGS[@]} -gt 0 ]] || die "no .nupkg produced by dotnet pack"

log "produced: ${NUPKGS[*]##*/}"

# ---- 4. Push (or stop if DRY_RUN) ------------------------------------------

if [[ "$DRY_RUN" == "1" ]]; then
    log "DRY_RUN=1 — skipping push. artifact(s) left at $ARTIFACTS_DIR/"
    exit 0
fi

for pkg in "${NUPKGS[@]}"; do
    log "pushing $(basename "$pkg")…"
    dotnet nuget push "$pkg" \
        --source "$SOURCE_URL" \
        --api-key "$CODEARTIFACT_AUTH_TOKEN" \
        --skip-duplicate
done

log "done."
log ""
log "consumers install with:"
log "  dotnet nuget add source \"$SOURCE_URL\" \\"
log "    --name mullmania \\"
log "    --username aws \\"
log "    --password \"\$CODEARTIFACT_AUTH_TOKEN\" \\"
log "    --store-password-in-clear-text"
log "  dotnet add package JsonUtilities"
