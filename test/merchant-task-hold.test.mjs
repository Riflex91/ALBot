import test from 'node:test';
import assert from 'node:assert/strict';
import {createFairTasks} from '../src/core/fair-tasks.mjs';

test('selected job keeps its noncritical 30-second lease against incidental local work',()=>{
 let time=10000;
 const tasks=createFairTasks({holdMs:30000,starvationMs:120000,now:()=>time});
 const jobs=[{id:'services',priority:-1000,run:()=>true},{id:'nearby-acquisition',priority:100,local:true,run:()=>true}];
 tasks.selected('services');
 time+=29000;
 assert.equal(tasks.rank(jobs)[0].id,'services');
 time+=1001;
 assert.equal(tasks.rank(jobs)[0].id,'nearby-acquisition','after lease normal local work may run');
});
test('emergency local bank storage and starved jobs still supersede a held service',()=>{
 let time=10000;
 const tasks=createFairTasks({holdMs:30000,starvationMs:120000,now:()=>time});
 const jobs=[{id:'services',priority:-1000},{id:'bank',priority:1,critical:true,local:true}];
 tasks.selected('services');time+=1000;
 assert.equal(tasks.rank(jobs)[0].id,'bank');
 const ordinary=jobs.map(j=>({...j,critical:false}));
 tasks.defer('bank',1000);time+=2000; // non-critical lease already remains
 assert.equal(tasks.rank(ordinary)[0].id,'services');
});
