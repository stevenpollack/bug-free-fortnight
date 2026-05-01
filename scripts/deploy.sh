#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# deploy.sh — pull latest code and rebuild on the remote server.
#
# Required env vars:
#   DEPLOY_HOST  — server hostname or IP (e.g. 192.168.2.150)
#   DEPLOY_USER  — SSH username on the server
#   DEPLOY_PATH  — absolute path to the repo root on the server
#
# Optional env vars:
#   DEPLOY_SSH_KEY — raw private key content (PEM). If omitted, SSH agent /
#                    default key files are used (fine for local use).
# ---------------------------------------------------------------------------

: "${DEPLOY_HOST:?DEPLOY_HOST is required}"
: "${DEPLOY_USER:?DEPLOY_USER is required}"
: "${DEPLOY_PATH:?DEPLOY_PATH is required}"

# ── SSH key setup ────────────────────────────────────────────────────────────
SSH_OPTS="-o StrictHostKeyChecking=no -o BatchMode=yes"

if [[ -n "${DEPLOY_SSH_KEY:-}" ]]; then
  KEY_FILE=$(mktemp)
  chmod 600 "$KEY_FILE"
  printf '%s\n' "$DEPLOY_SSH_KEY" > "$KEY_FILE"
  trap 'rm -f "$KEY_FILE"' EXIT
  SSH_OPTS="$SSH_OPTS -i $KEY_FILE"
fi

# ── Deploy ───────────────────────────────────────────────────────────────────
echo "==> Deploying to ${DEPLOY_USER}@${DEPLOY_HOST}..."
# shellcheck disable=SC2029
ssh $SSH_OPTS "${DEPLOY_USER}@${DEPLOY_HOST}" \
  "set -e
   git -C '${DEPLOY_PATH}' pull origin main
   docker compose --env-file '${DEPLOY_PATH}/.env' -f '${DEPLOY_PATH}/infra/docker/docker-compose.yml' up -d --build --remove-orphans
   docker image prune -f"

echo "==> Deploy complete."
