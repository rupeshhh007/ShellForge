"""Run from repository root: uvicorn services.api.main:app --port 8010."""

import os
from contextlib import asynccontextmanager
from threading import BoundedSemaphore

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.safety_validator import check_command

from .anatomy import explain_tokens
from .guards import RequestGuards
from .providers import ModelProvider, QwenAdapterProvider
from .schemas import AnalysisRequest, ProposalRequest, Receipt, Recipe, Safety
from .templates import RECIPES, from_language, render


def inspect(command):
    try:
        safety = Safety(**check_command(command))
        tokens = explain_tokens(command) if safety.syntax_valid else []
    except (RecursionError, MemoryError):
        safety = Safety(
            risk="DANGEROUS",
            syntax_valid=False,
            reasons=["Analysis exceeded parser complexity limits"],
            policy="static-v2",
        )
        tokens = []
    return safety, tokens


def create_app(provider: ModelProvider | None = None, per_minute=30) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app):
        adapter = os.getenv("SHELLFORGE_MODEL_ADAPTER")
        if provider is None and adapter:
            app.state.provider = QwenAdapterProvider(adapter)
        yield

    api = FastAPI(
        title="ShellForge — Command Workshop", version="2.0.0", lifespan=lifespan
    )
    api.state.provider = provider
    slots = BoundedSemaphore(4)
    model_slot = BoundedSemaphore(1)
    origins = [
        s.strip()
        for s in os.getenv("SHELLFORGE_CORS_ORIGINS", "http://localhost:3000").split(
            ","
        )
        if s.strip()
    ]
    if "*" in origins:
        raise ValueError("Explicit CORS origins required")
    api.add_middleware(RequestGuards, per_minute=per_minute)
    api.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
        expose_headers=["Retry-After"],
    )

    @api.exception_handler(RequestValidationError)
    async def validation_error(request, exc):
        return JSONResponse(
            status_code=422,
            content={
                "detail": "Invalid request payload. Check input length, profile and parameter types."
            },
        )

    @api.middleware("http")
    async def headers(request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Cache-Control"] = "no-store"
        return response

    @api.get("/api/health")
    def health():
        return {
            "status": "ok",
            "version": "2.0.0",
            "model_configured": api.state.provider is not None,
            "generation": "deterministic-templates",
            "execution_enabled": False,
        }

    @api.get("/api/recipes", response_model=list[Recipe])
    def recipes():
        return RECIPES

    @api.post("/api/commands/analyze", response_model=Receipt)
    def analyze(payload: AnalysisRequest):
        if not slots.acquire(blocking=False):
            raise HTTPException(503, "Analysis is busy. Please retry shortly.")
        try:
            safety, tokens = inspect(payload.command)
        finally:
            slots.release()
        return Receipt(
            status="analyzed",
            request=payload.command,
            profile=payload.profile,
            command=payload.command,
            backend="static-v2",
            safety=safety,
            tokens=tokens,
            message="Syntax and static policy checked; intent correctness is not established.",
            assumptions=[
                "Bash syntax is checked on the server; utility availability and behavior on your platform are not tested."
            ],
        )

    @api.post("/api/commands/propose", response_model=Receipt)
    def propose(payload: ProposalRequest):
        if not slots.acquire(blocking=False):
            raise HTTPException(503, "The workshop is busy. Please retry shortly.")
        try:
            return make_proposal(payload)
        finally:
            slots.release()

    def make_proposal(payload):
        try:
            template = (
                render(payload.recipe_id, payload.parameters, payload.profile)
                if payload.recipe_id
                else from_language(payload.request, payload.profile)
            )
        except ValueError as exc:
            return Receipt(
                status="needs_clarification",
                request=payload.request,
                profile=payload.profile,
                backend="deterministic-templates",
                message="A constraint needs your attention.",
                clarification=str(exc),
            )
        if template:
            safety, tokens = inspect(template.command)
            return Receipt(
                status="proposed",
                request=payload.request,
                profile=payload.profile,
                command=template.command,
                backend="deterministic-templates",
                intent=template.intent,
                safety=safety,
                tokens=tokens,
                assumptions=template.assumptions,
                message="Rendered from validated template parameters. Confirm these constraints match your intent.",
            )
        if api.state.provider is None:
            return Receipt(
                status="unsupported",
                request=payload.request,
                profile=payload.profile,
                backend="deterministic-templates",
                message="This request is outside the supported grammar. No model provider is configured.",
                clarification="Try a Field Manual recipe, or use an example exactly and edit its quoted path or numeric threshold. Extra constraints require review; they will not be dropped.",
            )
        if not model_slot.acquire(blocking=False):
            raise HTTPException(503, "The model is busy. Please retry shortly.")
        try:
            generated = api.state.provider.generate(payload.request)
        except Exception:
            raise HTTPException(
                503, "The configured model could not produce a complete proposal."
            ) from None
        finally:
            model_slot.release()
        if (
            not isinstance(generated.command, str)
            or not 0 < len(generated.command) <= 4000
            or "\x00" in generated.command
        ):
            raise HTTPException(502, "The model returned an invalid command payload.")
        safety, tokens = inspect(generated.command)
        return Receipt(
            status="proposed",
            request=payload.request,
            profile=payload.profile,
            command=generated.command,
            backend=generated.backend,
            safety=safety,
            tokens=tokens,
            message="Experimental model proposal. Semantic intent has not been verified.",
            assumptions=[
                "Model output may be incorrect. No structured intent verification is available for this proposal."
            ],
        )

    return api


app = create_app()
