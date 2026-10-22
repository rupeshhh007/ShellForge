import test from 'node:test';import assert from 'node:assert/strict';import {commandDiff} from './command-diff.ts';
test('ordered diff detects insertions, removals and repeated/reordered tokens',()=>{
 const d=commandDiff('find . -size 100M','find . -size +100M');assert.equal(d.left.filter(p=>p.changed).map(p=>p.text).join(''),'100M');assert.equal(d.right.filter(p=>p.changed).map(p=>p.text).join(''),'+100M');
 const reordered=commandDiff('a b a','a a b');assert.equal(reordered.left.filter(p=>p.changed).length,1);assert.equal(reordered.right.filter(p=>p.changed).length,1);
});
test('raw whitespace, unicode and inert shell text remain byte-identical',()=>{for(const [a,b]of [[' a\t😀 \n b','😀 b'],['<img onerror=x> ; $(x)','<img onerror=y> ; $(x)'],['','']]){const d=commandDiff(a,b);assert.equal(d.left.map(p=>p.text).join(''),a);assert.equal(d.right.map(p=>p.text).join(''),b);}});
test('bounded diff explicitly declines excessive inputs without losing raw text',()=>{for(const raw of ['x'.repeat(8001),Array(513).fill('x').join(' ')]){const d=commandDiff(raw,'x');assert.equal(d.supported,false);assert.equal(d.left.map(p=>p.text).join(''),raw);assert.match(d.message,/limit exceeded/);}});
