"""Actual Transformers + PEFT LoRA training entry point, not a mock implementation."""
import argparse
import hashlib
import json
import random
from pathlib import Path
from .inference import MODEL_ID,SYSTEM
from .preprocess_dataset import read_jsonl,write_json

def encode_example(tokenizer,row,max_length):
    prompt=tokenizer.apply_chat_template([{'role':'system','content':SYSTEM},{'role':'user','content':row['instruction']}],tokenize=False,add_generation_prompt=True)
    prompt_ids=tokenizer(prompt,add_special_tokens=False)['input_ids']
    answer_ids=tokenizer(row['command']+tokenizer.eos_token,add_special_tokens=False)['input_ids']
    # Preserve answer supervision; discard prompts too long to leave answer room.
    ids=prompt_ids+answer_ids
    if len(ids)>max_length or not answer_ids:
        return None
    return {'input_ids':ids,'attention_mask':[1]*len(ids),'labels':[-100]*len(prompt_ids)+answer_ids}

def main():
    p=argparse.ArgumentParser();p.add_argument('--model',default=MODEL_ID);p.add_argument('--revision');p.add_argument('--train',default='data/review2/train.jsonl');p.add_argument('--validation',default='data/review2/validation.jsonl');p.add_argument('--output',default='models/qwen-lora');p.add_argument('--max-steps',type=int,default=200);p.add_argument('--max-length',type=int,default=256);p.add_argument('--limit',type=int,default=2048);p.add_argument('--qlora',action='store_true')
    a=p.parse_args()
    import torch
    from transformers import AutoTokenizer,AutoModelForCausalLM,Trainer,TrainingArguments,set_seed
    from peft import LoraConfig,get_peft_model,prepare_model_for_kbit_training
    set_seed(42);torch.set_num_threads(4)
    if a.qlora and not torch.cuda.is_available():
        raise RuntimeError('QLoRA requires CUDA and bitsandbytes; use ordinary LoRA on CPU.')
    tok=AutoTokenizer.from_pretrained(a.model,revision=a.revision);tok.pad_token=tok.eos_token
    kwargs={'revision':a.revision,'torch_dtype':torch.float16 if torch.cuda.is_available() else torch.float32}
    if a.qlora:
        from transformers import BitsAndBytesConfig
        kwargs.update(quantization_config=BitsAndBytesConfig(load_in_4bit=True,bnb_4bit_quant_type='nf4',bnb_4bit_compute_dtype=torch.float16),device_map='auto')
    model=AutoModelForCausalLM.from_pretrained(a.model,**kwargs)
    if a.qlora:model=prepare_model_for_kbit_training(model)
    model=get_peft_model(model,LoraConfig(r=8,lora_alpha=16,lora_dropout=0.05,target_modules=['q_proj','v_proj'],task_type='CAUSAL_LM',bias='none'))
    model.print_trainable_parameters();model.config.use_cache=False
    def load(path,limit):
        rows=[r for r,_ in read_jsonl(path)];random.Random(42).shuffle(rows);rows=rows[:limit]
        encoded=[encode_example(tok,r,a.max_length) for r in rows]
        kept=[r for r in encoded if r is not None]
        if not kept:raise ValueError('No supervised examples fit max length')
        return kept,{'selected':len(rows),'used':len(kept),'too_long':len(rows)-len(kept)}
    train,train_stats=load(a.train,a.limit);val,val_stats=load(a.validation,min(a.limit,128))
    def collate(batch):
        width=max(len(r['input_ids']) for r in batch)
        return {key:torch.tensor([r[key]+[(-100 if key=='labels' else tok.pad_token_id if key=='input_ids' else 0)]*(width-len(r[key])) for r in batch]) for key in ['input_ids','attention_mask','labels']}
    args=TrainingArguments(output_dir=a.output,max_steps=a.max_steps,per_device_train_batch_size=1,gradient_accumulation_steps=4,per_device_eval_batch_size=1,learning_rate=2e-4,logging_steps=10,save_strategy='no',eval_strategy='no',report_to='none',seed=42,fp16=torch.cuda.is_available(),gradient_checkpointing=True,gradient_checkpointing_kwargs={'use_reentrant':False})
    trainer=Trainer(model=model,args=args,train_dataset=train,eval_dataset=val,data_collator=collate)
    result=trainer.train();validation=trainer.evaluate();trainer.save_model(a.output);tok.save_pretrained(a.output)
    write_json(Path(a.output)/'training_manifest.json',{'completed':True,'model':a.model,'revision':getattr(model.config,'_commit_hash',a.revision),'arguments':vars(a),'train_sha256':hashlib.sha256(Path(a.train).read_bytes()).hexdigest(),'validation_sha256':hashlib.sha256(Path(a.validation).read_bytes()).hexdigest(),'train_stats':train_stats,'validation_stats':val_stats,'train_metrics':result.metrics,'validation_metrics':validation,'device':'cuda' if torch.cuda.is_available() else 'cpu','seed':42})
if __name__=='__main__':main()
