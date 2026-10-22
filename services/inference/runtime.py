"""Selected rank-16 artifact validation and real, bounded Hugging Face inference."""

import hashlib
import json
from pathlib import Path
import struct
import time

MODEL = "Qwen/Qwen2.5-0.5B-Instruct"
REVISION = "7ae557604adf67be50417f59c2c2f167def9a775"
ADAPTER_SHA256 = "afff8a917b26c0443053a45b04fff6328cf351e2eb455e3b3195b3af2512c8fc"
TARGETS = {"q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"}


def validate_adapter(folder):
    folder = Path(folder).resolve(strict=True)
    config = json.loads((folder / "adapter_config.json").read_text())
    manifest = json.loads((folder / "training_manifest.json").read_text())
    weights = folder / "adapter_model.safetensors"
    with weights.open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()
    if digest != ADAPTER_SHA256 or manifest.get("adapter_sha256") != digest:
        raise ValueError("Selected adapter weight hash mismatch")
    if (
        config.get("r") != 16
        or config.get("base_model_name_or_path") != MODEL
        or config.get("revision") != REVISION
        or set(config.get("target_modules", [])) != TARGETS
        or config.get("peft_type") != "LORA"
        or config.get("task_type") != "CAUSAL_LM"
    ):
        raise ValueError("Not the selected pinned rank-16 adapter")
    if (
        not manifest.get("completed")
        or manifest.get("train_stats", {}).get("used") != 10026
    ):
        raise ValueError("Selected training manifest is incomplete")
    tokenizer = json.loads((folder / "tokenizer_config.json").read_text())
    if (
        tokenizer.get("tokenizer_class") != "Qwen2Tokenizer"
        or tokenizer.get("eos_token") != "<|im_end|>"
    ):
        raise ValueError("Incompatible tokenizer configuration")
    # Inspect the safetensors header without deserializing arbitrary Python objects.
    with weights.open("rb") as stream:
        length = struct.unpack("<Q", stream.read(8))[0]
        if length > 1024 * 1024:
            raise ValueError("Unbounded safetensors header")
        header = json.loads(stream.read(length))
    tensors = [v for k, v in header.items() if k != "__metadata__"]
    if len(tensors) != 24 * 7 * 2 or any(16 not in t["shape"] for t in tensors):
        raise ValueError("Unexpected LoRA tensor structure")
    return {
        "model_id": MODEL,
        "revision": REVISION,
        "adapter_sha256": digest,
        "rank": 16,
        "tensor_count": len(tensors),
        "training_examples": 10026,
        "tokenizer_source": "pinned base revision; adapter Qwen2Tokenizer config checked",
    }


class Runtime:
    def __init__(self, folder):
        self.identity = validate_adapter(folder)
        from src.inference import HFGenerator

        self.generator = HFGenerator(
            model=MODEL, revision=REVISION, adapter=str(folder)
        )

    def generate(self, request, model):
        from contextlib import nullcontext
        import torch
        from src.inference import SYSTEM, MAX_INPUT_TOKENS

        if model not in {"base", "tuned"}:
            raise ValueError("Unknown model selection")
        start = time.perf_counter()
        g = self.generator
        prompt = g.tokenizer.apply_chat_template(
            [
                {"role": "system", "content": SYSTEM},
                {"role": "user", "content": request},
            ],
            tokenize=False,
            add_generation_prompt=True,
        )
        inputs = g.tokenizer(prompt, return_tensors="pt", add_special_tokens=False).to(
            g.model.device
        )
        if inputs.input_ids.shape[1] > MAX_INPUT_TOKENS:
            raise ValueError("Input exceeds 512 tokens; no truncation performed")
        settings = {"max_new_tokens": 128, "do_sample": False, "max_time": 35.0}
        with (
            torch.inference_mode(),
            g.model.disable_adapter() if model == "base" else nullcontext(),
        ):
            ids = g.model.generate(
                **inputs, **settings, pad_token_id=g.tokenizer.eos_token_id
            )
        output = ids[0, inputs.input_ids.shape[1] :]
        raw = g.tokenizer.decode(output, skip_special_tokens=True).strip()
        complete = bool(len(output) and output[-1].item() == g.tokenizer.eos_token_id)
        return {
            "command": raw,
            "raw_output": raw,
            "model": model,
            "mode": "live",
            "identity": self.identity,
            "settings": settings,
            "elapsed_seconds": time.perf_counter() - start,
            "complete": complete,
            "executed": False,
            "device": str(g.model.device),
            "generated_tokens": len(output),
        }
