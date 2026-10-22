import test from 'node:test';
import assert from 'node:assert/strict';
import {schedule,POLICIES} from './scheduler.ts';
const p=(id,arrival,burst,priority=0)=>({id,arrival,burst,priority});
test('FCFS independent hand calculation including idle interval',()=>{
 const s=schedule([p('A',2,3),p('B',3,2),p('C',9,1)],'FCFS');
 assert.deepEqual(s.timeline,[{start:0,end:2,id:null},{start:2,end:5,id:'A'},{start:5,end:7,id:'B'},{start:7,end:9,id:null},{start:9,end:10,id:'C'}]);
 assert.deepEqual(s.metrics,[{id:'A',completion:5,turnaround:3,waiting:0,response:0},{id:'B',completion:7,turnaround:4,waiting:2,response:2},{id:'C',completion:10,turnaround:1,waiting:0,response:0}]);assert.equal(s.contextSwitches,1);
});
test('SJF is non-preemptive; arrival then original input order breaks ties',()=>{
 const s=schedule([p('A',0,5),p('B',1,2),p('C',1,1),p('D',1,1)],'SJF');
 assert.deepEqual(s.timeline.map(x=>x.id),['A','C','D','B']);assert.equal(s.metrics[1].waiting,6);
});
test('SRTF preempts on strictly shorter remaining job and respects ties',()=>{
 const s=schedule([p('A',0,5),p('B',1,2),p('C',2,1)],'SRTF');
 assert.deepEqual(s.timeline,[{start:0,end:1,id:'A'},{start:1,end:3,id:'B'},{start:3,end:4,id:'C'},{start:4,end:8,id:'A'}]);
 assert.deepEqual(s.metrics.map(x=>[x.waiting,x.response]),[[3,0],[0,0],[1,1]]);
});
test('RR enqueues boundary arrivals before expired job',()=>{
 const s=schedule([p('A',0,4),p('B',2,2)],'RR',2);
 assert.deepEqual(s.timeline,[{start:0,end:2,id:'A'},{start:2,end:4,id:'B'},{start:4,end:6,id:'A'}]);assert.equal(s.contextSwitches,2);
 assert.deepEqual(s.metrics.map(x=>x.response),[0,0]);
});
test('Priority is non-preemptive and lower numeric values run first',()=>{
 assert.deepEqual(schedule([p('A',0,3,9),p('B',1,1,0),p('C',1,1,0)],'Priority').timeline.map(x=>x.id),['A','B','C']);
});
for(const policy of POLICIES) test(`${policy}: workload conservation, metric identities, immutable input`,()=>{
 const jobs=[p('A',0,7,3),p('B',2,3,1),p('C',2,2,2)], prior=structuredClone(jobs), s=schedule(jobs,policy,1);
 assert.deepEqual(jobs,prior);
 for(const job of jobs){assert.equal(s.timeline.filter(x=>x.id===job.id).reduce((sum,x)=>sum+x.end-x.start,0),job.burst);const m=s.metrics.find(x=>x.id===job.id);assert.equal(m.turnaround,m.completion-job.arrival);assert.equal(m.waiting,m.turnaround-job.burst);assert.ok(m.response>=0&&m.waiting>=0);}
 assert.equal(s.frames.length,s.duration+1);assert.equal(s.averages.waiting,s.metrics.reduce((a,m)=>a+m.waiting,0)/3);
});
for(const invalid of [[],[p('A',0,0)],[p('A',-1,1)],[p('A',0,1.5)],[p('A',0,101)],[p('A',0,1),p('A',1,1)],[p('<img>',0,1)],[p('A',NaN,1)],[p('A',0,1,-1)]]) test('reject invalid process '+JSON.stringify(invalid),()=>assert.throws(()=>schedule(invalid,'FCFS')));
test('reject unsupported policies and invalid quanta',()=>{for(const q of [0,-1,1.5,101,NaN]) assert.throws(()=>schedule([p('A',0,1)],'RR',q));assert.throws(()=>schedule([p('A',0,1)],'fake'));});
test('RR one process and a quantum larger than burst cause no self context switches',()=>assert.equal(schedule([p('A',0,5)],'RR',2).contextSwitches,0));
