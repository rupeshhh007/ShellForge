"""Held-out generation and independent authored safety evaluation."""
import argparse
import csv
import hashlib
import json
from pathlib import Path
import time
import os
from .run_state import atomic_json, frozen_json, digest
from sklearn.metrics import classification_report, confusion_matrix
from .inference import RetrievalGenerator, HFGenerator, propose
from .generation_analysis import compare_command, summarize
from .preprocess_dataset import read_jsonl, write_json, write_jsonl
from .safety_validator import check_command, syntax_check

LABELS=['SAFE','CAUTION','DANGEROUS']

def safety_metrics(benchmark='benchmarks/safety_authored.tsv'):
    with open(benchmark) as f:
        rows=list(csv.DictReader(f,delimiter='\t'))
    for r in rows:
        r['prediction']=check_command(r['command'])['risk']
    actual=[r['label'] for r in rows];pred=[r['prediction'] for r in rows]
    report=classification_report(actual,pred,labels=LABELS,output_dict=True,zero_division=0)
    return {'n':len(rows),'benchmark_sha256':hashlib.sha256(Path(benchmark).read_bytes()).hexdigest(),
            'labels':LABELS,'confusion_matrix_rows_true_columns_pred':confusion_matrix(actual,pred,labels=LABELS).tolist(),
            'classification_report':report,
            'dangerous_false_negatives':[r for r in rows if r['label']=='DANGEROUS' and r['prediction']!='DANGEROUS'],
            'errors':[r for r in rows if r['label']!=r['prediction']],
            'ground_truth':'independently authored operation labels, not validator-generated; not external peer reviewed'},rows

def load_progress(path, rows):
    path = Path(path)
    if not path.exists():
        return []
    raw = path.read_bytes()
    lines = raw.splitlines(keepends=True)
    examples, offset = [], 0
    for index, line in enumerate(lines):
        try:
            item = json.loads(line)
        except (json.JSONDecodeError, UnicodeDecodeError):
            if index == len(lines)-1 and not line.endswith(b'\n'):
                with path.open('r+b') as stream:
                    stream.truncate(offset)  # Only an uncommitted, torn final write is discarded.
                break
            raise ValueError('Malformed committed evaluation journal; preserving evidence')
        if not isinstance(item, dict) or index >= len(rows) or (item.get('id'), item.get('instruction'), item.get('reference')) != (
                rows[index].get('id'), rows[index]['instruction'], rows[index]['command']):
            raise ValueError('Evaluation journal differs from frozen examples/order')
        if not all(key in item for key in ['prediction','exact_match','syntax_valid','normalized_match']):
            raise ValueError('Incomplete committed prediction')
        examples.append(item)
        offset += len(line)
    if examples and path.read_bytes() and not path.read_bytes().endswith(b'\n'):
        with path.open('ab') as stream:
            stream.write(b'\n')
    return examples


def generation_metrics(generator,rows,progress_path=None):
    examples=load_progress(progress_path, rows) if progress_path else []
    resumed_count=len(examples);start=time.monotonic()
    for r in rows[resumed_count:]:
        p=propose(r['instruction'],generator)
        examples.append({'id':r.get('id'),'instruction':r['instruction'],'reference':r['command'],
                         'prediction':p['command'],'exact_match':p['command']==r['command'],
                         'syntax_valid':p['safety']['syntax_valid'],'risk':p['safety']['risk'],'backend':p['backend'],
                         'retrieval_score':p.get('score'),'executed':False,
                         'category':r.get('category','unclassified'), 'raw_generation':p.get('raw_generation'),
                         'formatting_violation':p.get('raw_generation',p['command'])!=p['command'],
                         'generation_truncated':p.get('generation_truncated',False),
                         **compare_command(p['command'],r['command'])})
        if progress_path:
            path=Path(progress_path);path.parent.mkdir(parents=True,exist_ok=True)
            with path.open('a') as stream:
                stream.write(json.dumps(examples[-1],ensure_ascii=False)+'\n')
                stream.flush();os.fsync(stream.fileno())
    n=len(examples)
    if not n: raise ValueError('Empty evaluation set')
    return {**summarize(examples),'n':n,'exact_match':sum(x['exact_match'] for x in examples)/n,
            'bash_syntax_validity':sum(x['syntax_valid'] for x in examples)/n,
            'elapsed_seconds':time.monotonic()-start,'elapsed_seconds_scope':'current invocation',
            'reused_prediction_count':resumed_count,
            'metric_definition':'Exact command bytes; syntax via bash -n with clean environment. No execution or semantic equivalence testing.'},examples

def main():
    p=argparse.ArgumentParser();p.add_argument('--backend',choices=['baseline','hf'],default='baseline');p.add_argument('--train',default='data/review2/train.jsonl');p.add_argument('--test',default='data/review2/test.jsonl');p.add_argument('--output',default='reports/metrics');p.add_argument('--limit',type=int);p.add_argument('--model',default='Qwen/Qwen2.5-0.5B-Instruct');p.add_argument('--adapter');p.add_argument('--revision');p.add_argument('--resume',action='store_true')
    a=p.parse_args();rows=[r for r,_ in read_jsonl(a.test)]
    if a.limit is not None: rows=rows[:a.limit]
    out=Path(a.output)
    identity={'dataset_sha256':digest(a.test),'n':len(rows),'model':a.model if a.backend=='hf' else None,'revision':a.revision,
              'backend':a.backend,'decoding':{'do_sample':False,'max_input_tokens':512,'max_new_tokens':256} if a.backend=='hf' else None,
              'adapter_sha256':digest(Path(a.adapter)/'adapter_model.safetensors') if a.adapter else None}
    progress_path=out/'progress.jsonl' if a.resume else None
    if a.resume:
        frozen_json(out/'evaluation_contract.json',identity)
        complete=out/'evaluation_complete.json'
        metrics_path=out/'generation.json';examples_path=out/'generation_examples.jsonl'
        if complete.exists():
            marker=json.loads(complete.read_text())
            if (set(marker['files']) != {'generation.json','generation_examples.jsonl','safety.json','safety_predictions.jsonl','results.md'} or
                    marker['contract_sha256']!=digest(out/'evaluation_contract.json')) or any(
                    digest(out/name)!=value for name,value in marker['files'].items()):
                raise ValueError('Completed evaluation evidence changed')
            print('Reusing completed evaluation; no examples regenerated.')
            return
        if metrics_path.exists() and examples_path.exists() and not progress_path.exists():
            # Recover a legacy completed evaluation or a disconnect during final publication.
            m=json.loads(metrics_path.read_text())
            e=[json.loads(line) for line in examples_path.read_text().splitlines()]
            if (m.get('n')!=len(rows) or m.get('test_sha256')!=identity['dataset_sha256'] or
                    m.get('model')!=identity['model'] or m.get('model_revision')!=a.revision or
                    m.get('adapter')!=a.adapter or m.get('decoding')!=identity['decoding'] or len(e)!=len(rows)):
                raise ValueError('Existing evaluation does not match the requested frozen experiment')
            for saved,row in zip(e,rows):
                if (saved.get('id'),saved['instruction'],saved['reference'])!=(row.get('id'),row['instruction'],row['command']):
                    raise ValueError('Saved evaluation examples differ')
            if not progress_path.exists():
                write_jsonl(progress_path,e)
    saved=load_progress(progress_path,rows) if progress_path else []
    g=None if len(saved)==len(rows) else (RetrievalGenerator(a.train) if a.backend=='baseline' else HFGenerator(a.model,a.adapter,a.revision))
    metrics,examples=generation_metrics(g,rows,progress_path)
    metrics.update({'backend':a.backend,'model':a.model if a.backend=='hf' else None,'adapter':a.adapter,'model_revision':getattr(g,'revision',a.revision),'test_sha256':hashlib.sha256(Path(a.test).read_bytes()).hexdigest(),'decoding':{'do_sample':False,'max_input_tokens':512,'max_new_tokens':256} if a.backend=='hf' else None,'test_selection':'entire held-out test' if a.limit is None else f'first {a.limit} deterministic test records','fine_tuning_completed':bool(a.adapter)})
    atomic_json(out/'generation.json',metrics);write_jsonl(out/'generation_examples.jsonl',examples)
    safety, safety_rows=safety_metrics();write_json(out/'safety.json',safety);write_jsonl(out/'safety_predictions.jsonl',safety_rows)
    text=['# Actual evaluation results','',f"Generation backend: {metrics['backend']}; n={metrics['n']}; exact match={metrics['exact_match']:.4f}; Bash syntax validity={metrics['bash_syntax_validity']:.4f}.",'','| Class | Precision | Recall | F1 | Support |','|---|---:|---:|---:|---:|']
    for label in LABELS:
        r=safety['classification_report'][label];text.append(f"| {label} | {r['precision']:.4f} | {r['recall']:.4f} | {r['f1-score']:.4f} | {r['support']:.0f} |")
    text+=['',f"Dangerous false negatives: {len(safety['dangerous_false_negatives'])}.",'','Exact match is strict and can underestimate equivalent commands; no semantic correctness score is claimed. Retrieval copies a valid training command, so syntax validity says little about intent accuracy. Safety labels are authored independently but are not externally adjudicated. No base-vs-tuned comparison unless both actually run.']
    (out/'results.md').write_text('\n'.join(text)+'\n')
    if a.resume:
        atomic_json(out/'evaluation_complete.json',{'contract_sha256':digest(out/'evaluation_contract.json'),
                    'files':{name:digest(out/name) for name in ['generation.json','generation_examples.jsonl','safety.json','safety_predictions.jsonl','results.md']}})
    print('\n'.join(text))
if __name__=='__main__':main()
