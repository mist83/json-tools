#!/usr/bin/env bash
#
# Publish JsonUtilities to the Mullmania private NuGet feed (sleet static feed
# at https://nuget.mullmania.com/nuget/index.json).
#
# Runs identically on a local dev machine and inside GitHub Actions. Same code
# path: pack → sleet push → refresh packages.mullmania.com. AWS credentials
# come from the usual sources (local profile or CI OIDC role).
#
# Usage:
#   scripts/publish-to-codeartifact.sh                 # uses csproj version
#   DRY_RUN=1 scripts/publish-to-codeartifact.sh       # pack only, no push
#
# Kept the old filename for backwards compatibility; contents are now sleet-based.
#
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-west-2}"
PROJECT="${PROJECT:-src/JsonUtilities/JsonUtilities.csproj}"
ARTIFACTS_DIR="${ARTIFACTS_DIR:-artifacts/nuget}"
DRY_RUN="${DRY_RUN:-0}"
FEED_URL="https://nuget.mullmania.com/nuget/index.json"

cd "$(dirname "$0")/.."

log() { printf '[publish] %s\n' "$*" >&2; }
die() { printf '[publish] ERROR: %s\n' "$*" >&2; exit 1; }

# ---- 1. Sanity checks -------------------------------------------------------

command -v aws    >/dev/null || die "aws CLI not found on PATH"
command -v dotnet >/dev/null || die ".NET SDK not found on PATH"
command -v git    >/dev/null || die "git not found on PATH"
[[ -f "$PROJECT" ]]          || die "project not found: $PROJECT"

log "caller:     $(aws sts get-caller-identity --query Arn --output text)"
log "region:     $AWS_REGION"
log "project:    $PROJECT"
log "feed:       $FEED_URL"

# ---- 2. Ensure sleet is installed ------------------------------------------

SLEET="$HOME/.dotnet/tools/sleet"
if [[ ! -x "$SLEET" ]]; then
    log "installing sleet (global dotnet tool)…"
    dotnet tool install -g Sleet --add-source https://api.nuget.org/v3/index.json >/dev/null
fi

# ---- 3. Pack ---------------------------------------------------------------

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

if [[ "$DRY_RUN" == "1" ]]; then
    log "DRY_RUN=1 — skipping push. artifact(s) left at $ARTIFACTS_DIR/"
    exit 0
fi

# ---- 4. Fetch the shared sleet config from package-garden ------------------
#
# sleet.json is the canonical feed config (bucket name, region, baseURI).
# It lives in mist83/package-garden so every library uses the exact same
# feed settings without copying config around.

PG_DIR="$(mktemp -d)"
trap 'rm -rf "$PG_DIR"' EXIT

log "fetching sleet.json from mist83/package-garden…"
if ! (gh repo clone mist83/package-garden "$PG_DIR" -- --depth 1 --quiet 2>/dev/null \
    || git clone --depth 1 --quiet git@github.com:mist83/package-garden.git "$PG_DIR" 2>/dev/null); then
    die "could not clone mist83/package-garden. Cross-repo auth may be needed in CI."
fi
[[ -f "$PG_DIR/sleet.json" ]] || die "$PG_DIR/sleet.json missing"

# ---- 5. Push via sleet -----------------------------------------------------

for pkg in "${NUPKGS[@]}"; do
    log "pushing $(basename "$pkg") → sleet feed…"
    "$SLEET" push "$pkg" \
        --config "$PG_DIR/sleet.json" \
        --source mullmania \
        --force
done

# ---- 6. Register + refresh packages.mullmania.com --------------------------

log "registering package metadata…"
(cd "$PG_DIR" && PKG_NAME="JsonUtilities" \
    PKG_SOURCE_REPO="mist83/json-tools" \
    PKG_SOURCE_SITE="https://json-tools.mullmania.com/" \
    PKG_DESCRIPTION="High-performance C# library for scanning large JSON files with byte-position tracking, path extraction, trie indexing, and semantic search — without full deserialization." \
    ./scripts/register-package.sh) || log "WARN: register-package failed (non-fatal)"

log "refreshing packages.mullmania.com…"
"$PG_DIR/scripts/update-index.sh" || log "WARN: update-index.sh failed (non-fatal)"

log ""
log "done. install from any dotnet project with:"
log "  dotnet nuget add source $FEED_URL --name mullmania"
log "  dotnet add package JsonUtilities"
log ""
log "browse all packages:"
log "  https://packages.mullmania.com/"
