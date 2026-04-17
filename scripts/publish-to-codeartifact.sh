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

# ---- 2. Wire dotnet → CodeArtifact -----------------------------------------
#
# `aws codeartifact login --tool dotnet` writes a NuGet source with HTTP
# Basic auth (user "aws", password = short-lived token) into the local
# user's NuGet.Config. This is the AWS-recommended path and it's what
# both local invocations and CI runners use — the runner's config is
# ephemeral so nothing leaks.
#
# We also capture the endpoint separately so we can report the exact
# source URL in the done-message.

log "wiring dotnet → CodeArtifact (this writes a source into NuGet.Config)…"
aws codeartifact login --tool dotnet \
    --domain "$DOMAIN" --domain-owner "$DOMAIN_OWNER" \
    --repository "$REPO" --region "$AWS_REGION" \
    --duration-seconds 3600 >/dev/null

ENDPOINT="$(aws codeartifact get-repository-endpoint \
    --domain "$DOMAIN" --domain-owner "$DOMAIN_OWNER" \
    --repository "$REPO" --format nuget \
    --region "$AWS_REGION" \
    --query repositoryEndpoint --output text)"

SOURCE_URL="${ENDPOINT}v3/index.json"
SOURCE_NAME="${DOMAIN}/${REPO}"
log "source name: $SOURCE_NAME"
log "source url:  $SOURCE_URL"

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
    log "pushing $(basename "$pkg") → $SOURCE_NAME…"
    dotnet nuget push "$pkg" \
        --source "$SOURCE_NAME" \
        --skip-duplicate
done

# ---- 5. Refresh packages.mullmania.com -------------------------------------
#
# After a successful push, regenerate the package-garden site so the new
# version shows up on packages.mullmania.com. Clones the package-garden
# repo to a temp dir and runs its update-index.sh. Non-fatal: if the
# clone or refresh fails (e.g. in CI without cross-repo auth), the
# publish itself still counts — the site just gets refreshed on the
# next local run.
#
# Set UPDATE_INDEX=0 to skip this step entirely.
UPDATE_INDEX="${UPDATE_INDEX:-1}"

if [[ "$UPDATE_INDEX" == "1" ]]; then
    PG_DIR="$(mktemp -d)"
    trap 'rm -rf "$PG_DIR"' EXIT

    log "refreshing packages.mullmania.com (cloning package-garden)…"
    if gh repo clone mist83/package-garden "$PG_DIR" -- --depth 1 --quiet 2>/dev/null \
        || git clone --depth 1 --quiet git@github.com:mist83/package-garden.git "$PG_DIR" 2>/dev/null; then
        if "$PG_DIR/scripts/update-index.sh"; then
            log "packages.mullmania.com refreshed."
        else
            log "WARN: update-index.sh failed — site may be stale. Package push itself succeeded."
        fi
    else
        log "WARN: could not clone mist83/package-garden (cross-repo auth needed in CI)."
        log "      Package push itself succeeded; run the refresh locally to update the site."
    fi
fi

log ""
log "consumers (same machine, same user) install with:"
log "  aws codeartifact login --tool dotnet --domain $DOMAIN --repository $REPO --region $AWS_REGION"
log "  dotnet add package JsonUtilities"
log ""
log "browse all packages at:"
log "  https://packages.mullmania.com/"
