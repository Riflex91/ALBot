import test from 'node:test';
import assert from 'node:assert/strict';
import {Executor} from '../src/core/executor.mjs';
import {createPorts} from '../src/runtime/ports.mjs';
import {arrived,validMessage,transferable,fingerprint,chooseRule} from '../src/core/policy.mjs';
import {defaultsFor,ruleRank} from '../editor/lib/contract.mjs';
import {LIVE_DESCRIPTOR} from '../src/config/live-a.mjs';

test('jsdom is headless, unknown headless versions never become browser UI',()=>{
 assert.equal(createPorts({document:{},parent:{headless:{apiVersion:9}}}).headless,true);
 assert.equal(createPorts({document:{},parent:{caracAL:{}}}).headless,true);
 assert.equal(createPorts({parent:{headless:{apiVersion:1,capabilities:{localMessages:true},send(){},onMessage(){}}}}).ipc,true);
 assert.equal(createPorts({document:{},parent:{}}).headless,false);
});
test('resource ownership and generation reject duplicate and stale work',async()=>{
 let now=100,active=true,calls=0,resolve;const exec=new Executor({now:()=>now,active:()=>active,limit:3,onError(){}});
 const invoke=()=>{calls++;return new Promise(r=>resolve=r);};
 assert.equal(exec.run('one',['inventory'],()=>true,invoke),true);
 assert.equal(exec.run('two',['inventory'],()=>true,invoke),false);
 exec.invalidate();active=false;resolve({success:true});await Promise.resolve();exec.poll();assert.equal(exec.pending.size,0);
 assert.equal(exec.run('three',['inventory'],()=>true,invoke),false);assert.equal(calls,1);
});
test('timeout and resolved promise are not proof of a value action',async()=>{
 let now=0,state=null;const exec=new Executor({now:()=>now,active:()=>true,limit:2,onError(){}});
 exec.run('send',['inventory'],()=>true,()=>Promise.resolve({queued:true}),{timeout:1000,value:true,observe:()=>false,onSettle:s=>state=s});
 await Promise.resolve();exec.poll();assert.equal(state,null);now=1001;exec.poll();assert.equal(state,'unknown');
});
test('arrival requires map, instance and actual position, not movement return',()=>{
 const d={map:'main',in:'main',x:0,y:0,radius:10};assert.equal(arrived({...d,moving:false},d),true);
 for(const changes of [{in:'other'},{map:'cave'},{x:50},{moving:true}])assert.equal(arrived({...d,...changes},d),false);
});
test('sender identity, receiver and TTL are checked before a message acts',()=>{
 const m={protocol:'albot/1',from:'A',to:'B',session:'s',seq:1,time:100,ttl:1000,type:'offer',id:'1'};
 assert.equal(validMessage(m,'A','B',['A'],200),true);
 assert.equal(validMessage(m,'Mallory','B',['A'],200),false);assert.equal(validMessage(m,'A','B',['A'],1101),false);assert.equal(validMessage(m,'A','C',['A'],200),false);
});
test('item identity, aggregate reserves and editor priority agree',()=>{
 const rule={...defaultsFor(LIVE_DESCRIPTOR.schema.properties.items.items),action:'send',keep:80,teamReserve:10,batch:50};
 const items=[{name:'hpot1',q:70},{name:'hpot1',q:40}];assert.equal(transferable(items,0,rule),20);
 assert.equal(transferable([{...items[0],l:'l'}],0,rule),0);assert.notEqual(fingerprint(items[0]),fingerprint({...items[0],level:1}));
 const specific={...rule,character:'A',priority:-5};assert.ok(ruleRank(specific)>ruleRank(rule));assert.equal(chooseRule([rule,specific],items[0],{character:'A',role:'farmer'}),specific);
});
