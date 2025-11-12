#!/usr/bin/env bash
# Simple helper to run the embedded CastRay service from the workspace root.
# Usage:
#   cd /path/to/workspace
#   ./droneOnCampus/services/castray/run_castray.sh

set -euo pipefail

# Ensure we run from workspace root so module import paths resolve
WORKDIR="$(cd "$(dirname "$0")/.." && pwd)/.."
cd "$WORKDIR"

# Allow overriding host/port via env
: "${CASTRAY_HOST:=0.0.0.0}"
: "${CASTRAY_PORT:=28823}"

echo "Starting CastRay embedded service (module: droneOnCampus.services.castray.main:app)"
echo "HOST=${CASTRAY_HOST} PORT=${CASTRAY_PORT}"

# If uvicorn isn't available in the current environment this will fail; run inside your conda 'ray' env.
python -m uvicorn droneOnCampus.services.castray.main:app --host ${CASTRAY_HOST} --port ${CASTRAY_PORT} --loop asyncio --log-level info
