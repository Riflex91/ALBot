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
  bot.transport={peers:new Map(),fresh:n=>({running:true,rip:false,realm:'EUII',map:'main',in:'main',x:0,y:0,session:n,items:bots[n]?.logistics?.summary()??[]}),send(to,type,data,id){bots[to].logistics.receive(name,{type,data,id,session:name});return Promise.resolve(true);}};
  bot.p.call=(method,to,slot,quantity)=>{assert.equal(method,'send_item');sends++;const source={...c.items[slot]},have=c.items[slot].q??1,receiver=bots[to].p.c;c.items[slot]=have===quantity?null:{...c.items[slot],q:have-quantity};let dst=receiver.items.findIndex(i=>i&&i.name===source.name&&(i.level??0)===(source.level??0)&&(i.stat_type??'')===(source.stat_type??'')&&(i.p??'')===(source.p??'')&&(i.title??'')===(source.title??''));if(dst<0){dst=receiver.items.findIndex(i=>!i);receiver.items[dst]={...source,q:0};}receiver.items[dst].q=(receiver.items[dst].q??0)+quantity;return Promise.resolve({success:true});};
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

test('merchant skips stocked item and supplies the item the peer actually needs',()=>{
 const {A,B,sends}=pair(),r=defaultsFor(LIVE_DESCRIPTOR.schema.properties.items.items);
 A.cfg.items=[
  {...r,name:'HP senden',item:'hpot0',role:'merchant',action:'send',recipient:'B',keep:90,targetCount:100,maxCount:500,batch:10},
  {...r,name:'MP senden',item:'mpot0',role:'merchant',action:'send',recipient:'B',keep:90,targetCount:100,maxCount:500,batch:10},
  {...r,name:'HP Bedarf',item:'hpot0',role:'farmer',action:'consume',targetCount:100,maxCount:200,batch:10},
  {...r,name:'MP Bedarf',item:'mpot0',role:'farmer',action:'consume',targetCount:100,maxCount:200,batch:10}
 ];
 A.p.c.items[0]={name:'hpot0',q:200};A.p.c.items[1]={name:'mpot0',q:200};
 B.p.c.items[0]={name:'hpot0',q:100};B.p.c.items[1]={name:'mpot0',q:20};
 A.logistics.poll();A.logistics.poll();
 assert.equal(sends(),1);assert.equal(A.p.c.items[0].q,200);assert.equal(A.p.c.items[1].q,190);assert.equal(B.p.c.items[0].q,100);assert.equal(B.p.c.items[1].q,30);
 assert.equal(A.logistics.stats().offersSent,1);assert.equal(A.logistics.stats().sendsStarted,1);
});


function supplyTeam(){
 let clock=1000;const cfg=defaultsFor(LIVE_DESCRIPTOR.schema),r=defaultsFor(LIVE_DESCRIPTOR.schema.properties.items.items),sends=[];
 cfg.merchant.maxDelivery=3000;
 cfg.items=[
  ...['B','C','D'].map(recipient=>({...r,name:'HP an '+recipient,item:'hpot0',role:'merchant',action:'send',recipient,keep:100,targetCount:100,maxCount:100000,batch:3000})),
  {...r,name:'HP Bedarf',item:'hpot0',role:'farmer',action:'consume',keep:0,targetCount:3050,requestBelow:50,maxCount:10000,batch:3000}
 ];
 const bots={};
 for(const [name,role,quantity] of [['A','merchant',10000],['B','farmer',51],['C','farmer',50],['D','farmer',0]]){
  const items=[...(quantity?[{name:'hpot0',q:quantity}]:[]),...Array(quantity?41:42).fill(null)];
  const c={name,map:'main',in:'main',x:0,y:0,items};
  const bot={cfg,me:{name,role},session:name,running:true,inventoryBlocked:false,journal:null,p:{c,realm:()=> 'EUII'},free:()=>c.items.filter(i=>!i).length,entity:n=>bots[n]?.p.c,rule:i=>chooseRule(cfg.items,i,{character:name,role}),reason:'',beginValue(j){assert.equal(this.journal,null);this.journal=j;},endValue(state){if(state==='confirmed')this.journal=null;else this.inventoryBlocked=true;}};
  bot.exec=new Executor({now:()=>clock,active:()=>true,limit:4,onError(){}});
  bot.transport={peers:new Map(),fresh:n=>({running:true,rip:false,realm:'EUII',map:'main',in:'main',x:0,y:0,session:n,items:bots[n]?.logistics?.summary()??[]}),send(to,type,data,id){bots[to].logistics.receive(name,{type,data,id,session:name});return Promise.resolve(true);}};
  bot.p.call=(method,to,slot,amount)=>{assert.equal(method,'send_item');sends.push({to,item:c.items[slot].name,amount});const source={...c.items[slot]},have=c.items[slot].q??1,receiver=bots[to].p.c;c.items[slot]=have===amount?null:{...c.items[slot],q:have-amount};let dst=receiver.items.findIndex(i=>i&&i.name===source.name);if(dst<0){dst=receiver.items.findIndex(i=>!i);receiver.items[dst]={...source,q:0};}receiver.items[dst].q=(receiver.items[dst].q??0)+amount;return Promise.resolve({success:true});};
  bots[name]=bot;bot.logistics=createLogistics(bot);
 }
 return {...bots,sends,advance(ms){clock+=ms;}};
}
async function finishDelivery(sender,receiver,advance){
 sender.logistics.poll();sender.logistics.poll();receiver.logistics.poll();sender.logistics.poll();await Promise.resolve();sender.exec.poll();advance(300);
}
test('multi-recipient potion supply waits until 50 and then sends 3000 to each farmer',async()=>{
 const {A,B,C,D,sends,advance}=supplyTeam();
 assert.equal(B.logistics.summary().find(x=>x.item==='hpot0').need,0);
 assert.equal(C.logistics.summary().find(x=>x.item==='hpot0').need,3000);
 assert.equal(D.logistics.summary().find(x=>x.item==='hpot0').need,3050);
 await finishDelivery(A,C,advance);assert.deepEqual(sends[0],{to:'C',item:'hpot0',amount:3000});assert.equal(C.p.c.items[0].q,3050);
 await finishDelivery(A,D,advance);assert.deepEqual(sends[1],{to:'D',item:'hpot0',amount:3000});assert.equal(D.p.c.items[0].q,3000);
 assert.equal(sends.some(x=>x.to==='B'),false);
 B.p.c.items[0].q=50;
 await finishDelivery(A,B,advance);assert.deepEqual(sends[2],{to:'B',item:'hpot0',amount:3000});assert.equal(B.p.c.items[0].q,3050);
});
