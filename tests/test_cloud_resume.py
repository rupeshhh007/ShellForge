"""Cloud engineering checks; fixtures are not scientific training/evaluation evidence."""
import ast
import json
from pathlib import Path
import shutil
import sys
import types
import zipfile

import pytest
from src.archive_source import SOURCE_FILES, extract_repository_zip, source_provenance
from src.run_state import atomic_json, digest, mark_checkpoint, latest_checkpoint, checkpoint_valid
from src.evaluate import generation_metrics, load_progress
from scripts.run_gpu_experiments import initialize_run

ROOT = Path(__file__).resolve().parents[1]


def repository_zip(path):
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as archive:
        for p in ROOT.rglob('*'):
            relative = p.relative_to(ROOT)
            if p.is_file() and relative.parts[0] in {'src', 'scripts', 'benchmarks', 'data', 'reports', 'artifacts'} and not any(x in relative.parts for x in ['__pycache__', '.pytest_cache']):
                if relative.parts[0] == 'data' and p.suffix not in {'.gz', '.json'}:
                    continue
                archive.write(p, 'ShellForge/' + relative.as_posix())
        for name in SOURCE_FILES:
            if name.startswith('requirements'):
                archive.write(ROOT / name, 'ShellForge/' + name)
        archive.comment = b'f' * 40
    return path


def test_zip_provenance_and_repeat(tmp_path):
    archive = repository_zip(tmp_path / 'repo.zip')
    root, provenance = extract_repository_zip(archive, tmp_path / 'repo')
    assert provenance['git_commit'] is None and provenance['commit_verified'] is False
    assert provenance['archive_declared_commit'] == 'f' * 40
    assert provenance['archive_sha256'] == digest(archive)
    assert source_provenance(root) == provenance
    assert extract_repository_zip(archive, root)[1] == provenance
    (root / 'src/train.py').write_text('changed')
    with pytest.raises(ValueError, match='changed'):
        source_provenance(root)
    with pytest.raises(ValueError, match='different source'):
        extract_repository_zip(archive, root)


@pytest.mark.parametrize('name', ['../escape', '/escape', 'x/.git/config', 'x\\evil', 'C:/escape'])
def test_zip_rejects_unsafe_entries(tmp_path, name):
    archive = tmp_path / 'bad.zip'
    with zipfile.ZipFile(archive, 'w') as z:
        z.writestr(name, 'bad')
    with pytest.raises(ValueError, match='unsafe'):
        extract_repository_zip(archive, tmp_path / 'repo')
    assert not (tmp_path / 'repo').exists()


def test_full_checkpoint_and_torn_later_checkpoint(tmp_path):
    from src.run_state import CHECKPOINT_FILES
    good = tmp_path / 'checkpoint-1';good.mkdir()
    for name in CHECKPOINT_FILES:
        (good / name).write_text('{}')
    atomic_json(good / 'trainer_state.json', {'global_step': 1, 'best_model_checkpoint': str(good)})
    mark_checkpoint(good, 'contract')
    (tmp_path / 'checkpoint-2').mkdir()
    assert latest_checkpoint(tmp_path, 'contract') == good
    assert not checkpoint_valid(good, 'other')
    (good / 'optimizer.pt').write_text('torn')
    assert latest_checkpoint(tmp_path, 'contract') is None
    atomic_json(good / 'checkpoint_complete.json', {'contract_sha256':'contract','global_step':1,'files':{}})
    assert not checkpoint_valid(good, 'contract')


def test_run_contract_and_completed_preservation(tmp_path):
    contract = {'settings': {'epochs':3}, 'source': {'content_sha256':'source'}, 'split_hashes':{'train':'abc'}}
    assert not initialize_run(tmp_path, contract, True)
    assert not initialize_run(tmp_path, contract, True)
    with pytest.raises(ValueError, match='Resume contract'):
        initialize_run(tmp_path, {**contract, 'source':{'content_sha256':'changed'}}, True)
    with pytest.raises(ValueError, match='Run exists'):
        initialize_run(tmp_path, contract, False)
    atomic_json(tmp_path / 'completion.json', {'completed':True})
    before = {p.name:(p.read_bytes(),p.stat().st_mtime_ns) for p in tmp_path.iterdir()}
    assert initialize_run(tmp_path, contract, True)
    assert before == {p.name:(p.read_bytes(),p.stat().st_mtime_ns) for p in tmp_path.iterdir()}


def test_interrupted_predictions_resume_only_remaining(tmp_path, monkeypatch):
    import src.evaluate as evaluation
    rows = [{'id':str(i),'instruction':f'example {i}','command':'pwd'} for i in range(4)]
    calls = []
    def propose(text, generator):
        calls.append(text)
        if len(calls) == 3:
            raise RuntimeError('disconnect')
        return {'command':'pwd','backend':'engineering-fixture','safety':{'syntax_valid':True,'risk':'SAFE'}}
    monkeypatch.setattr(evaluation, 'propose', propose)
    progress = tmp_path / 'progress.jsonl'
    with pytest.raises(RuntimeError, match='disconnect'):
        generation_metrics(object(), rows, progress)
    assert len(load_progress(progress, rows)) == 2
    calls.clear()
    metrics, examples = generation_metrics(object(), rows, progress)
    assert calls == ['example 2','example 3'] and metrics['reused_prediction_count'] == 2
    calls.clear()
    generation_metrics(None, rows, progress)
    assert calls == [] and len(examples) == 4
    with progress.open('ab') as f:f.write(b'{"torn":')
    assert len(load_progress(progress, rows)) == 4
    assert progress.read_bytes().endswith(b'\n')
    with progress.open('ab') as f:f.write(b'broken\n')
    with pytest.raises(ValueError, match='Malformed committed'):
        load_progress(progress, rows)


def test_completed_evaluation_never_loads_model(tmp_path, monkeypatch):
    import src.evaluate as evaluation
    from src.preprocess_dataset import write_jsonl
    dataset = tmp_path / 'data.jsonl'
    write_jsonl(dataset, [{'id':'1','instruction':'where','command':'pwd'}])
    monkeypatch.setattr(evaluation, 'HFGenerator', lambda *a: object())
    monkeypatch.setattr(evaluation, 'propose', lambda *a: {'command':'pwd','backend':'engineering-fixture','safety':{'syntax_valid':True,'risk':'SAFE'}})
    out = tmp_path / 'evaluation'
    monkeypatch.setattr(sys, 'argv', ['evaluate','--backend','hf','--test',str(dataset),'--output',str(out),'--resume','--revision','pinned'])
    evaluation.main()
    before = {p.name:(p.read_bytes(),p.stat().st_mtime_ns) for p in out.iterdir()}
    monkeypatch.setattr(evaluation, 'HFGenerator', lambda *a: pytest.fail('Completed test was regenerated'))
    evaluation.main()
    assert before == {p.name:(p.read_bytes(),p.stat().st_mtime_ns) for p in out.iterdir()}
    write_jsonl(dataset, [{'id':'2','instruction':'changed','command':'pwd'}])
    with pytest.raises(ValueError, match='Resume contract'):
        evaluation.main()


def test_every_notebook_cell_in_order(tmp_path, monkeypatch):
    """Execute all cells with mocked Colab/GPU boundaries, real extraction and PDF QA."""
    import nbformat
    notebook_path = ROOT / 'notebooks/ShellForge_Colab.ipynb'
    assert notebook_path.read_bytes() == (ROOT / 'review2-cloud/notebooks/ShellForge_Colab.ipynb').read_bytes()
    notebook = nbformat.read(notebook_path, as_version=4);nbformat.validate(notebook)
    codes = [''.join(c.source) for c in notebook.cells if c.cell_type == 'code']
    assert codes[0].startswith((ROOT / 'src/archive_source.py').read_text())
    archive = repository_zip(tmp_path / 'upload.zip')
    content = tmp_path / 'content';content.mkdir()
    from importlib.machinery import ModuleSpec
    colab = types.ModuleType('google.colab')
    colab.__spec__ = ModuleSpec('google.colab', loader=None)
    colab.files = types.SimpleNamespace(upload=lambda: {'ShellForge.zip':archive.read_bytes()})
    colab.drive = types.SimpleNamespace(mount=lambda path: Path(path).mkdir(parents=True,exist_ok=True))
    google = types.ModuleType('google');google.colab = colab
    google.__spec__ = ModuleSpec('google', loader=None)
    monkeypatch.setitem(sys.modules, 'google', google)
    monkeypatch.setitem(sys.modules, 'google.colab', colab)
    import subprocess
    real_run = subprocess.run
    commands = []
    def run(argv, **kw):
        commands.append(argv)
        assert kw.get('check') is True
        if 'venv' in argv:
            python = Path(argv[-1]) / 'bin/python';python.parent.mkdir(parents=True);python.symlink_to(sys.executable)
        elif 'pip' in argv or argv[0]=='apt-get':
            pass  # Dependency resolution is performed by the cloud CI setup, not inside this test.
        elif '-c' in argv and 'torch.cuda' in argv[-1]:
            compile(argv[-1], '<gpu-preflight>', 'exec')  # Actual GPU requires a live Colab session.
        elif 'pytest' in argv:
            kw['stdout'].write('Cloud suite executes this harness; nested pytest intentionally suppressed.\n')
        elif 'scripts/run_gpu_experiments.py' in argv:
            run_dir = Path(argv[argv.index('--output')+1]);run_dir.mkdir(parents=True)
            atomic_json(run_dir/'completion.json', {'completed':True,'new_training_executed':False,'engineering_fixture':True})
            # Report-only fixture stays in tmp_path; never becomes measured repository evidence.
            trial = run_dir/'trial-fixture';trial.mkdir()
            atomic_json(trial/'training_manifest.json', {
                'completed':True,'engineering_fixture':True,'train_stats':{'used':2},
                'actual_optimizer_steps':2,'completed_epochs':1.0,
                'arguments':{'rank':2,'learning_rate':1e-4,'batch_size':1,'accumulation':1},
                'train_metrics':{'train_loss':None},
                'initial_validation_metrics':{'eval_loss':4.0},'validation_metrics':{'eval_loss':3.9}})
            atomic_json(trial/'history.json', [{'step':1,'loss':4.0,'eval_loss':3.9}])
            atomic_json(run_dir/'comparison.json', {'primary_unexposed_test':{
                'n':2,'base':{'exact_match_count':1,'bash_syntax_validity':1.0},
                'tuned':{'exact_match_count':1,'bash_syntax_validity':1.0},
                'paired':{'exact_match_delta':0.0,'mcnemar_exact_p':1.0}}})
            atomic_json(run_dir/'selection.json', {'selected_adapter':str(trial/'adapter'),
                'revision':'pinned','improved_validation_exact_match':False})
        elif 'src.inference' in argv:
            pass  # No synthetic command is published as model evidence.
        else:
            return real_run(argv, **kw)
        return subprocess.CompletedProcess(argv, 0)
    monkeypatch.setattr(subprocess, 'run', run)
    monkeypatch.chdir(ROOT)
    namespace = {'__name__':'notebook_check'}
    for source in codes:
        assert 'git clone' not in source
        ast.parse(source)
        # Redirect only filesystem locations; execute every original cell's control flow.
        source = source.replace('/content', str(content))
        exec(compile(source, '<colab-cell>', 'exec'), namespace)
    assert any('--resume' in c and 'scripts/run_gpu_experiments.py' in c for c in commands)
    assert any('https://download.pytorch.org/whl/cu126' in c for c in commands)
    assert len(list(namespace['run_dir'].glob('review-*.png'))) == 4
    assert (ROOT/'requirements-colab.txt').read_text().startswith('-r requirements-model.txt')
    for name in ['torch','transformers','peft','accelerate','bashlex','sklearn','numpy','matplotlib','reportlab','pypdf','pytest']:
        __import__(name)
