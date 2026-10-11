import test from 'node:test';
import assert from 'node:assert/strict';
import {createFairTasks} from '../src/core/fair-tasks.mjs';

test('merchant continues selected service until it yields, even after hold time and starvation age',()=>{
 let time=10000;
 const tasks=createFairTasks({holdMs:30000,starvationMs:120000,now:()=>time});
 const jobs=[{id:'services',priority:-1000},{id:'nearby-acquisition',priority:100,local:true}];
 tasks.selected('services');
 time+=121001;
 assert.equal(tasks.rank(jobs)[0].id,'services','do not interrupt live service for a new task');
 tasks.defer('services',1000);
 assert.equal(tasks.rank(jobs)[0].id,'nearby-acquisition','yield allows other work');
 time+=2000;
 tasks.selected('nearby-acquisition');
 assert.equal(tasks.rank(jobs)[0].id,'nearby-acquisition');
});

test('inventory-critical bank recovery may preempt the active job to avoid deadlock',()=>{
 let time=10000;
 const tasks=createFairTasks({holdMs:30000,starvationMs:120000,now:()=>time});
 const jobs=[{id:'services',priority:-1000},{id:'bank',priority:1,critical:true,local:true}];
 tasks.selected('services');time+=1000;
 assert.equal(tasks.rank(jobs)[0].id,'bank');
 jobs[1].critical=false;
 assert.equal(tasks.rank(jobs)[0].id,'services');
});

test('disappeared tasks release their claim and do not block next work',()=>{
 const tasks=createFairTasks();
 tasks.selected('production');
 assert.equal(tasks.rank([{id:'services',priority:-100}])[0].id,'services');
});
