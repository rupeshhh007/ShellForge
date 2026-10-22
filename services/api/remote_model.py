"""Server-only authenticated connection to the isolated model runtime."""

import json
import os
import time
import urllib.request
from urllib.parse import urlsplit
from typing import Literal
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field


class ModelRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    request: str = Field(min_length=1, max_length=2000)
    model: Literal["base", "tuned"]


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class RemoteModel:
    def __init__(self, endpoint, token):
        parsed = urlsplit(endpoint)
        if (
            (
                parsed.scheme != "https"
                and not (
                    parsed.scheme == "http" and parsed.hostname in {"127.0.0.1", "::1"}
                )
            )
            or not parsed.netloc
            or parsed.username
            or parsed.query
            or parsed.fragment
            or parsed.path not in ("", "/")
        ):
            raise ValueError(
                "Inference endpoint must be an HTTPS origin (HTTP allowed only for literal loopback)"
            )
        if len(token) < 32:
            raise ValueError("Inference token must contain at least 32 characters")
        self.endpoint, self.token = endpoint.rstrip("/"), token

    def call(self, path, payload=None):
        request = urllib.request.Request(
            self.endpoint + path,
            data=json.dumps(payload).encode() if payload is not None else None,
            headers={
                "Authorization": "Bearer " + self.token,
                "Content-Type": "application/json",
            },
        )
        with urllib.request.build_opener(NoRedirect).open(
            request, timeout=45 if payload else 5
        ) as response:
            data = response.read(65537)
        if len(data) > 65536:
            raise ValueError("Inference response limit exceeded")
        return json.loads(data)


def router(inspect, provider=None):
    routes = APIRouter()
    endpoint = os.getenv("SHELLFORGE_INFERENCE_ORIGIN")
    remote = provider or (
        RemoteModel(endpoint, os.getenv("SHELLFORGE_INFERENCE_TOKEN", ""))
        if endpoint
        else None
    )
    from threading import BoundedSemaphore

    slot = BoundedSemaphore(1)
    status_slot = BoundedSemaphore(1)
    status_cache = {
        "until": 0.0,
        "value": {
            "configured": remote is not None,
            "reachable": False,
            "mode": "saved-evaluation",
            "reason": "Checking runtime availability.",
        },
    }

    @routes.get("/api/model/status")
    def status():
        if remote is None:
            return {
                "configured": False,
                "reachable": False,
                "mode": "saved-evaluation",
                "reason": "No always-on model runtime is configured. Saved predictions remain available.",
            }
        if time.monotonic() < status_cache["until"] or not status_slot.acquire(
            blocking=False
        ):
            return status_cache["value"]
        try:
            result = remote.call("/status")
            reachable = result.get("reachable") is True
            value = {
                "configured": True,
                "reachable": reachable,
                "mode": "live" if reachable else "saved-evaluation",
                "identity": result.get("identity"),
            }
        except Exception:
            value = {
                "configured": True,
                "reachable": False,
                "mode": "saved-evaluation",
                "reason": "Configured experimental runtime is unreachable or authentication failed.",
            }
        finally:
            status_slot.release()
        status_cache.update(until=time.monotonic() + 15, value=value)
        return value

    @routes.post("/api/model/generate")
    def generate(payload: ModelRequest):
        if remote is None:
            raise HTTPException(
                503,
                "No live inference runtime configured; choose Saved Evaluation or Template.",
            )
        if not payload.request.strip():
            raise HTTPException(422, "Empty request")
        if not slot.acquire(blocking=False):
            raise HTTPException(503, "Model request already in progress")
        try:
            result = remote.call("/generate", payload.model_dump())
            command = result.get("command")
            if (
                not isinstance(command, str)
                or not 0 < len(command) <= 4000
                or "\x00" in command
                or result.get("mode") != "live"
                or result.get("complete") is not True
                or result.get("executed") is not False
                or result.get("model") != payload.model
            ):
                raise ValueError("Incomplete or invalid model result")
            safety, tokens = inspect(command)
            return {
                **result,
                "safety": safety.model_dump(),
                "tokens": [t.model_dump() for t in tokens],
                "semantic_correctness": "not verified",
            }
        except Exception:
            raise HTTPException(
                503,
                "Live inference failed, timed out, or returned an incomplete result. No saved output was substituted.",
            ) from None
        finally:
            slot.release()

    return routes
