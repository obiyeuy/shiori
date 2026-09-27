#!/bin/sh
# One project per Docker host. Never delete volumes or unrelated Docker resources.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"
ENV_FILE=${SITE_ENV_FILE:-.local/site.env}
compose() {
  docker compose --project-name personal-site --env-file "$ENV_FILE" -f "$ROOT/compose.yaml" --profile web "$@"
}
case "${1:-status}" in
  status) compose ps ;;
  logs) compose logs --tail 100 web ;;
  deploy)
    previous=$(docker image inspect personal-site:latest --format '{{.Id}}' 2>/dev/null || true)
    compose config --quiet
    compose build web
    compose up -d --remove-orphans --wait --wait-timeout 120
    current=$(docker image inspect personal-site:latest --format '{{.Id}}')
    if [ -n "$previous" ] && [ "$previous" != "$current" ] && docker image inspect "$previous" >/dev/null 2>&1; then
      # No force: Docker protects images still referenced by another container.
      docker image rm "$previous" || printf '%s\n' 'Previous image remains referenced; inspect before removing.' >&2
    fi
    compose ps
    ;;
  *) printf '%s\n' 'Usage: sh ops/site.sh [status|logs|deploy]' >&2; exit 2 ;;
esac
