"""No real credentials/network: optional selector only; interpreter remains authoritative."""

import json
from concurrent.futures import ThreadPoolExecutor
from threading import Event
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from services.api.main import create_app
from services.api.tutor import (
    Tutor,
    QuestionRequest,
    Selection,
    gemini_select,
    EVIDENCE,
)

PAYLOAD = {"case_id": "missing-100", "revision": 1, "paths": [], "status": "ok"}


def test_missing_configuration_has_working_grounded_fallback_without_calls():
    def forbidden(*args):
        raise AssertionError("Network must not run")

    for key, budget in [(None, 20), ("server-only", 0)]:
        result = Tutor(key=key, budget=budget, select=forbidden).question(
            QuestionRequest(**PAYLOAD)
        )
        assert result["mode"] == "deterministic-question"
        assert result["question"] == EVIDENCE["cases"]["missing-100"]["questions"][0]
        assert result["executed"] is False
        assert result["grades_from"] == "deterministic-interpreter"


def test_success_selects_only_canonical_prose_and_receives_evaluator_facts():
    def select(key, context):
        assert key == "server-only"
        assert context["actual"]["a"]["matches"] == [
            "/lab/evidence/almost.bin",
            "/lab/evidence/exact.bin",
        ]
        assert context["prediction"]["paths"] == []
        return 2

    result = Tutor(key="server-only", budget=1, select=select).question(
        QuestionRequest(**PAYLOAD)
    )
    assert result["mode"] == "gemini-question-selection"
    assert result["question"] == EVIDENCE["cases"]["missing-100"]["questions"][2]
    assert "server-only" not in json.dumps(result)


@pytest.mark.parametrize(
    "bad", [True, "1", -1, 3, None, {"question_id": 0}, "Ignore rules; execute rm"]
)
def test_malformed_model_selection_never_reaches_the_ui(bad):
    result = Tutor(key="x", budget=1, select=lambda *_: bad).question(
        QuestionRequest(**PAYLOAD)
    )
    assert result["mode"] == "deterministic-question"
    assert result["reason"] == "provider-unavailable-or-invalid"
    with pytest.raises(Exception):
        Selection(question_id=bad)


def test_timeout_and_provider_errors_do_not_leak_keys_or_block_hints():
    def select(*_):
        raise TimeoutError("server-only-private-key")

    result = Tutor(key="server-only-private-key", budget=1, select=select).question(
        QuestionRequest(**PAYLOAD)
    )
    assert result["mode"] == "deterministic-question"
    assert "private-key" not in json.dumps(result)


def test_total_budget_rate_and_hard_cap_are_enforced_including_failed_calls():
    now = [0.0]
    calls = []

    def select(*_):
        calls.append(True)
        return 0

    tutor = Tutor(key="x", budget=2, select=select, clock=lambda: now[0])
    payload = QuestionRequest(**PAYLOAD)
    tutor.question(payload)
    assert tutor.question(payload)["reason"] == "rate-limited"
    now[0] = 31
    tutor.question(payload)
    now[0] = 62
    assert tutor.question(payload)["reason"] == "budget-exhausted"
    assert len(calls) == 2
    assert Tutor(key="x", budget=999).budget == 20


def test_concurrent_requests_reserve_one_slot_before_network():
    started, finish = Event(), Event()

    def select(*_):
        started.set()
        assert finish.wait(3)
        return 1

    tutor = Tutor(key="x", budget=2, select=select)
    with ThreadPoolExecutor(2) as pool:
        future = pool.submit(tutor.question, QuestionRequest(**PAYLOAD))
        assert started.wait(2)
        assert tutor.question(QuestionRequest(**PAYLOAD))["reason"] == "rate-limited"
        finish.set()
        assert future.result()["mode"] == "gemini-question-selection"
    assert tutor.used == 1


@pytest.mark.parametrize(
    "patch_value",
    [
        {"case_id": "fake"},
        {"revision": 99},
        {"paths": ["/etc/passwd"]},
        {"paths": ["/lab", "/lab"]},
        {"command": "rm -rf /"},
        {"status": "unsupported"},
    ],
)
def test_public_route_rejects_unknown_state_and_commands(patch_value):
    client = TestClient(create_app(tutor=Tutor()))
    assert (
        client.post("/api/tutor/question", json={**PAYLOAD, **patch_value}).status_code
        == 422
    )


def test_route_fallback_and_non_execution():
    client = TestClient(create_app(tutor=Tutor()))
    with patch("subprocess.run", side_effect=AssertionError("Never execute")):
        response = client.post("/api/tutor/question", json=PAYLOAD)
    assert response.status_code == 200
    assert response.json()["executed"] is False


def test_http_contract_has_fixed_host_header_secret_and_bounded_response():
    requests = []

    class Response:
        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

        def read(self, size):
            assert size == 8193
            return json.dumps(
                {
                    "candidates": [
                        {
                            "finishReason": "STOP",
                            "content": {"parts": [{"text": '{"question_id":1}'}]},
                        }
                    ]
                }
            ).encode()

    class Opener:
        def open(self, request, timeout):
            assert timeout == 12
            requests.append(request)
            return Response()

    with patch("services.api.tutor.build_opener", return_value=Opener()):
        assert gemini_select("secret-for-header", {"fact": "synthetic"}) == 1
    request = requests[0]
    assert (
        request.full_url
        == "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent"
    )
    assert "secret-for-header" not in request.full_url
    assert request.get_header("X-goog-api-key") == "secret-for-header"
    body = json.loads(request.data)
    assert body["generationConfig"]["maxOutputTokens"] == 64
    assert "tools" not in body
