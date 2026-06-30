#!/usr/bin/env bash
# Guild Live — one-shot deploy of backend (Functions) + frontend (SWA).
# Reads connection details from Terraform outputs (infra/), then publishes the
# Functions app and builds+deploys the frontend to Static Web Apps.
#
# Prereqs: terraform, az (logged in), node/npm,
#          azure-functions-core-tools@4 (func), @azure/static-web-apps-cli (swa)
#
# Usage: ./scripts/deploy.sh [--skip-backend] [--skip-frontend]
set -euo pipefail

SKIP_BACKEND=false
SKIP_FRONTEND=false
for arg in "$@"; do
  case "$arg" in
    --skip-backend) SKIP_BACKEND=true ;;
    --skip-frontend) SKIP_FRONTEND=true ;;
    *) echo "Unknown arg: $arg" >&2; exit 1 ;;
  esac
done

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INFRA_DIR="$REPO_ROOT/infra"
API_DIR="$REPO_ROOT/api"
WEB_DIR="$REPO_ROOT/web"

tf_output() {
  local name="$1"
  local val
  val="$(cd "$INFRA_DIR" && terraform output -raw "$name" 2>/dev/null || true)"
  if [[ -z "$val" ]]; then
    echo "ERROR: terraform output '$name' is empty. Did 'terraform apply' run?" >&2
    exit 1
  fi
  printf '%s' "$val"
}

echo "==> Reading Terraform outputs from $INFRA_DIR"
FUNC_APP_NAME="$(tf_output function_app_name)"
API_BASE_URL="$(tf_output function_app_base_url)"
SWA_TOKEN="$(tf_output static_web_app_api_key)"
SWA_URL="$(tf_output static_web_app_default_hostname)"

echo "    Function App : $FUNC_APP_NAME"
echo "    API base URL : $API_BASE_URL"
echo "    SWA URL      : $SWA_URL"

# ---- Backend ----------------------------------------------------------------
if [[ "$SKIP_BACKEND" == false ]]; then
  echo ""
  echo "==> Building + publishing Functions"
  ( cd "$API_DIR" && npm install && npm run build && func azure functionapp publish "$FUNC_APP_NAME" )
else
  echo "==> Skipping backend"
fi

# ---- Frontend ---------------------------------------------------------------
if [[ "$SKIP_FRONTEND" == false ]]; then
  echo ""
  echo "==> Building frontend with VITE_API_BASE_URL=$API_BASE_URL"
  ( cd "$WEB_DIR" && npm install && VITE_API_BASE_URL="$API_BASE_URL" npm run build \
      && echo "==> Deploying frontend to Static Web Apps" \
      && swa deploy ./dist --deployment-token "$SWA_TOKEN" --env production )
else
  echo "==> Skipping frontend"
fi

echo ""
echo "==> Done."
echo "    App:  $SWA_URL"
echo "    Host: $SWA_URL/host"
echo "    Join: $SWA_URL/join"
echo ""
echo "    REMEMBER: run 'terraform destroy' in infra/ after the event!"
