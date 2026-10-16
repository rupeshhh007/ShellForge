"""Token-free ZIP bootstrap. Also embedded verbatim in the first notebook cell."""
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import subprocess
import tempfile
import zipfile

SOURCE_ROOTS = ('src', 'scripts', 'benchmarks')
SOURCE_FILES = ('requirements.txt', 'requirements-model.txt', 'requirements-colab.txt',
                'artifacts/qwen-lora/training_manifest.json',
                'reports/metrics/base/generation.json',
                'reports/metrics/base/generation_examples.jsonl')


def source_fingerprint(root):
    root = Path(root)
    paths = {p for name in SOURCE_ROOTS for p in (root / name).rglob('*')
             if p.is_file() and '__pycache__' not in p.parts and p.suffix != '.pyc'}
    paths.update(root / name for name in SOURCE_FILES)
    paths.update((root / 'data/review2').glob('*.jsonl.gz'))
    hasher = hashlib.sha256()
    for path in sorted(paths):
        hasher.update(path.relative_to(root).as_posix().encode() + b'\0')
        hasher.update(hashlib.sha256(path.read_bytes()).digest())
    return hasher.hexdigest()


def source_provenance(root):
    root = Path(root)
    marker = root / 'source_provenance.json'
    if marker.exists():
        result = json.loads(marker.read_text())
        if result['content_sha256'] != source_fingerprint(root):
            raise ValueError('Uploaded runtime source changed since extraction')
        return result
    commit = None
    if (root / '.git').exists():
        commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
    return {'kind': 'git' if commit else 'directory', 'git_commit': commit,
            'content_sha256': source_fingerprint(root)}


def extract_repository_zip(archive_path, destination):
    archive_path, destination = Path(archive_path), Path(destination)
    archive_hash = hashlib.sha256(archive_path.read_bytes()).hexdigest()
    with zipfile.ZipFile(archive_path) as archive, tempfile.TemporaryDirectory(dir=destination.parent) as temporary:
        names = set()
        total = 0
        for info in archive.infolist():
            path = PurePosixPath(info.filename)
            if (path.is_absolute() or '..' in path.parts or '\\' in info.filename or
                    ':' in info.filename or info.filename in names or
                    stat.S_ISLNK(info.external_attr >> 16) or '.git' in path.parts):
                raise ValueError('ZIP contains unsafe or duplicate paths; use GitHub Code > Download ZIP')
            names.add(info.filename)
            total += info.file_size
            if total > 2 * 1024**3:
                raise ValueError('ZIP expands beyond 2 GiB; upload the repository source ZIP only')
        archive.extractall(temporary)
        candidates = [p.parent.parent for p in Path(temporary).rglob('scripts/run_gpu_experiments.py')
                      if (p.parent.parent / 'src/train.py').is_file()]
        if len(candidates) != 1:
            raise ValueError('ZIP must contain exactly one ShellForge repository root')
        root = candidates[0]
        for name in (*SOURCE_FILES, 'src/run_state.py', 'src/archive_source.py',
                     'data/review2/train.jsonl.gz', 'data/review2/validation.jsonl.gz', 'data/review2/test.jsonl.gz'):
            if not (root / name).is_file():
                raise ValueError('ZIP is outdated or incomplete. Download the latest PR branch ZIP.')
        comment = archive.comment.decode('ascii', errors='replace').strip()
        provenance = {'kind': 'uploaded_zip', 'git_commit': None,
                      'archive_declared_commit': comment if re.fullmatch('[0-9a-fA-F]{40}', comment) else None,
                      'commit_verified': False, 'archive_sha256': archive_hash,
                      'content_sha256': source_fingerprint(root)}
        if destination.exists():
            if source_fingerprint(destination) != provenance['content_sha256']:
                raise ValueError('A different source is already extracted. Reconnect a fresh runtime and upload the same ZIP used by the run.')
            return destination, source_provenance(destination)
        shutil.copytree(root, destination)
        (destination / 'source_provenance.json').write_text(json.dumps(provenance, indent=2) + '\n')
        return destination, provenance
