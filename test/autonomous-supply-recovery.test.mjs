import test from 'node:test';
import assert from 'node:assert/strict';
import {unchangedGatherJournal,createRecovery} from '../src/core/recovery.mjs';
import {fingerprint} from '../src/core/policy.mjs';
import {createLogistics} from '../src/items/logistics.mjs';
import {Executor} from '../src/core/executor.mjs';
import {chooseRule} from '../src/core/policy.mjs';
import {defaultsFor} from '../editor/lib/contract.mjs';
import {LIVE_DESCRIPTOR} from '../src/config/live-a.mjs';

function gatherFixture(){
 const c={name:'M',gold:4000,items:[{name:'mpot0',q:2100,level:0},null],q:{}};
 const checkpoint={durable:true};
 const journal={kind:'gather.fishing',item:'rod',cost:0,loss:0,slots:[],at:1000,
  evidence:{realm:'USIV',gold:4000,inventory:c.items.map(i=>i?fingerprint(i):null)}};
 const events=[];
 const bot={journal,inventoryBlocked:true,checkpoint,p:{c,realm:()=> 'USIV'},
  exec:{pending:new Map()},event:(name)=>events.push(name),
  endValue(result){assert.equal(result,'confirmed');this.journal=null;}};
 return {bot,c,journal,events};
}
test('unchanged gathering journal releases automatically only after expiry, no replay',()=>{
 const {bot,events}=gatherFixture();
 assert.equal(unchangedGatherJournal(bot,120999),false);
 assert.equal(unchangedGatherJournal(bot,121000),true);
 bot.me={name:'M'};bot.cfg={party:{merchant:'M'},general:{messageTtlMs:10000}};
 bot.transport={peers:new Map()};bot.report=()=>{};
 const recovery=createRecovery(bot);
 const old=Date.now;Date.now=()=>121000;
 try{assert.equal(recovery.reconcile(),true);}finally{Date.now=old;}
 assert.equal(bot.journal,null);assert.equal(bot.inventoryBlocked,false);assert.ok(events.includes('recovery.gatherUnchanged'));
});
test('gathering recovery rejects missing potions, gold changes, active skill and pending action',()=>{
 const {bot,c}=gatherFixture();c.items[0].q=2099;
 assert.equal(unchangedGatherJournal(bot,122000),false);
 c.items[0].q=2100;c.gold--;
 assert.equal(unchangedGatherJournal(bot,122000),false);
 c.gold++;c.q.fishing=true;
 assert.equal(unchangedGatherJournal(bot,122000),false);
 c.q.fishing=false;bot.exec.pending.set('gather',{});assert.equal(unchangedGatherJournal(bot,122000),false);
});
test('gathering recovery refuses mismatched realm, non-gather and transferred-item journal',()=>{
 const {bot,journal}=gatherFixture();journal.evidence.realm='EUII';
 assert.equal(unchangedGatherJournal(bot,122000),false);
 journal.evidence.realm='USIV';journal.kind='send';assert.equal(unchangedGatherJournal(bot,122000),false);
 journal.kind='gather.mining';journal.slots=[[0,'item']];assert.equal(unchangedGatherJournal(bot,122000),false);
});

function pair(){
 const cfg=defaultsFor(LIVE_DESCRIPTOR.schema),bots={},events=[],sent=[];
 cfg.items=[];cfg.merchant.enabled=true;cfg.merchant.supply=true;cfg.merchant.maxDelivery=3000;
 cfg.farming.potionCarryMax=10000;cfg.general.messageTtlMs=10000;
 for(const [name,role,q] of [['M','merchant',2100],['R','farmer',0]]){
  const c={name,map:'main',in:'main',x:0,y:0,items:[q?{name:'mpot0',level:0,q}:null,...Array(41).fill(null)]};
  const bot={cfg,me:{name,role},session:name,running:true,inventoryBlocked:false,journal:null,
   farmers:['R'],p:{c,G:{items:{mpot0:{type:'pot',gives:[['mp',200]]}}},realm:()=> 'USIV'},
   entity:n=>bots[n]?.p.c,free:()=>c.items.filter(i=>!i).length,
   rule:i=>chooseRule(cfg.items,i,{role,character:name,map:'main',server:'USIV',task:'farm'}),
   beginValue(j){assert.equal(this.journal,null);this.journal=j;},endValue(result){if(result==='confirmed')this.journal=null;else this.inventoryBlocked=true;}};
  bot.exec=new Executor({now:()=>Date.now(),active:()=>true,limit:5,onError:e=>{throw e;}});
  bot.transport={peers:new Map(),fresh:n=>({running:true,rip:false,realm:'USIV',map:'main',in:'main',x:0,y:0,session:n,items:bots[n]?.logistics?.summary()??[]}),
   send(to,type,data,id){bots[to].logistics.receive(name,{type,data,id,session:name});return Promise.resolve(true);}};
  bot.p.call=(method,to,slot,quantity)=>{
   assert.equal(method,'send_item');sent.push({to,quantity});const src=c.items[slot],dst=bots[to].p.c;
   c.items[slot]={...src,q:src.q-quantity};dst.items[0]={name:src.name,level:0,q:quantity};
   return Promise.resolve({success:true});
  };
  bots[name]=bot;bot.logistics=createLogistics(bot);
 }
 return {...bots,cfg,sent,events};
}
test('merchant supplies an empty MP-potion farmer without any manually configured item rule',()=>{
 const {M,R,sent}=pair();
 assert.equal(R.logistics.summary().find(row=>row.item==='mpot0')?.need,300);
 M.logistics.poll();M.logistics.poll();
 assert.deepEqual(sent,[{to:'R',quantity:300}]);
 assert.equal(R.p.c.items[0].q,300);
});
test('lowered potion target cancels an accepted unsent handoff without stranding the receiver journal',()=>{
 const {M,R,cfg,sent}=pair();M.logistics.poll();assert.ok(R.journal);
 cfg.merchant.mpPotionTarget=0;M.logistics.poll();
 assert.equal(sent.length,0);assert.equal(M.journal,null);assert.equal(R.journal,null);assert.equal(R.inventoryBlocked,false);
});
test('explicit keep rule blocks automatic supply, even if the farmer needs MP',()=>{
 const {M,R,cfg,sent}=pair();
 const rule=defaultsFor(LIVE_DESCRIPTOR.schema.properties.items.items);
 cfg.items=[{...rule,item:'mpot0',name:'MP-Reserve',action:'keep',role:'merchant'}];
 assert.equal(R.logistics.summary().find(row=>row.item==='mpot0')?.need,300);
 M.logistics.poll();M.logistics.poll();
 assert.equal(sent.length,0);
});

test('merchant acquisition-only potion rule does not suppress automatic MP delivery',()=>{
 const {M,R,cfg,sent}=pair();
 const rule=defaultsFor(LIVE_DESCRIPTOR.schema.properties.items.items);
 cfg.items=[{...rule,item:'mpot0',name:'Merchant-Nachkauf mpot0',action:'buy',role:'merchant',targetCount:5000}];
 assert.equal(R.logistics.summary().find(row=>row.item==='mpot0')?.need,300);
 M.logistics.poll();M.logistics.poll();
 assert.deepEqual(sent,[{to:'R',quantity:300}], 'automatically resupply while keeping the merchant buy rule');
});
