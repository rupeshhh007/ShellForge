"""Atomic cloud run journals and verified full-state training checkpoints."""
import hashlib
import json
import os
from pathlib import Path
import tempfile


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def atomic_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode='w', dir=path.parent, prefix=path.name + '.',
                                     suffix='.tmp', delete=False) as stream:
        temporary = Path(stream.name)
        json.dump(value, stream, indent=2)
        stream.write('\n')
        stream.flush()
        os.fsync(stream.fileno())
    try:
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def frozen_json(path, value):
    path = Path(path)
    if path.exists():
        if json.loads(path.read_text()) != value:
            raise ValueError(f'Resume contract differs: {path}. Existing evidence was preserved.')
    else:
        atomic_json(path, value)


CHECKPOINT_FILES = {'adapter_model.safetensors', 'adapter_config.json', 'optimizer.pt',
                    'scheduler.pt', 'rng_state.pth', 'trainer_state.json', 'training_args.bin'}


def mark_checkpoint(path, contract_hash):
    path = Path(path)
    required = ['adapter_model.safetensors', 'adapter_config.json', 'optimizer.pt',
                'scheduler.pt', 'rng_state.pth', 'trainer_state.json', 'training_args.bin']
    if any(not (path / name).is_file() for name in required):
        raise ValueError('Checkpoint lacks full optimizer/scheduler/RNG/trainer state')
    state = json.loads((path / 'trainer_state.json').read_text())
    if state['global_step'] != int(path.name.split('-')[-1]):
        raise ValueError('Checkpoint step differs from trainer state')
    files = required + (['scaler.pt'] if (path / 'scaler.pt').exists() else [])
    atomic_json(path / 'checkpoint_complete.json', {
        'contract_sha256': contract_hash, 'global_step': state['global_step'],
        'files': {name: digest(path / name) for name in files}})


def checkpoint_valid(path, contract_hash):
    path = Path(path)
    try:
        marker = json.loads((path / 'checkpoint_complete.json').read_text())
        return (marker['contract_sha256'] == contract_hash and
                marker['global_step'] == int(path.name.split('-')[-1]) and
                CHECKPOINT_FILES <= set(marker['files']) <= CHECKPOINT_FILES | {'scaler.pt'} and
                all((path / name).is_file() and digest(path / name) == value
                    for name, value in marker['files'].items()))
    except (OSError, ValueError, KeyError, TypeError):
        return False


def latest_checkpoint(directory, contract_hash):
    candidates = sorted(Path(directory).glob('checkpoint-*'),
                        key=lambda p: int(p.name.split('-')[-1]) if p.name.split('-')[-1].isdigit() else -1,
                        reverse=True)
    for path in candidates:
        if checkpoint_valid(path, contract_hash):
            state = json.loads((path / 'trainer_state.json').read_text())
            best = state.get('best_model_checkpoint')
            if best and (Path(best).resolve().parent != Path(directory).resolve() or
                         not checkpoint_valid(best, contract_hash)):
                raise ValueError('Best checkpoint is missing or changed; refusing unverified resume')
            return path
    return None
