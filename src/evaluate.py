"""Held-out generation and independent authored safety evaluation."""
import argparse
import csv
import hashlib
import json
from pathlib import Path
import time
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

def generation_metrics(generator,rows):
    examples=[];start=time.monotonic()
    for r in rows:
        p=propose(r['instruction'],generator)
        examples.append({'id':r.get('id'),'instruction':r['instruction'],'reference':r['command'],
                         'prediction':p['command'],'exact_match':p['command']==r['command'],
                         'syntax_valid':p['safety']['syntax_valid'],'risk':p['safety']['risk'],'backend':p['backend'],
                         'retrieval_score':p.get('score'),'executed':False,
                         'category':r.get('category','unclassified'), 'raw_generation':p.get('raw_generation'),
                         **compare_command(p['command'],r['command'])})
    n=len(examples)
    if not n: raise ValueError('Empty evaluation set')
    return {**summarize(examples),'n':n,'exact_match':sum(x['exact_match'] for x in examples)/n,
            'bash_syntax_validity':sum(x['syntax_valid'] for x in examples)/n,
            'elapsed_seconds':time.monotonic()-start,
            'metric_definition':'Exact command bytes; syntax via bash -n with clean environment. No execution or semantic equivalence testing.'},examples

def main():
    p=argparse.ArgumentParser();p.add_argument('--backend',choices=['baseline','hf'],default='baseline');p.add_argument('--train',default='data/review2/train.jsonl');p.add_argument('--test',default='data/review2/test.jsonl');p.add_argument('--output',default='reports/metrics');p.add_argument('--limit',type=int);p.add_argument('--model',default='Qwen/Qwen2.5-0.5B-Instruct');p.add_argument('--adapter');p.add_argument('--revision')
    a=p.parse_args();rows=[r for r,_ in read_jsonl(a.test)]
    if a.limit is not None: rows=rows[:a.limit]
    g=RetrievalGenerator(a.train) if a.backend=='baseline' else HFGenerator(a.model,a.adapter,a.revision)
    metrics,examples=generation_metrics(g,rows)
    metrics.update({'backend':a.backend,'model':a.model if a.backend=='hf' else None,'adapter':a.adapter,'model_revision':getattr(g,'revision',None),'test_sha256':hashlib.sha256(Path(a.test).read_bytes()).hexdigest(),'test_selection':'entire held-out test' if a.limit is None else f'first {a.limit} deterministic test records','fine_tuning_completed':bool(a.adapter)})
    out=Path(a.output);write_json(out/'generation.json',metrics);write_jsonl(out/'generation_examples.jsonl',examples)
    safety, safety_rows=safety_metrics();write_json(out/'safety.json',safety);write_jsonl(out/'safety_predictions.jsonl',safety_rows)
    text=['# Actual evaluation results','',f"Generation backend: {metrics['backend']}; n={metrics['n']}; exact match={metrics['exact_match']:.4f}; Bash syntax validity={metrics['bash_syntax_validity']:.4f}.",'','| Class | Precision | Recall | F1 | Support |','|---|---:|---:|---:|---:|']
    for label in LABELS:
        r=safety['classification_report'][label];text.append(f"| {label} | {r['precision']:.4f} | {r['recall']:.4f} | {r['f1-score']:.4f} | {r['support']:.0f} |")
    text+=['',f"Dangerous false negatives: {len(safety['dangerous_false_negatives'])}.",'','Exact match is strict and can underestimate equivalent commands; no semantic correctness score is claimed. Retrieval copies a valid training command, so syntax validity says little about intent accuracy. Safety labels are authored independently but are not externally adjudicated. No base-vs-tuned comparison unless both actually run.']
    (out/'results.md').write_text('\n'.join(text)+'\n');print('\n'.join(text))
if __name__=='__main__':main()
