"""Optional generator boundary. Nothing downloads or loads unless configured."""

from dataclasses import dataclass
from pathlib import Path
from typing import Protocol


@dataclass(frozen=True)
class GeneratedCommand:
    command: str
    backend: str


class ModelProvider(Protocol):
    def generate(self, request: str) -> GeneratedCommand: ...


class QwenAdapterProvider:
    """Explicit opt-in to the existing research implementation and its dependencies.

    Operators must install requirements-model.txt and provision serving resources.
    Adapter artifacts are not downloaded automatically from Drive.
    """

    def __init__(self, adapter: str):
        folder = Path(adapter).resolve(strict=True)
        for name in ("adapter_config.json", "adapter_model.safetensors"):
            if not (folder / name).is_file():
                raise ValueError(f"Adapter is missing {name}")
        from src.inference import HFGenerator

        self.generator = HFGenerator(
            adapter=str(folder), revision="7ae557604adf67be50417f59c2c2f167def9a775"
        )

    def generate(self, request: str) -> GeneratedCommand:
        result = self.generator.generate(request)
        if result.get("generation_truncated") or not result["command"].strip():
            raise ValueError("Model abstained or reached its output budget")
        return GeneratedCommand(command=result["command"], backend=result["backend"])
