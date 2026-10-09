"""NL -> command proposal -> static policy -> explanation -> JSON. No execution."""
import argparse
import json
from pathlib import Path
import re
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from .preprocess_dataset import read_jsonl
from .safety_validator import check_command, safe_preview

MODEL_ID='Qwen/Qwen2.5-0.5B-Instruct'
MAX_INPUT_TOKENS=512
MAX_NEW_TOKENS=256
SYSTEM='Translate the user request to a single Bash command. Return only the command, no Markdown or explanation. Never execute any command.'

class RetrievalGenerator:
    """Reproducible lightweight 1-NN baseline; fit only the training split."""
    def __init__(self, train_path='data/review2/train.jsonl'):
        self.rows=[r for r,_ in read_jsonl(train_path)]
        if not self.rows:
            raise ValueError('Empty training set')
        self.vectorizer=TfidfVectorizer(analyzer='char_wb',ngram_range=(3,5),lowercase=True)
        self.matrix=self.vectorizer.fit_transform([r['instruction'] for r in self.rows])
    def generate(self, request):
        scores=cosine_similarity(self.vectorizer.transform([request]),self.matrix)[0]
        i=int(scores.argmax());r=self.rows[i]
        return {'command':r['command'],'backend':'tfidf-1nn','score':float(scores[i]),
                'matched_training_id':r.get('id'), 'matched_instruction':r['instruction'],
                'explanation':r.get('explanation') or 'Retrieved a training command for a similar request; inspect arguments and paths against your intent.'}

class HFGenerator:
    def __init__(self, model=MODEL_ID, adapter=None, revision=None):
        import torch
        from transformers import AutoTokenizer,AutoModelForCausalLM
        torch.manual_seed(42);torch.set_num_threads(4)
        if adapter:
            from peft import PeftConfig
            config=PeftConfig.from_pretrained(adapter)
            if config.base_model_name_or_path != model:
                raise ValueError('Adapter base model does not match requested model')
            if config.revision and revision and config.revision != revision:
                raise ValueError('Adapter revision does not match requested model revision')
            revision=revision or config.revision
        self.tokenizer=AutoTokenizer.from_pretrained(model,revision=revision)
        self.model=AutoModelForCausalLM.from_pretrained(model,revision=revision,torch_dtype=torch.float32 if not torch.cuda.is_available() else torch.float16)
        if adapter:
            from peft import PeftModel
            self.model=PeftModel.from_pretrained(self.model,adapter)
        self.model.to('cuda' if torch.cuda.is_available() else 'cpu').eval()
        self.name=model+(' + LoRA' if adapter else ' base');self.revision=getattr(self.model.config,'_commit_hash',revision)
    def generate(self,request):
        import torch
        prompt=self.tokenizer.apply_chat_template([{'role':'system','content':SYSTEM},{'role':'user','content':request}], tokenize=False,add_generation_prompt=True)
        inputs=self.tokenizer(prompt,return_tensors='pt',add_special_tokens=False).to(self.model.device)
        if inputs.input_ids.shape[1]>MAX_INPUT_TOKENS:
            return {'command':'','raw_generation':'','backend':self.name,'model_revision':self.revision,
                    'explanation':'Request exceeds model input token budget; generation abstained without truncation.'}
        with torch.inference_mode():
            ids=self.model.generate(**inputs,max_new_tokens=MAX_NEW_TOKENS,do_sample=False,pad_token_id=self.tokenizer.eos_token_id)
        raw=self.tokenizer.decode(ids[0,inputs.input_ids.shape[1]:],skip_special_tokens=True).strip()
        command=raw
        if raw.startswith('```') and raw.endswith('```'):
            command='\n'.join(raw.splitlines()[1:-1]).strip()
        return {'command':command,'raw_generation':raw,'backend':self.name,'model_revision':self.revision,
                'explanation':'Model command proposal. Static analysis below explains policy risk; semantic correctness has not been verified.'}

def propose(request,generator):
    if not isinstance(request,str) or not request.strip():
        raise ValueError('Request must be a nonempty string')
    if len(request)>4000:
        raise ValueError('Request exceeds 4000 characters')
    proposal=generator.generate(request)
    safety=check_command(proposal['command'])
    preview=safe_preview(proposal['command']) if safety['risk']!='SAFE' else None
    return {'request':request,**proposal,'safety':safety,
            'explanation':proposal['explanation']+' '+('Policy findings: '+ '; '.join(safety['reasons']) if safety['reasons'] else 'Only allowlisted read-only utilities were recognized.'),
            'safe_preview':preview,'preview_explanation':'Lists literal removal targets; does not simulate recursive contents.' if preview else 'No verified automatic safe preview available.',
            'executed':False,'requires_manual_review':True,
            'limitations':['Syntax validity does not imply request correctness.','SAFE is static allowlist classification, not a security guarantee.','No generated command is executed.']}

def main():
    p=argparse.ArgumentParser();p.add_argument('request');p.add_argument('--backend',choices=['baseline','hf'],default='baseline');p.add_argument('--train',default='data/review2/train.jsonl');p.add_argument('--model',default=MODEL_ID);p.add_argument('--adapter');p.add_argument('--revision')
    a=p.parse_args();g=RetrievalGenerator(a.train) if a.backend=='baseline' else HFGenerator(a.model,a.adapter,a.revision)
    print(json.dumps(propose(a.request,g),indent=2))
if __name__=='__main__':main()
