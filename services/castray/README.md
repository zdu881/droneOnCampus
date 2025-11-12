# CastRay (embedded) — droneOnCampus/services/castray

This folder contains a migrated copy of the CastRay backend packaged as
`droneOnCampus.services.castray` so it can be started from the workspace and
used by the droneOnCampus frontend or integration tests.

Quick notes:

- To start the service (recommended inside your conda env named `ray`):

  cd /path/to/workspace
  ./droneOnCampus/services/castray/run_castray.sh

- The run script uses uvicorn and expects to import `droneOnCampus.services.castray.main:app`.
- Default port is 28823 (to match existing test scripts). Override with environment
  variables CASTRAY_HOST/Castray_PORT if needed.

- Minimal pytest integration test is in `tests/test_transfer_stats.py`. It will skip if
  the service isn't reachable on localhost:28823.

Dependencies (install into your `ray` env):

- fastapi
- uvicorn
- ray (if you want to run the Ray actors)
- requests (for the integration tests)

Example (on Linux with conda):

    conda activate ray
    pip install -r requirements.txt  # optional
    ./droneOnCampus/services/castray/run_castray.sh

Then in another shell:

    conda activate ray
    pytest droneOnCampus/services/castray/tests/test_transfer_stats.py -q
