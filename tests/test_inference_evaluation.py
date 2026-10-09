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


def test_hf_refuses_long_prompts_and_records_decoding():
    torch = pytest.importorskip('torch')
    from src.inference import HFGenerator, MAX_NEW_TOKENS
    class Inputs(dict):
        @property
        def input_ids(self): return self['input_ids']
        def to(self, device): return self
    class Tokenizer:
        eos_token_id = 9
        def apply_chat_template(self, *args, **kwargs): return 'prompt'
        def __call__(self, *args, **kwargs):
            assert kwargs.get('add_special_tokens') is False
            assert not kwargs.get('truncation')
            return Inputs(input_ids=torch.tensor([[1] * self.width]))
        def decode(self, *args, **kwargs): return 'pwd'
    class Model:
        device = 'cpu'
        def generate(self, **kwargs):
            assert kwargs['max_new_tokens'] == MAX_NEW_TOKENS and not kwargs['do_sample']
            return torch.tensor([[1, 1, 1, 8, 9]])
    g = HFGenerator.__new__(HFGenerator)
    g.tokenizer, g.model, g.name, g.revision = Tokenizer(), Model(), 'unit-test', 'revision'
    g.tokenizer.width = 513
    assert g.generate('long')['command'] == ''
    g.tokenizer.width = 3
    p = g.generate('short')
    assert p['command'] == 'pwd' and not p['generation_truncated'] and p['generated_tokens'] == 2
