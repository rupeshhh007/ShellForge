from src.train import encode_example

class Tokenizer:
    eos_token='!'
    def apply_chat_template(self,messages,tokenize=False,add_generation_prompt=True):
        return 'PROMPT'
    def __call__(self,text,add_special_tokens=False):
        return {'input_ids':[ord(c) for c in text]}

def test_answer_only_loss_mask():
    row={'instruction':'list','command':'ls'}
    encoded=encode_example(Tokenizer(),row,20)
    assert encoded['labels'][:6]==[-100]*6
    assert encoded['labels'][6:]==[ord('l'),ord('s'),ord('!')]
    assert encoded['input_ids']==[ord(c) for c in 'PROMPTls!']
    assert encode_example(Tokenizer(),row,5) is None


def test_padding_masks_eos_and_padding_differently():
    import pytest
    torch = pytest.importorskip('torch')
    from src.train import collate_examples
    a = encode_example(Tokenizer(), {'instruction': 'a', 'command': 'ls'}, 20)
    b = encode_example(Tokenizer(), {'instruction': 'b', 'command': 'pwd'}, 20)
    padded = collate_examples([a, b], ord('!'))
    assert padded['labels'][0, -2].item() == ord('!')  # real EOS supervised
    assert padded['labels'][0, -1].item() == -100      # EOS-valued pad ignored
    assert padded['attention_mask'][0, -1].item() == 0


def test_real_qwen_chat_template_prefix():
    import pytest
    transformers = pytest.importorskip('transformers')
    from src.inference import MODEL_ID, SYSTEM
    from src.train import REVISION
    tok = transformers.AutoTokenizer.from_pretrained(MODEL_ID, revision=REVISION)
    row = {'instruction': 'Print the current directory', 'command': 'pwd'}
    encoded = encode_example(tok, row, 512)
    full = tok.apply_chat_template([{'role':'system','content':SYSTEM},
                                   {'role':'user','content':row['instruction']},
                                   {'role':'assistant','content':row['command']}],
                                  tokenize=False, add_generation_prompt=False)
    ids = tok(full, add_special_tokens=False)['input_ids']
    assert ids[:len(encoded['input_ids'])] == encoded['input_ids']
    assert encoded['labels'][-1] == tok.eos_token_id
    assert tok.decode([x for x in encoded['labels'] if x != -100], skip_special_tokens=True) == 'pwd'


def test_trainer_checkpoint_roundtrip_with_tiny_random_model(tmp_path, monkeypatch):
    """Engineering integration test, never a trained command-generation result."""
    import argparse
    import json
    import pytest
    pytest.importorskip('torch')
    transformers = pytest.importorskip('transformers')
    pytest.importorskip('peft')
    from src.train import train_run, TARGET_MODULES
    from src.preprocess_dataset import write_jsonl
    class LocalTokenizer(Tokenizer):
        pad_token_id = 33
        def save_pretrained(self, path):
            from pathlib import Path
            Path(path).mkdir(parents=True, exist_ok=True)
            (Path(path) / 'test-tokenizer.json').write_text('{}')
    model = transformers.Qwen2ForCausalLM(transformers.Qwen2Config(
        vocab_size=256, hidden_size=32, intermediate_size=64,
        num_hidden_layers=1, num_attention_heads=4, num_key_value_heads=2))
    monkeypatch.setattr(transformers.AutoTokenizer, 'from_pretrained', lambda *a, **kw: LocalTokenizer())
    monkeypatch.setattr(transformers.AutoModelForCausalLM, 'from_pretrained', lambda *a, **kw: model)
    train = tmp_path / 'train.jsonl'
    val = tmp_path / 'validation.jsonl'
    write_jsonl(train, [{'instruction':'list', 'command':'ls'}, {'instruction':'files', 'command':'ls -a'}])
    write_jsonl(val, [{'instruction':'location', 'command':'pwd'}])
    args = argparse.Namespace(model='random-engineering-test', revision=None,
        train=str(train), validation=str(val), output=str(tmp_path / 'run'), require_cuda=False,
        qlora=False, limit=None, epochs=1, max_steps=2, learning_rate=1e-4,
        batch_size=1, accumulation=1, eval_steps=1, rank=2, seed=42,
        max_length=64, target_modules=','.join(TARGET_MODULES))
    manifest = train_run(args)
    assert manifest['completed'] and manifest['actual_optimizer_steps'] == 2
    assert manifest['best_checkpoint'] and manifest['best_validation_loss'] > 0
    assert (tmp_path / 'run/adapter/adapter_model.safetensors').exists()
    assert json.loads((tmp_path / 'run/history.json').read_text())
