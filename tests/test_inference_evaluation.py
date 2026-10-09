import json
import pytest
from src.inference import RetrievalGenerator,propose
from src.evaluate import generation_metrics,safety_metrics
from src.preprocess_dataset import write_jsonl

class Fixed:
    def generate(self,request):return {'command':'rm -rf /tmp/cache','backend':'test','explanation':'Removal proposal'}

def test_structured_preview_and_no_execution():
    p=propose('remove cache',Fixed())
    assert p['executed'] is False and p['safety']['risk']=='DANGEROUS'
    assert p['safe_preview']=='ls -ld -- /tmp/cache'
    assert p['requires_manual_review']
    json.dumps(p)
    with pytest.raises(ValueError):propose('',Fixed())

def test_baseline_train_only(tmp_path):
    p=tmp_path/'train.jsonl';write_jsonl(p,[{'instruction':'list files','command':'ls'},{'instruction':'working directory','command':'pwd'}])
    g=RetrievalGenerator(p)
    assert g.generate('list files')['command']=='ls'
    assert g.generate('working directory')['command']=='pwd'

def test_metric_calculation():
    stats,examples=generation_metrics(Fixed(),[{'instruction':'remove','command':'rm -rf /tmp/cache'},{'instruction':'other','command':'ls'}])
    assert stats['exact_match']==.5 and stats['bash_syntax_validity']==1
    assert len(examples)==2

def test_independent_benchmark_schema():
    m,rows=safety_metrics()
    assert m['n']==102 and set(r['label'] for r in rows)=={'SAFE','CAUTION','DANGEROUS'}
    assert all(r['justification'] for r in rows)
    assert sum(sum(r) for r in m['confusion_matrix_rows_true_columns_pred'])==102
