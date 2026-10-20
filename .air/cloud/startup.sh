#!/usr/bin/env bash
# Air cloud startup for Skill Atlas: a Node (>=24) TypeScript CLI, no server.
# Installs dependencies; on the warmup (snapshot) run, proves the env with CI's checks.
set -euo pipefail

if [ "${AIR_STARTUP_MODE:-}" = warmup ]; then WARMUP=1; else WARMUP=; fi

cd "$(dirname "$0")/../.."

# The CI job's checks: typecheck, tests, and the CLI on the fixture repository.
healthcheck() {
  echo "[startup] healthcheck: typecheck"
  npm run typecheck
  echo "[startup] healthcheck: tests"
  npm test
  echo "[startup] healthcheck: CLI smoke"
  ./skill-atlas help >/dev/null
  ./skill-atlas scan ./fixture
  echo "[startup] healthcheck passed"
}

echo "[startup] node $(node -v), npm $(npm -v)"
major=$(node -p 'process.versions.node.split(".")[0]')
if [ "$major" -lt 24 ]; then
  echo "[startup] ERROR: Node >=24 required (package.json engines), found $(node -v)" >&2
  exit 1
fi

echo "[startup] npm ci"
npm ci --no-audit --no-fund
echo "[startup] dependencies installed"

if [ -n "$WARMUP" ]; then healthcheck; fi
