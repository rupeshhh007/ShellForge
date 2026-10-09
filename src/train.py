"""Reproducible LoRA training with validation-selected checkpoints; no test access."""
import argparse
from pathlib import Path
import random
import dataclasses
import json
import importlib.metadata

from .run_state import atomic_json, frozen_json, digest, mark_checkpoint, latest_checkpoint, checkpoint_valid

from .experiment_data import sha256
from .inference import MODEL_ID, SYSTEM
from .preprocess_dataset import read_jsonl, write_json

REVISION = '7ae557604adf67be50417f59c2c2f167def9a775'
TARGET_MODULES = ['q_proj', 'k_proj', 'v_proj', 'o_proj', 'gate_proj', 'up_proj', 'down_proj']


def encode_example(tokenizer, row, max_length):
    prompt = tokenizer.apply_chat_template(
        [{'role': 'system', 'content': SYSTEM}, {'role': 'user', 'content': row['instruction']}],
        tokenize=False, add_generation_prompt=True)
    prompt_ids = tokenizer(prompt, add_special_tokens=False)['input_ids']
    answer_ids = tokenizer(row['command'] + tokenizer.eos_token, add_special_tokens=False)['input_ids']
    ids = prompt_ids + answer_ids
    if len(ids) > max_length or not answer_ids:
        return None
    return {'input_ids': ids, 'attention_mask': [1] * len(ids),
            'labels': [-100] * len(prompt_ids) + answer_ids}


def load_encoded(tokenizer, path, max_length, limit=None, seed=42):
    discards = []
    rows = [r for r, _ in read_jsonl(path, discards)]
    if discards:
        raise ValueError(f'Malformed supervised records in {path}: {len(discards)}')
    random.Random(seed).shuffle(rows)
    if limit is not None:
        rows = rows[:limit]
    encoded, omitted, lengths = [], [], []
    for row in rows:
        item = encode_example(tokenizer, row, max_length)
        if item is None:
            omitted.append(row.get('id'))
        else:
            lengths.append(len(item['input_ids']))
            encoded.append(item)
    if not encoded:
        raise ValueError('No supervised examples fit max length')
    return encoded, {'selected': len(rows), 'used': len(encoded), 'too_long': len(omitted),
                     'too_long_ids': omitted, 'max_encoded_length': max(lengths),
                     'mean_encoded_length': sum(lengths) / len(lengths)}


def collate_examples(batch, pad_token_id):
    import torch
    width = max(len(r['input_ids']) for r in batch)
    padding = {'labels': -100, 'input_ids': pad_token_id, 'attention_mask': 0}
    return {key: torch.tensor([r[key] + [pad] * (width - len(r[key])) for r in batch])
            for key, pad in padding.items()}


def train_run(a):
    import torch
    from transformers import (AutoTokenizer, AutoModelForCausalLM, Trainer,
                              TrainingArguments, EarlyStoppingCallback, TrainerCallback, TrainerState, set_seed)
    from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
    if a.require_cuda and not torch.cuda.is_available():
        raise RuntimeError('Cloud CUDA GPU required. Select a Colab GPU runtime; no CPU fallback.')
    if a.qlora and not torch.cuda.is_available():
        raise RuntimeError('QLoRA requires CUDA and bitsandbytes')
    output = Path(a.output)
    resume = getattr(a, 'resume', False)
    if output.exists() and any(output.iterdir()) and not resume:
        raise ValueError('Output is not empty; use a new run directory to preserve evidence')
    if a.limit is not None and a.limit <= 0:
        raise ValueError('limit must be positive')
    if min(a.epochs, a.learning_rate, a.batch_size, a.accumulation, a.eval_steps, a.rank) <= 0:
        raise ValueError('Training settings must be positive')
    cuda = torch.cuda.is_available()
    bf16 = cuda and torch.cuda.is_bf16_supported()
    dtype = torch.bfloat16 if bf16 else torch.float16 if cuda else torch.float32
    settings = {k: v for k, v in vars(a).items() if k not in {'output', 'train', 'validation', 'require_cuda', 'resume'}}
    contract = {'settings': settings, 'train_sha256': sha256(a.train),
                'validation_sha256': sha256(a.validation), 'precision': str(dtype),
                'versions': {m: importlib.metadata.version(m) for m in ['torch', 'transformers', 'peft', 'accelerate']}}
    manifest_path = output / 'training_manifest.json'
    previous = json.loads(manifest_path.read_text()) if manifest_path.exists() else None
    contract_path = output / 'training_contract.json'
    if output.exists() and any(output.iterdir()) and previous is None and not contract_path.exists():
        raise ValueError('Unrecognized nonempty training directory; preserving its files')
    legacy = previous is not None and not contract_path.exists()
    if legacy:
        old_settings = {k: previous['arguments'].get(k) for k in settings}
        if old_settings != settings or any(previous[k] != contract[k] for k in ['train_sha256', 'validation_sha256']):
            raise ValueError('Legacy training settings/data differ; preserving old run')
    frozen_json(contract_path, contract)
    contract_hash = digest(contract_path)
    if previous and previous.get('completed'):
        adapter = output / 'adapter/adapter_model.safetensors'
        if not adapter.exists() or (previous.get('adapter_sha256') and digest(adapter) != previous['adapter_sha256']):
            raise ValueError('Completed adapter is missing or changed')
        return previous  # Never retrain or rewrite a completed experiment.
    if legacy:
        # Migration is explicit; no source identity is retroactively invented.
        atomic_json(output / 'resume_migration.json', {'legacy_manifest_sha256': digest(manifest_path),
                    'settings_and_data_verified': True, 'original_revision': previous.get('revision')})
        for path in (output / 'checkpoints').glob('checkpoint-*'):
            if not (path / 'checkpoint_complete.json').exists():
                try:
                    mark_checkpoint(path, contract_hash)
                except (ValueError, OSError, KeyError):
                    pass  # Partial legacy checkpoints remain preserved and are not resumed.
    checkpoint = latest_checkpoint(output / 'checkpoints', contract_hash)
    set_seed(a.seed)
    tok = AutoTokenizer.from_pretrained(a.model, revision=a.revision)
    tok.pad_token = tok.eos_token
    train, train_stats = load_encoded(tok, a.train, a.max_length, a.limit, a.seed)
    val, val_stats = load_encoded(tok, a.validation, a.max_length, seed=a.seed)
    # Fail if a changed source accidentally introduces instruction/target leakage.
    from .preprocess_dataset import instruction_key, command_key
    tr = [r for r, _ in read_jsonl(a.train)]
    va = [r for r, _ in read_jsonl(a.validation)]
    for key, fn in [('instruction', instruction_key), ('command', command_key)]:
        if {fn(r[key]) for r in tr} & {fn(r[key]) for r in va}:
            raise ValueError(f'Train/validation {key} overlap')
    kwargs = {'revision': a.revision, 'torch_dtype': dtype}
    if a.qlora:
        from transformers import BitsAndBytesConfig
        kwargs.update(quantization_config=BitsAndBytesConfig(
            load_in_4bit=True, bnb_4bit_quant_type='nf4', bnb_4bit_use_double_quant=True,
            bnb_4bit_compute_dtype=dtype), device_map={'': torch.cuda.current_device()})
    model = AutoModelForCausalLM.from_pretrained(a.model, **kwargs)
    if a.qlora:
        model = prepare_model_for_kbit_training(model)
    model = get_peft_model(model, LoraConfig(
        r=a.rank, lora_alpha=2 * a.rank, lora_dropout=0.05,
        target_modules=a.target_modules.split(','), task_type='CAUSAL_LM', bias='none', revision=a.revision))
    model.config.use_cache = False
    model.print_trainable_parameters()
    args = TrainingArguments(
        output_dir=str(output / 'checkpoints'), num_train_epochs=a.epochs, max_steps=a.max_steps,
        per_device_train_batch_size=a.batch_size, gradient_accumulation_steps=a.accumulation,
        per_device_eval_batch_size=a.batch_size, learning_rate=a.learning_rate,
        lr_scheduler_type='cosine', warmup_ratio=0.05, weight_decay=0.01,
        logging_steps=10, save_strategy='steps', eval_strategy='steps',
        eval_steps=a.eval_steps, save_steps=a.eval_steps, save_total_limit=2,
        load_best_model_at_end=True, restore_callback_states_from_checkpoint=True, metric_for_best_model='eval_loss', greater_is_better=False,
        report_to='none', seed=a.seed, data_seed=a.seed, fp16=cuda and not bf16, bf16=bf16,
        gradient_checkpointing=True, gradient_checkpointing_kwargs={'use_reentrant': False})
    class CompleteCheckpoint(TrainerCallback):
        def on_save(self, args, state, control, **kwargs):
            mark_checkpoint(Path(args.output_dir) / f'checkpoint-{state.global_step}', contract_hash)
    trainer = Trainer(model=model, args=args, train_dataset=train, eval_dataset=val,
                      data_collator=lambda batch: collate_examples(batch, tok.pad_token_id),
                      callbacks=[EarlyStoppingCallback(early_stopping_patience=3), CompleteCheckpoint()])
    manifest = {'completed': False, 'model': a.model,
                'revision': getattr(model.config, '_commit_hash', a.revision), 'arguments': dict(vars(a)),
                'train_sha256': sha256(a.train), 'validation_sha256': sha256(a.validation),
                'train_stats': train_stats, 'validation_stats': val_stats,
                'trainable_parameters': sum(p.numel() for p in model.parameters() if p.requires_grad),
                'device': str(args.device), 'precision': str(dtype), 'seed': a.seed}
    if previous:
        manifest.update(previous)
    atomic_json(manifest_path, manifest)
    if 'initial_validation_metrics' not in manifest:
        manifest['initial_validation_metrics'] = trainer.evaluate()
        atomic_json(manifest_path, manifest)
    finished_path = output / 'training_finished.json'
    finished = json.loads(finished_path.read_text()) if finished_path.exists() else None
    if not finished:
        # Recover an interruption immediately after the terminal checkpoint was saved.
        state = json.loads((checkpoint / 'trainer_state.json').read_text()) if checkpoint else {}
        callback = state.get('stateful_callbacks', {}).get('EarlyStoppingCallback', {})
        attributes = callback.get('attributes', {}) if isinstance(callback, dict) else {}
        terminal = state and (state['global_step'] >= state['max_steps'] or
                              attributes.get('early_stopping_patience_counter', 0) >= 3)
        if terminal:
            losses = [r['loss'] for r in state['log_history'] if 'loss' in r]
            finished = {'contract_sha256': contract_hash, 'trainer_state': state,
                        'train_metrics': {'train_loss': None, 'epoch': state['epoch']},
                        'logged_training_loss_mean': sum(losses) / len(losses) if losses else None,
                        'loss_scope': 'Recovered terminal checkpoint; aggregate invocation loss unavailable.'}
        else:
            result = trainer.train(resume_from_checkpoint=str(checkpoint) if checkpoint else None)
            finished = {'contract_sha256': contract_hash, 'trainer_state': dataclasses.asdict(trainer.state),
                        'train_metrics': result.metrics,
                        'loss_scope': 'Trainer invocation loss; after resume this is not a full-run mean.'}
        atomic_json(finished_path, finished)
    if finished['contract_sha256'] != contract_hash:
        raise ValueError('Finished training contract differs')
    trainer.state = TrainerState(**finished['trainer_state'])
    best = trainer.state.best_model_checkpoint
    if not best or not checkpoint_valid(best, contract_hash):
        raise ValueError('Selected checkpoint is not complete and verified')
    # Finalization is resumable even if interrupted after optimization but before adapter export.
    from peft import set_peft_model_state_dict
    from safetensors.torch import load_file
    set_peft_model_state_dict(model, load_file(str(Path(best) / 'adapter_model.safetensors')))
    final = trainer.evaluate()
    adapter = output / 'adapter'
    trainer.save_model(str(adapter))
    tok.save_pretrained(adapter)
    trainer.save_state()
    if trainer.state.best_model_checkpoint is None:
        raise RuntimeError('No validation-selected checkpoint saved; increase step budget or reduce eval-steps')
    manifest.update(completed=True, actual_optimizer_steps=trainer.state.global_step,
                    completed_epochs=trainer.state.epoch, best_checkpoint=trainer.state.best_model_checkpoint,
                    best_validation_loss=trainer.state.best_metric,
                    train_metrics=finished['train_metrics'], validation_metrics=final, adapter=str(adapter),
                    adapter_sha256=digest(adapter / 'adapter_model.safetensors'),
                    train_loss_scope=finished['loss_scope'], resumed_from=str(checkpoint) if checkpoint else None)
    atomic_json(output / 'history.json', trainer.state.log_history)
    atomic_json(manifest_path, manifest)
    return manifest


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--model', default=MODEL_ID)
    p.add_argument('--revision', default=REVISION)
    p.add_argument('--train', default='data/quality/train.jsonl')
    p.add_argument('--validation', default='data/review2/validation.jsonl')
    p.add_argument('--output', default='models/full-lora')
    p.add_argument('--epochs', type=float, default=3)
    p.add_argument('--max-steps', type=int, default=-1)
    p.add_argument('--max-length', type=int, default=512)
    p.add_argument('--limit', type=int)
    p.add_argument('--learning-rate', type=float, default=1e-4)
    p.add_argument('--batch-size', type=int, default=2)
    p.add_argument('--accumulation', type=int, default=8)
    p.add_argument('--rank', type=int, default=16)
    p.add_argument('--target-modules', default=','.join(TARGET_MODULES))
    p.add_argument('--eval-steps', type=int, default=100)
    p.add_argument('--seed', type=int, default=42)
    p.add_argument('--require-cuda', action='store_true')
    p.add_argument('--resume', action='store_true')
    p.add_argument('--qlora', action='store_true')
    train_run(p.parse_args())


if __name__ == '__main__':
    main()
