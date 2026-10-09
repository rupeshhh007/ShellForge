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
