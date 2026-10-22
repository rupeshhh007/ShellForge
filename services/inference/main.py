"""Run on a separate adequately provisioned machine, never on the 512 MB API."""

import os
import secrets
from threading import BoundedSemaphore
from contextlib import asynccontextmanager
from typing import Literal
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from services.api.guards import RequestGuards


class Request(BaseModel):
    model_config = ConfigDict(extra="forbid")
    request: str = Field(min_length=1, max_length=2000)
    model: Literal["base", "tuned"]


def create_app(runtime=None, token=None):
    token = token or os.environ.get("SHELLFORGE_INFERENCE_TOKEN", "")
    if len(token) < 32:
        raise ValueError(
            "A private inference token of at least 32 characters is required"
        )

    @asynccontextmanager
    async def lifespan(app):
        if app.state.runtime is None:
            from .runtime import Runtime

            app.state.runtime = Runtime(os.environ["SHELLFORGE_INFERENCE_ADAPTER"])
        yield

    app = FastAPI(
        title="ShellForge isolated inference",
        lifespan=lifespan,
        docs_url=None,
        redoc_url=None,
    )
    app.state.runtime = runtime
    app.add_middleware(RequestGuards, per_minute=6, total_per_minute=12)
    slot = BoundedSemaphore(1)

    def authorize(authorization):
        if not secrets.compare_digest(authorization or "", "Bearer " + token):
            raise HTTPException(401, "Inference authentication required")

    @app.get("/status")
    def status(authorization: str | None = Header(default=None)):
        authorize(authorization)
        return {
            "reachable": True,
            "identity": app.state.runtime.identity,
            "execution_enabled": False,
        }

    @app.post("/generate")
    def generate(payload: Request, authorization: str | None = Header(default=None)):
        authorize(authorization)
        if not payload.request.strip():
            raise HTTPException(422, "Empty request")
        if not slot.acquire(blocking=False):
            raise HTTPException(503, "Inference is busy")
        try:
            return app.state.runtime.generate(payload.request, payload.model)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from None
        finally:
            slot.release()

    return app
