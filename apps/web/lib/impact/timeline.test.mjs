import test from 'node:test'; import assert from 'node:assert/strict';
import {simulate,seedFilesystem} from './engine.ts';
test('trace records actual visited paths, predicate outcomes, matches and permissions',()=>{
 const r=simulate('find ./data -type f -size 100M',seedFilesystem());
 assert.equal(r.events[0].stage,'parse');assert.equal(r.events[1].stage,'resolve');
 assert.deepEqual(r.events.filter(e=>e.stage==='visit').map(e=>e.path),r.visited);
 assert.deepEqual(r.events.filter(e=>e.stage==='match').map(e=>e.path),r.matches);
 assert.ok(r.events.some(e=>e.stage==='permission'&&e.detail.includes('granted')));
 for(const [path,traces] of Object.entries(r.traces)) assert.equal(r.events.filter(e=>e.stage==='predicate'&&e.path===path).length,traces.length);
});
test('unsupported syntax records only rejection, without a fabricated traversal',()=>{const r=simulate('find ./data | sh',seedFilesystem());assert.equal(r.events.length,1);assert.equal(r.events[0].stage,'error');assert.equal(r.changes.length,0);});
test('mutation events agree exactly with preview and denial does not emit changes',()=>{
 const r=simulate('rm -rf ./tmp/cache',seedFilesystem());assert.deepEqual(r.events.filter(e=>e.stage==='change').map(e=>e.path),r.changes.map(c=>c.path));
 const denied=simulate('rm ./tmp/root-owned.tmp',seedFilesystem());assert.equal(denied.events.at(-1).stage,'error');assert.equal(denied.events.filter(e=>e.stage==='change').length,0);
});
