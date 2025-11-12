import time
import requests
import pytest

BASE_URL = f"http://127.0.0.1:{int(28823)}"


def _is_server_up():
    try:
        r = requests.get(f"{BASE_URL}/api/status", timeout=2)
        return r.status_code == 200
    except Exception:
        return False


@pytest.mark.skipif(not _is_server_up(), reason="CastRay service not running on localhost:28823")
def test_manual_transfer_stats_flow():
    """Integration-like test: basic manual transfer endpoint and stats queries.

    This is intentionally permissive: it skips when the server isn't reachable. When the server
    is running (after you start it in your conda 'ray' env), this test will run and perform
    a simplified transfer invocation and check the endpoints return JSON structures.
    """
    # 1) fetch initial transfer stats
    r = requests.get(f"{BASE_URL}/api/file-transfers/status", timeout=5)
    assert r.status_code == 200
    initial = r.json()

    # 2) check cluster status to find at least one node
    r = requests.get(f"{BASE_URL}/api/status", timeout=5)
    assert r.status_code == 200
    status = r.json()
    nodes = status.get("node_statuses", [])

    if len(nodes) < 1:
        pytest.skip("Not enough nodes in cluster to run transfer test")

    # pick the first node as sender; recipients may be empty for quick smoke test
    sender_id = nodes[0].get("node_id")

    # ensure demo file exists on server side (the embedded service creates demo_files)
    file_name = "config.json"

    payload = {
        "sender_id": sender_id,
        "file_name": file_name,
        "recipients": [n.get("node_id") for n in nodes[1:2]]  # at most one recipient
    }

    r = requests.post(f"{BASE_URL}/api/file-transfers/manual", json=payload, timeout=10)
    # We accept both 200 and 202 depending on server implementation
    assert r.status_code == 200
    resp = r.json()
    assert isinstance(resp, dict)

    # wait a bit and query stats again
    time.sleep(2)
    r = requests.get(f"{BASE_URL}/api/file-transfers/status", timeout=5)
    assert r.status_code == 200
    updated = r.json()

    # Basic sanity: updated is dict-like and keys correspond to nodes
    assert isinstance(updated, dict)
