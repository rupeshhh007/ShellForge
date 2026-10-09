"""Checked positional importer; full corpus by default, original pilot untouched."""
import argparse
from .preprocess_dataset import import_pairs, write_jsonl

def main():
    p=argparse.ArgumentParser();p.add_argument('--nl',default='data/nl2bash/all.nl');p.add_argument('--commands',default='data/nl2bash/all.cm');p.add_argument('--output',default='data/review2/imported.jsonl');p.add_argument('--limit',type=int)
    a=p.parse_args();pairs,count=import_pairs(a.nl,a.commands)
    rows=[{**r,'source':s,'alignment':'positional; not semantically certified'} for r,s in pairs if r['instruction'].strip() and r['command'].strip()]
    if a.limit is not None:
        if a.limit<0: raise ValueError('limit must be nonnegative')
        rows=rows[:a.limit]
    write_jsonl(a.output,rows);print(f'Aligned lines: {count}; imported: {len(rows)}')
if __name__=='__main__':main()
