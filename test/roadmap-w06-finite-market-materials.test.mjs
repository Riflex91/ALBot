import test from 'node:test';
import assert from 'node:assert/strict';
import {createMarket} from '../src/merchant/market.mjs';
import {planProduction} from '../src/production/planner.mjs';

function fixture({offerQuantity=8}={}){
 const c={name:'M',map:'main',in:'main',x:0,y:0,gold:5000,
  items:Array(10).fill(null),slots:{}};
 const seller={id:'S',name:'Seller',type:'character',stand:true,
  map:'main',in:'main',x:100,y:0,slots:{trade2:{
   name:'raremat',level:0,q:offerQuantity,rid:'RID-001',price:10}}};
 const calls=[],jobs=[];
 let held=0,authorized=true;
 const p={c,G:{items:{raremat:{type:'material',s:9999}}},entities:{S:seller},read:()=>null,write:()=>true,call:
  (name,who,slot,quantity)=>{
   calls.push({name,who,slot,quantity});
   c.items[0]={name:'raremat',level:0,q:quantity};
   c.gold-=10*quantity;
   return Promise.resolve({});
  }};
 const bot={p,cfg:{merchant:{marketHistory:false,marketMinSamples:3,
  marketHistoryTtlMs:21600000,position:{enabled:false},minFreeSlots:2},
  general:{testLogging:true}},me:{name:'M'},running:true,
  event:()=>{},free:()=>10,
  entity:id=>p.entities[id],movement:{order:null},exec:{}};
 bot.economy={count:()=>held,value:()=>3,
  perform:(kind,job)=>{jobs.push({kind,job});return true;},
  destination:()=>null,npcAt:()=>false};
 const market=createMarket(bot),item={name:'raremat',level:0};
 const rule={enabled:true,item:'raremat',action:'marketBuy',
  priceSource:'fixed',maxPrice:100,batch:8,targetCount:20,maxCount:20};
 return {bot,p,c,seller,calls,jobs,item,rule,market,
  setHeld:x=>{held=x;},setAuthorized:x=>{authorized=x;},
  scope:n=>({quantity:n,admit:()=>authorized})};
}

test('W06 planner produces bounded market route for item without NPC, recipe or drop source',()=>{
 const G={items:{raremat:{type:'material',g:10}},
  monsters:{},drops:{},craft:{}};
 const plan=planProduction({G,item:'raremat',quantity:2,
  level:0,stock:()=>0,bank:()=>0,canBuy:()=>false,
  allowed:['market'],permit:()=>true});
 assert.deepEqual([...plan],[{kind:'marketBuy',item:'raremat',
  level:0,quantity:2}]);
 assert.deepEqual(plan.reservations,[]);
});
test('W06 finite production buys at most remaining material requirement, not entire rule batch',async()=>{
 const f=fixture();
 assert.equal(f.market.buy(f.item,f.rule,f.scope(2)),true);
 assert.equal(f.jobs.length,1);
 assert.equal(f.jobs[0].kind,'market.buy');
 assert.equal(f.jobs[0].job.details.quantity,2);
 assert.equal(f.jobs[0].job.cost,20);
 assert.equal(f.jobs[0].job.details.source,'finite-production-plan');
 assert.equal(f.jobs[0].job.guard(),true);
 assert.equal(f.jobs[0].job.observe(),false);
 await f.jobs[0].job.call();
 assert.deepEqual(f.calls.map(x=>x.quantity),[2]);
 f.setHeld(2);
 assert.equal(f.jobs[0].job.observe(),true);
 assert.equal(f.c.gold,4980);
});
test('W06 late revised production authority invalidates prepared trade before dispatch',()=>{
 const f=fixture(),scope=f.scope(3);
 assert.equal(f.market.buy(f.item,f.rule,scope),true);
 const job=f.jobs[0].job;
 assert.equal(job.guard(),true);
 f.setAuthorized(false);
 assert.equal(job.guard(),false);
 assert.equal(f.market.buy(f.item,f.rule,scope),false);
 assert.equal(f.calls.length,0);
});
test('W06 malformed or unbounded material request cannot authorize a market buy',()=>{
 for(const q of [0,-1,1.3,'4',null,1000001,NaN]){
  const f=fixture();
  assert.equal(f.market.buy(f.item,f.rule,f.scope(q)),false,String(q));
  assert.equal(f.jobs.length,0);
  assert.equal(f.calls.length,0);
 }
 const g=fixture();
 assert.equal(g.market.buy(g.item,g.rule,{quantity:1}),false);
});
test('W06 a returned promise alone never settles material receipt without exact gold and stock',async()=>{
 const f=fixture(),jobHolder=f.jobs;
 f.market.buy(f.item,f.rule,f.scope(2));
 const job=jobHolder[0].job;
 // Stub remote call to return success without physical change.
 f.p.call=()=>Promise.resolve({});
 await job.call();
 assert.equal(job.observe(),false);
 f.setHeld(2);
 assert.equal(job.observe(),false,'stock alone with no gold debit');
 f.setHeld(0);f.c.gold-=20;
 assert.equal(job.observe(),false,'gold alone with no stock');
 f.setHeld(2);
 assert.equal(job.observe(),true,'both exact deltas with successful server response');
});
test('W06 a failed official server response cannot be laundered by inventory changes',async()=>{
 const f=fixture();
 f.market.buy(f.item,f.rule,f.scope(2));
 const job=f.jobs[0].job;
 f.p.call=()=>Promise.resolve({failed:true});
 await job.call();
 f.setHeld(2);f.c.gold-=20;
 assert.equal(job.observe(),false);
});
test('W06 original explicit marketBuy behavior is not silently converted into finite production request',()=>{
 const f=fixture();
 assert.equal(f.market.buy(f.item,f.rule),true);
 assert.equal(f.jobs[0].job.details.quantity,8);
 assert.equal(f.jobs[0].job.details.source,'explicit-market-rule');
});
test('W06 true offer quantity and renewed seller RID remain dispatch authority',()=>{
 const f=fixture({offerQuantity:1});
 assert.equal(f.market.buy(f.item,f.rule,f.scope(3)),true);
 assert.equal(f.jobs[0].job.details.quantity,1);
 f.seller.slots.trade2.rid='another';
 assert.equal(f.jobs[0].job.guard(),false);
});

test('W06 exact physical return capacity is required despite a misleading free-slot counter',()=>{
 const f=fixture();
 f.p.G.items.raremat.s=2;
 f.c.isize=10;
 for(let n=0;n<10;n++)f.c.items[n]={name:'filler'+n};
 f.c.items[0]={name:'raremat',level:0,q:1};
 assert.equal(f.market.buy(f.item,f.rule,f.scope(3)),false,
  'only one remaining stack unit; free() hint must not authorize three');
 assert.equal(f.jobs.length,0);
 f.c.items[9]=null;
 assert.equal(f.market.buy(f.item,f.rule,f.scope(3)),true,
  'one real free two-unit slot and one-unit stack headroom can fit three');
 assert.equal(f.jobs.length,1);
 f.c.items[9]={name:'new-filler'};
 assert.equal(f.jobs[0].job.guard(),false,'capacity loss invalidates dispatch');
});

test('W06 finite procurement ignores base-matching offers with different account or data variants',()=>{
 for(const mutate of [
  offer=>{offer.acc='other-account';},
  offer=>{offer.data={boundTo:'another-owner'};},
  offer=>{offer.l='locked';},
  offer=>{offer.locked=true;}
 ]){
  const f=fixture();
  mutate(f.seller.slots.trade2);
  assert.equal(f.market.hasVisibleBuyOffer(f.item,{strict:true}),false);
  assert.equal(f.market.hasVisibleBuyOffer(f.item),true,
   'explicit market discovery retains its existing broader variant view');
  assert.equal(f.market.buy(f.item,f.rule,f.scope(2)),false);
  assert.equal(f.jobs.length,0,'a mismatched offer never becomes an admitted purchase');
  assert.equal(f.calls.length,0);
 }
});
test('W06 finite purchase revalidates material variant immediately before dispatch',()=>{
 for(const mutate of [
  offer=>{offer.acc='different';},
  offer=>{offer.data={origin:'unverified'};},
  offer=>{offer.bound=true;}
 ]){
  const f=fixture();
  assert.equal(f.market.buy(f.item,f.rule,f.scope(2)),true);
  assert.equal(f.jobs.length,1);
  assert.equal(f.jobs[0].job.guard(),true);
  mutate(f.seller.slots.trade2);
  assert.equal(f.jobs[0].job.guard(),false,
   'an offer changed after scheduling does not authorize gold spending');
  assert.equal(f.calls.length,0);
 }
});
test('W06 stricter material variant check does not alter explicitly configured marketBuy rules',()=>{
 const f=fixture();
 f.seller.slots.trade2.acc='different';
 assert.equal(f.market.buy(f.item,f.rule),true,
  'legacy explicitly configured market rule retains its existing selection');
 assert.equal(f.jobs.length,1);
 assert.equal(f.jobs[0].job.guard(),true);
});

test('W06 finite market never rounds malformed seller quantities into authorized purchases',()=>{
 for(const quantity of [0,-1,1.5,NaN,Number.MAX_SAFE_INTEGER+1]){
  const f=fixture({offerQuantity:quantity});
  assert.equal(f.market.hasVisibleBuyOffer(f.item,{strict:true}),false,
   'invalid listing quantity must not wake blocked production');
  assert.equal(f.market.buy(f.item,f.rule,f.scope(2)),false);
  assert.equal(f.jobs.length,0);
  assert.equal(f.calls.length,0);
 }
});
test('W06 finite market requires integer unit and total gold exposure',()=>{
 for(const [unitPrice,quantity] of [
  [10.5,2],[0.25,2],[Number.MAX_SAFE_INTEGER+1,1],
  [Number.MAX_SAFE_INTEGER,2]
 ]){
  const f=fixture({offerQuantity:quantity});
  f.rule.maxPrice=Number.MAX_SAFE_INTEGER+2;
  f.seller.slots.trade2.price=unitPrice;
  assert.equal(f.market.buy(f.item,f.rule,f.scope(quantity)),false,
   'invalid unit or total cost is never sent to the value executor');
  assert.equal(f.jobs.length,0);
  assert.equal(f.calls.length,0);
 }
});
test('W06 finite trade requires the same item baseline at delayed dispatch',()=>{
 const f=fixture();
 assert.equal(f.market.buy(f.item,f.rule,f.scope(2)),true);
 const job=f.jobs[0].job;
 assert.equal(job.guard(),true);
 f.setHeld(1);
 assert.equal(job.guard(),false,'outside inventory changes invalidate prior purchase receipt baseline');
 assert.equal(f.calls.length,0);
 f.setHeld(0);
 assert.equal(job.guard(),true,'an unchanged valid baseline remains eligible');
});
test('W06 finite dispatch rejects seller quantity or price drift to malformed values',()=>{
 for(const change of [
  f=>{f.seller.slots.trade2.q=2.5;},
  f=>{f.seller.slots.trade2.price=10.5;}
 ]){
  const f=fixture();
  assert.equal(f.market.buy(f.item,f.rule,f.scope(2)),true);
  const job=f.jobs[0].job;
  assert.equal(job.guard(),true);
  change(f);
  assert.equal(job.guard(),false);
  assert.equal(f.calls.length,0);
 }
});
test('W06 explicit standalone market buy retains legacy offer-quantity behavior',()=>{
 const f=fixture({offerQuantity:1.5});
 assert.equal(f.market.buy(f.item,f.rule),true);
 assert.equal(f.jobs[0].job.details.quantity,1);
 assert.equal(f.jobs[0].job.guard(),true);
});
