import test from 'node:test';
import assert from 'node:assert/strict';
import {createLogistics} from '../src/items/logistics.mjs';
import {Executor} from '../src/core/executor.mjs';
import {chooseRule} from '../src/core/policy.mjs';
import {defaultsFor} from '../editor/lib/contract.mjs';
import {LIVE_DESCRIPTOR} from '../src/config/live-a.mjs';
function pair(){
 const cfg=defaultsFor(LIVE_DESCRIPTOR.schema),r=defaultsFor(LIVE_DESCRIPTOR.schema.properties.items.items);let sends=0;
 cfg.items=[{...r,role:'merchant',action:'send',recipient:'B',keep:90,batch:10},{...r,role:'farmer',action:'consume',targetCount:10}];
 const bots={};for(const [name,role] of [['A','merchant'],['B','farmer']]){
  const c={name,map:'main',in:'main',x:0,y:0,items:[{name:'hpot1',q:name==='A'?100:1},...Array(41).fill(null)]};
  const bot={cfg,me:{name,role},session:name,running:true,inventoryBlocked:false,journal:null,p:{c,realm:()=> 'EUII'},free:()=>41,entity:n=>bots[n]?.p.c,rule:i=>chooseRule(cfg.items,i,{character:name,role}),reason:'',beginValue(j){assert.equal(this.journal,null);this.journal=j;},endValue(s){if(s==='confirmed')this.journal=null;else this.inventoryBlocked=true;}};
  bot.exec=new Executor({now:()=>Date.now(),active:()=>true,limit:4,onError(){}});
  bot.transport={peers:new Map(),fresh:n=>({running:true,rip:false,realm:'EUII',map:'main',in:'main',x:0,y:0,session:n}),send(to,type,data,id){bots[to].logistics.receive(name,{type,data,id,session:name});return Promise.resolve(true);}};
  bot.p.call=(method,to,slot,quantity)=>{assert.equal(method,'send_item');sends++;c.items[slot].q-=quantity;bots[to].p.c.items[0].q+=quantity;return Promise.resolve({success:true});};
  bots[name]=bot;bot.logistics=createLogistics(bot);
 }
 return {...bots,sends:()=>sends};
}
test('transfer needs receiver acceptance and observed inventory on both sides; no duplicate send',async()=>{
 const {A,B,sends}=pair();A.logistics.poll();assert.equal(sends(),0);assert.equal(B.journal.kind,'receive');
 A.logistics.poll();assert.equal(sends(),1);assert.equal(A.p.c.items[0].q,91);assert.equal(B.p.c.items[0].q,10);
 B.logistics.poll();A.logistics.poll();await Promise.resolve();A.exec.poll();
 assert.equal(A.journal,null);assert.equal(B.journal,null);assert.equal(A.inventoryBlocked,false);
 A.logistics.poll();B.logistics.poll();assert.equal(sends(),1);
});
test('slot substitution after acceptance never sends the replacement item',()=>{
 const {A,sends}=pair();A.logistics.poll();A.p.c.items[0]={name:'sword',level:9};A.logistics.poll();assert.equal(sends(),0);
});
