import json
from pathlib import Path
import pytest
from src.preprocess_dataset import import_pairs,read_jsonl,split_groups,command_key,instruction_key

def test_import_refuses_truncation(tmp_path):
    a=tmp_path/'nl';b=tmp_path/'cm';a.write_text('a\nb\n');b.write_text('ls\n')
    with pytest.raises(ValueError,match='alignment mismatch'):import_pairs(a,b)

def test_json_errors_types_empties_and_bytes(tmp_path):
    p=tmp_path/'x.jsonl'
    command='printf "a  b"\n'
    cases=['{bad','[]',json.dumps({'instruction':4,'command':'ls'}),json.dumps({'instruction':'a','command':''}),json.dumps({'instruction':'a'}),json.dumps({'instruction':'a','command':command})]
    p.write_text('\n'.join(cases));discards=[];rows=read_jsonl(p,discards)
    assert len(rows)==1 and len(discards)==5
    assert rows[0][0]['command']==command

def test_transitive_equivalence_split():
    rows=[{'id':str(i),'instruction':n,'command':c} for i,(n,c) in enumerate([('same','ls'),('same','pwd'),('third','pwd'),('fourth','echo ok'),('fifth','ls "a b"'),('sixth',"ls 'a b'")])]
    splits,_=split_groups(rows)
    assert rows[0]['split']==rows[1]['split']==rows[2]['split']
    assert rows[4]['split']==rows[5]['split']
    assert command_key('echo "a  b"')!=command_key('echo "a b"')
    assert command_key('echo "$HOME"')!=command_key("echo '$HOME'")
    assert command_key('ls -al') == command_key('ls -l -a')
    assert command_key('rm -fr x') == command_key('rm --recursive --force x')
    assert command_key('rm -rf -- -x') != command_key('rm -rf -x')
    again,_=split_groups([dict(r) for r in rows]);assert splits==again

def test_actual_splits_no_leakage():
    from itertools import combinations
    splits={s:[r for r,_ in read_jsonl('data/review2/'+s+'.jsonl')] for s in ['train','validation','test']}
    for a,b in combinations(splits,2):
        for field,fn in [('instruction',instruction_key),('command',command_key),('group_id',str)]:
            assert not {fn(r[field]) for r in splits[a]} & {fn(r[field]) for r in splits[b]}
