"""Full corpus validation and connected-component splitting; never executes data."""
import argparse
from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path
import random
import re
import shlex
from .safety_validator import check_command, parse_nodes

SEED = 42

def write_json(path, obj):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(obj, indent=2, ensure_ascii=False)+'\n')

def write_jsonl(path, records):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with Path(path).open('w') as f:
        for r in records:
            f.write(json.dumps(r, ensure_ascii=False)+'\n')

def read_jsonl(path, discards=None):
    out = []
    for lineno, line in enumerate(Path(path).read_text().splitlines(), 1):
        try:
            if not line.strip():
                raise ValueError('blank_line')
            item = json.loads(line)
            if not isinstance(item, dict):
                raise ValueError('not_object')
            for key in ('instruction','command'):
                if key not in item:
                    raise ValueError('missing_'+key)
                if not isinstance(item[key], str):
                    raise ValueError('invalid_type_'+key)
                if not item[key].strip():
                    raise ValueError('empty_'+key)
                if '\x00' in item[key]:
                    raise ValueError('nul_'+key)
            # Command bytes intentionally unchanged, including internal spacing/quotes.
            out.append((item, {'path':str(path),'line':lineno}))
        except (json.JSONDecodeError, ValueError) as exc:
            if discards is not None:
                discards.append({'path':str(path),'line':lineno,'reason':str(exc) if isinstance(exc,ValueError) and not isinstance(exc,json.JSONDecodeError) else 'malformed_json'})
    return out

def import_pairs(nl, cm):
    a, b = Path(nl).read_text().splitlines(), Path(cm).read_text().splitlines()
    if len(a) != len(b):
        raise ValueError(f'Positional alignment mismatch: {len(a)} NL vs {len(b)} command lines')
    return [({'instruction':i,'command':c}, {'path':str(nl)+' + '+str(cm),'line':n})
            for n,(i,c) in enumerate(zip(a,b),1)], len(a)

def instruction_key(text):
    return ' '.join(text.casefold().split())

def command_key(command):
    """Conservative AST fingerprint: ignore trivia; preserve expansion source bytes."""
    try:
        import bashlex
        roots = bashlex.parse(command)
        # Only known independent additive flags; never canonicalize command bytes.
        if len(roots) == 1 and roots[0].kind == 'command':
            parts = roots[0].parts
            if parts and all(p.kind == 'word' and not p.parts for p in parts):
                words = [p.word for p in parts]
                supported = {'ls': set('alhRd'), 'rm': set('rfR')}
                aliases = {'--all': 'a', '--recursive': 'r', '--force': 'f'}
                name = words[0]
                if name in supported:
                    flags, operands, options, ok = set(), [], True, True
                    for word in words[1:]:
                        if options and word == '--':
                            options = False
                        elif options and word.startswith('-') and word != '-':
                            chars = aliases.get(word) if word.startswith('--') else word[1:]
                            if not chars or not set(chars) <= supported[name]:
                                ok = False
                                break
                            flags.update('r' if name == 'rm' and c == 'R' else c for c in chars)
                        else:
                            operands.append(word)
                    if ok:
                        return json.dumps(['additive_flags', name, sorted(flags), operands])
        def encode(n):
            if n.kind == 'word':
                if n.parts:
                    return ['expanded_word', command[n.pos[0]:n.pos[1]]]
                return ['word', n.word]
            values = []
            for key,value in sorted(vars(n).items()):
                if key in {'pos','kind'}:
                    continue
                if hasattr(value, 'kind'):
                    values.append([key,encode(value)])
                elif isinstance(value,list):
                    values.append([key,[encode(v) if hasattr(v,'kind') else str(v) for v in value]])
                else:
                    values.append([key,str(value)])
            return [n.kind,values]
        return json.dumps([encode(n) for n in roots],sort_keys=True)
    except Exception:
        return command  # unsupported syntax is grouped only byte-exactly

def category(command):
    try:
        names = {n.parts[0].word for n in parse_nodes(command) if n.kind=='command' and n.parts and n.parts[0].kind=='word'}
    except Exception:
        return 'unclassified'
    groups = [('permissions',{'chmod','chown','chgrp'}),('process_management',{'ps','kill','pkill','pgrep','killall','top'}),('file_search',{'find','locate'}),('text_processing',{'grep','sed','awk','wc','sort','cut','head','tail','cat'}),('networking',{'curl','wget','ssh','ping','ss','netstat'}),('compression',{'tar','zip','unzip','gzip'}),('system_monitoring',{'df','du','free','uptime'}),('navigation',{'pwd','cd'}),('file_operations',{'ls','cp','mv','rm','mkdir','touch'})]
    return next((c for c,ns in groups if ns & names),'other')

def split_groups(records, seed=SEED):
    parent = list(range(len(records)))
    def root(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    seen = {}
    for i,r in enumerate(records):
        for k in [('instruction',instruction_key(r['instruction'])),('command',command_key(r['command']))]:
            if k in seen:
                parent[root(i)] = root(seen[k])
            else:
                seen[k] = i
    groups = defaultdict(list)
    for i,r in enumerate(records):
        groups[root(i)].append(r)
    components = list(groups.values())
    random.Random(seed).shuffle(components)
    components.sort(key=len,reverse=True)
    splits = {k:[] for k in ('train','validation','test')}
    targets = dict(zip(splits,[len(records)*.8,len(records)*.1,len(records)*.1]))
    for group in components:
        dest = max(splits,key=lambda k: targets[k]-len(splits[k]))
        gid = hashlib.sha256('\n'.join(sorted(r['id'] for r in group)).encode()).hexdigest()[:16]
        for r in group:
            r['group_id'] = gid
            r['split'] = dest
        splits[dest].extend(group)
    return splits, {'equivalence_groups':len(groups),'largest_group':max(map(len,groups.values()),default=0)}

def run(data='data', output='data/review2'):
    data, output = Path(data), Path(output)
    discards = []
    pairs, line_count = import_pairs(data/'nl2bash/all.nl',data/'nl2bash/all.cm')
    original_files = sorted(p for p in data.rglob('*') if p.is_file() and output not in p.parents and p.suffix in {'.jsonl','.nl','.cm'})
    audit = {str(p):{'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'physical_lines':len(p.read_text().splitlines()),'bytes':p.stat().st_size} for p in original_files}
    for p in original_files:
        if p.suffix=='.jsonl':
            pairs.extend(read_jsonl(p,discards))
    missing = Counter()
    records, seen = [], {}
    for item, source in pairs:
        for k in ('category','risk','explanation','safe_alternative'):
            if k not in item or item[k] in (None,''):
                missing[k] += 1
        if not item['instruction'].strip() or not item['command'].strip():
            discards.append({**source,'reason':'empty_pair'})
            continue
        key = (instruction_key(item['instruction']),item['command'])
        if key in seen:
            seen[key]['sources'].append(source)
            if item.get('risk'):
                seen[key]['original_annotations'].append({'source':source,'risk':item['risk'],'verification':'unverified_original'})
            discards.append({**source,'reason':'duplicate_pair','retained_id':seen[key]['id']})
            continue
        result = check_command(item['command'])
        if not result['syntax_valid']:
            discards.append({**source,'reason':'invalid_bash_syntax'})
            continue
        r = {'id':hashlib.sha256((item['instruction']+'\0'+item['command']).encode()).hexdigest()[:20],
             'instruction':item['instruction'],'command':item['command'],
             'category':category(item['command']),'category_label_source':'heuristic',
             'heuristic_risk':result['risk'],'verified_risk':None,
             'risk_label_source':'static-v2; not independent ground truth',
             'original_annotations':[{'source':source,'risk':item['risk'],'verification':'unverified_original'}] if item.get('risk') else [],
             'explanation':item.get('explanation',''),'safe_alternative':item.get('safe_alternative'),
             'sources':[source]}
        seen[key] = r
        records.append(r)
    splits, grouping = split_groups(records)
    leakage = {}
    for field,key_fn in [('instruction',instruction_key),('command',command_key),('group_id',str)]:
        sets = {s:{key_fn(r[field]) for r in rows} for s,rows in splits.items()}
        leakage[field] = {a+'_'+b:len(sets[a]&sets[b]) for a,b in [('train','validation'),('train','test'),('validation','test')]}
    for s,rows in splits.items():
        write_jsonl(output/(s+'.jsonl'), rows)
    write_jsonl(output/'discards.jsonl', discards)
    stats = {'seed':SEED,'source_commit':'ad24e3dc045fadacca75f796b99107b7072a60a6', 'sources':audit,
             'alignment':{'nl_lines':line_count,'command_lines':line_count,'positional_count_match':True,
                          'semantic_alignment':'Not established for every pair; corpus pairing is assumed, not independently verified.'},
             'input_records':len(pairs),'retained':len(records), 'discard_counts':dict(Counter(d['reason'] for d in discards)),
             'missing_optional_fields_before_dedup':dict(missing),'verified_risk_count':0,
             'category_counts':dict(Counter(r['category'] for r in records)),
             'heuristic_risk_counts':dict(Counter(r['heuristic_risk'] for r in records)),
             'splits':{s:len(rows) for s,rows in splits.items()},
             'split_risk_counts':{s:dict(Counter(r['heuristic_risk'] for r in rows)) for s,rows in splits.items()},
             'leakage':leakage, **grouping,
             'limitations':['AST grouping handles literal quote/whitespace equivalence, known additive ls/rm flag variants and shared instructions/commands transitively, not arbitrary semantic paraphrases or all Bash equivalences.','No command execution. SAFE is a static policy label, never a guarantee.','Original pilot files are preserved; derived samples are deduplicated with provenance.']}
    write_json(output/'stats.json',stats)
    write_json(output/'alignment_samples.json',[{'line':n,'instruction':pairs[n-1][0]['instruction'],'command':pairs[n-1][0]['command'],'review':'positional sample only; not certified semantic equivalence'} for n in [1,100,1000,6000,line_count]])
    print(json.dumps({k:stats[k] for k in ['input_records','retained','discard_counts','splits','heuristic_risk_counts','equivalence_groups','largest_group','leakage']},indent=2))
    return stats

if __name__=='__main__':
    p=argparse.ArgumentParser(); p.add_argument('--data',default='data');p.add_argument('--output',default='data/review2')
    a=p.parse_args();run(a.data,a.output)
