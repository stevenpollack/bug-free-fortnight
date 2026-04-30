#!/usr/bin/env sh
# Wait until the integration-test Postgres container is healthy, or time out.
# Usage: ./wait-for-postgres.sh [timeout_seconds]
# Exits 0 when healthy, 1 on timeout.

set -e

TIMEOUT="${1:-60}"
COMPOSE_FILE="$(dirname "$0")/docker-compose.test.yml"
ELAPSED=0

echo "[wait-for-postgres] waiting for postgres to become healthy (timeout ${TIMEOUT}s)..."

while [ "$ELAPSED" -lt "$TIMEOUT" ]; do
  STATUS=$(docker compose -f "$COMPOSE_FILE" ps --format json 2>/dev/null \
    | grep -o '"Health":"[^"]*"' | grep -o '[^"]*$' | head -1)

  if [ "$STATUS" = "healthy" ]; then
    echo "[wait-for-postgres] postgres is healthy after ${ELAPSED}s"
    exit 0
  fi

  sleep 2
  ELAPSED=$((ELAPSED + 2))
done

echo "[wait-for-postgres] timed out after ${TIMEOUT}s -- container status: ${STATUS}" >&2
exit 1
