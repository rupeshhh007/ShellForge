"""No weights needed: boundary contracts, authentication and non-execution."""

from fastapi.testclient import TestClient
import pytest
from services.api.main import create_app
from services.api.remote_model import RemoteModel
from services.inference.main import create_app as inference_app

TOKEN = "private-test-token-" * 3


class FakeRuntime:
    identity = {"rank": 16, "adapter_sha256": "test-only"}

    def generate(self, request, model):
        return {
            "command": "find ./data -type f",
            "raw_output": "find ./data -type f",
            "model": model,
            "mode": "live",
            "complete": True,
            "executed": False,
            "identity": self.identity,
            "settings": {"max_new_tokens": 128},
            "elapsed_seconds": 0.1,
        }


class Remote:
    def __init__(self, result=None):
        self.result = result

    def call(self, path, payload=None):
        if path == "/status":
            return {"reachable": True, "identity": FakeRuntime.identity}
        return (
            self.result
            if self.result is not None
            else FakeRuntime().generate(payload["request"], payload["model"])
        )


def test_no_provider_honest_and_no_fallback():
    with TestClient(create_app()) as c:
        assert c.get("/api/model/status").json()["reachable"] is False
        assert (
            c.post(
                "/api/model/generate", json={"request": "hello", "model": "tuned"}
            ).status_code
            == 503
        )


def test_remote_result_independently_inspected():
    with TestClient(create_app(remote_provider=Remote())) as c:
        r = c.post("/api/model/generate", json={"request": "files", "model": "tuned"})
        assert r.status_code == 200
        d = r.json()
        assert d["mode"] == "live" and d["executed"] is False
        assert d["safety"]["syntax_valid"] is True and d["tokens"]
        assert d["semantic_correctness"] == "not verified"


@pytest.mark.parametrize(
    "patch",
    [
        {"complete": False},
        {"mode": "saved"},
        {"executed": True},
        {"command": ""},
        {"command": "x" * 4001},
        {"model": "base"},
    ],
)
def test_bad_provider_result_never_masquerades_as_complete(patch):
    result = FakeRuntime().generate("a", "tuned") | patch
    with TestClient(create_app(remote_provider=Remote(result))) as c:
        assert (
            c.post(
                "/api/model/generate", json={"request": "x", "model": "tuned"}
            ).status_code
            == 503
        )


@pytest.mark.parametrize(
    "endpoint",
    [
        "http://example.com",
        "https://user:pass@example.com",
        "https://example.com/path",
        "https://example.com?key=x",
    ],
)
def test_private_connection_configuration_rejected(endpoint):
    with pytest.raises(ValueError):
        RemoteModel(endpoint, TOKEN)


def test_runtime_authentication_strict_inputs_and_nonexecution(tmp_path):
    with TestClient(inference_app(FakeRuntime(), TOKEN)) as c:
        assert c.get("/status").status_code == 401
        assert (
            c.post("/generate", json={"request": "x", "model": "tuned"}).status_code
            == 401
        )
        headers = {"Authorization": "Bearer " + TOKEN}
        assert c.get("/status", headers=headers).json()["execution_enabled"] is False
        marker = tmp_path / "never-created"
        d = c.post(
            "/generate",
            headers=headers,
            json={"request": f"$(touch {marker})", "model": "tuned"},
        ).json()
        assert d["executed"] is False and not marker.exists()
        for data in [
            {"request": "x", "model": "unknown"},
            {"request": "x" * 2001, "model": "base"},
            {"request": "x", "model": "base", "shell": True},
        ]:
            assert c.post("/generate", headers=headers, json=data).status_code == 422


def test_runtime_requires_strong_token():
    with pytest.raises(ValueError):
        inference_app(FakeRuntime(), "weak")


def test_status_checks_are_cached_and_runtime_errors_do_not_poison_generation_slot():
    class CountingRemote(Remote):
        count = 0
        fail = True

        def call(self, path, payload=None):
            if path == "/status":
                self.count += 1
                return {"reachable": True, "identity": FakeRuntime.identity}
            if self.fail:
                raise TimeoutError("private transport detail must not leak")
            return super().call(path, payload)

    remote = CountingRemote()
    with TestClient(create_app(remote_provider=remote)) as c:
        assert c.get("/api/model/status").json()["reachable"] is True
        assert c.get("/api/model/status").json()["reachable"] is True
        assert remote.count == 1
        failed = c.post("/api/model/generate", json={"request": "x", "model": "tuned"})
        assert failed.status_code == 503 and "private transport" not in failed.text
        remote.fail = False
        assert (
            c.post(
                "/api/model/generate", json={"request": "x", "model": "tuned"}
            ).status_code
            == 200
        )


def test_runtime_rate_limit_is_bounded():
    with TestClient(inference_app(FakeRuntime(), TOKEN)) as c:
        headers = {"Authorization": "Bearer " + TOKEN}
        for _ in range(6):
            assert (
                c.post(
                    "/generate", headers=headers, json={"request": "x", "model": "base"}
                ).status_code
                == 200
            )
        assert (
            c.post(
                "/generate", headers=headers, json={"request": "x", "model": "base"}
            ).status_code
            == 429
        )
