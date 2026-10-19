import test from 'node:test';
import assert from 'node:assert/strict';
import {createLogistics,deliveryRouteDecision,receiptBackedPickupOrder} from '../src/items/logistics.mjs';
import {Executor} from '../src/core/executor.mjs';
import {chooseRule,identity} from '../src/core/policy.mjs';
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
test('urgent nearby supply restores a gathering tool before advertising a transfer',()=>{
 const {A,sends}=pair();let restored=0;A.services={active:true,waiting:false,interrupt(){},restore(){restored++;this.active=false;return true;}};A.transport.peers.set('B',{});
 A.logistics.poll();assert.equal(restored,1);assert.equal(A.logistics.stats().offersSent,0);assert.equal(sends(),0);A.logistics.poll();A.logistics.poll();assert.equal(sends(),1);
});
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

test('empty recipient advertises requested upgrade level and rejects another variant',()=>{
 const {A,B,sends}=pair(),r=defaultsFor(LIVE_DESCRIPTOR.schema.properties.items.items);
 A.cfg.items=[{...r,item:'helmet',role:'merchant',action:'send',recipient:'B',minLevel:0,maxLevel:1,keep:0,batch:1},{...r,item:'helmet',role:'farmer',action:'keep',minLevel:1,maxLevel:1,targetCount:1,maxCount:1}];
 A.p.c.items[0]={name:'helmet',level:0};B.p.c.items[0]=null;
 const demand=B.logistics.summary()[0];assert.equal(demand.variant.level,1);assert.equal(demand.need,1);
 A.logistics.poll();assert.equal(A.logistics.stats().offersSent,0);
 A.p.c.items[0].level=1;A.logistics.poll();A.logistics.poll();assert.equal(sends(),1);assert.equal(B.p.c.items[0].level,1);
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


test('offer retries after temporary receiver inventory busy and transfers exactly once',async()=>{
 const {A,B,sends}=pair();let now=1000;A.exec.now=()=>now;B.exec.now=()=>now;let release;
 assert.equal(B.exec.run('temporary.inventory',['inventory'],()=>true,()=>new Promise(r=>{release=r;}),{timeout:5000}),true);
 A.logistics.poll();assert.equal(A.logistics.stats().offersSent,1);assert.equal(B.logistics.stats().offersReceived,1);assert.equal(B.logistics.stats().acceptsSent,0);assert.equal(sends(),0);
 release();await Promise.resolve();B.exec.poll();now+=2500;
 A.logistics.poll();assert.equal(B.logistics.stats().offersReceived,2);assert.equal(B.logistics.stats().acceptsSent,1);assert.equal(sends(),1);
 B.logistics.poll();A.logistics.poll();await Promise.resolve();A.exec.poll();
 assert.equal(A.logistics.stats().sendsStarted,1);assert.equal(A.logistics.stats().timeouts,0);assert.equal(A.inventoryBlocked,false);
});

test('first offer carries gear promise before receiver opens its value journal',()=>{const {A,B,sends}=pair();const promise={slot:'mainhand',expected:'empty',expires:Date.now()+10000};let accepted=false;A.allocation={offer:()=>promise,reserve:j=>j.gearAck==='empty',guard:()=>true};B.allocation={accept:(id,from,session,item,g)=>{assert.equal(g.slot,'mainhand');assert.equal(B.journal,null);accepted=true;return true;}};A.logistics.poll();assert.equal(accepted,true);A.logistics.poll();assert.equal(sends(),1);B.logistics.poll();A.logistics.poll();assert.equal(B.journal,null);assert.equal(A.journal,null);});

test('ordinary pickup cannot repeatedly divert merchant from a town restock route',()=>{const {A,B}=pair();A.p.c.x=1000;A.rule=()=>({...defaultsFor(LIVE_DESCRIPTOR.schema.properties.items.items),action:'keep',targetCount:200,maxCount:200});let stopped=0;A.movement={order:{owner:'economy',dest:{map:'main',x:-35,y:-162}},stop(){stopped++;this.order=null;},go(){assert.fail('Restock route must not be diverted for ordinary pickup');}};A.transport.peers.set('B',{});const fresh=A.transport.fresh;A.transport.fresh=n=>({...fresh(n),items:[{item:'hpot1',variant:{name:'hpot1',level:0,stat_type:'',p:'',title:''},to:'A',surplus:10,need:0}]});A.logistics.travel();assert.equal(stopped,0);assert.equal(A.movement.order.owner,'economy');});


test('gold reservation prevents new item offers, item acceptance and logistics travel',()=>{const {A,B,sends}=pair();A.gold={reserved:true};A.logistics.poll();assert.equal(A.logistics.stats().offersSent,0);assert.equal(B.journal,null);A.transport.peers.set('B',{});A.movement={go(){assert.fail('Gold rendezvous must not travel');}};A.logistics.travel();A.gold.reserved=false;B.gold={reserved:true};A.logistics.poll();assert.equal(A.logistics.stats().offersSent,1);assert.equal(B.journal,null);assert.equal(sends(),0);});


test('item transfer timeout tolerates reentrant cleanup without null job access or duplicate send',()=>{const {A,B}=pair();let now=Date.now();A.exec.now=B.exec.now=()=>now;A.p.call=()=>new Promise(()=>{});A.logistics.poll();A.logistics.poll();A.endValue=()=>{A.inventoryBlocked=true;A.logistics.close();};now+=20000;assert.doesNotThrow(()=>A.logistics.poll());assert.equal(A.inventoryBlocked,true);assert.ok(A.journal);assert.equal(A.logistics.handoffActive,false);});

test('verified gear promise initiates delivery even without receiver inventory demand',()=>{
 const {A,B,sends}=pair();
 B.p.c.items[0].q=10;
 const promise={slot:'mainhand',expected:'empty',expires:Date.now()+10000};
 A.allocation={offer:()=>promise,reserve:j=>j.gearAck==='empty',guard:()=>true};
 B.allocation={accept:()=>true};
 assert.equal(B.logistics.summary()[0].need,0);
 A.logistics.poll();
 assert.equal(A.logistics.stats().offersSent,1);
 assert.equal(B.journal?.kind,'receive');
 A.logistics.poll();
 assert.equal(sends(),1);
 B.logistics.poll();A.logistics.poll();
 assert.equal(A.inventoryBlocked,false);
});
test('merchant can travel for validated gear promise without receiver item-demand row',()=>{
 const {A,B}=pair();B.p.c.items[0].q=10;A.p.c.x=800;
 let destination=null;
 A.allocation={offer:()=>({slot:'mainhand',expected:'empty',expires:Date.now()+10000})};
 A.transport.peers.set('B',{});
 A.movement={order:null,go:(dest,owner)=>{destination={dest,owner};}};
 A.logistics.travel();
 assert.equal(destination?.owner,'logistics');
 assert.equal(destination?.dest?.name,undefined);
});
test('merchant never sends unsolicited goods when neither demand nor validated gear promise exists',()=>{
 const {A,B}=pair();B.p.c.items[0].q=10;
 A.logistics.poll();
 assert.equal(A.logistics.stats().offersSent,0);
});

test('authenticated farmer elixir request is actionable supply even with no item-demand row',()=>{
 const {A,B,sends}=pair(),r=defaultsFor(LIVE_DESCRIPTOR.schema.properties.items.items);
 A.cfg.items=[{...r,name:'Deliver dex elixir',item:'elixirdex0',role:'merchant',action:'send',
  recipient:'B',keep:0,teamReserve:0,batch:1,maxCount:100,enabled:true}];
 A.p.c.items[0]={name:'elixirdex0',level:0};
 B.p.c.items[0]=null;
 B.elixirs={request:()=>({item:'elixirdex0',quantity:1})};
 const fresh=A.transport.fresh;
 A.transport.fresh=n=>({...fresh(n),elixir:{item:'elixirdex0',quantity:1}});
 assert.equal(B.logistics.summary().length,0);
 A.logistics.poll();
 assert.equal(A.logistics.stats().offersSent,1);
 assert.equal(B.journal?.kind,'receive');
 A.logistics.poll();
 assert.equal(sends(),1);
 assert.equal(B.p.c.items.some(i=>i?.name==='elixirdex0'),true);
 B.logistics.poll();A.logistics.poll();
 assert.equal(B.inventoryBlocked,false);
});
test('courier replaces obsolete map and kite coordinates using fresh recipient heartbeat',()=>{
 const prior={owner:'logistics',dest:{name:'B',map:'main',in:'main',x:20,y:20}};
 const here={map:'main',in:'main',x:1000,y:0};
 const fresh={name:'B',running:true,rip:false,realm:'EUII',map:'main',in:'main',x:500,y:100};
 assert.equal(deliveryRouteDecision(prior,fresh,here),'retarget');
 assert.equal(deliveryRouteDecision(prior,{...fresh,x:23,y:21},here),'keep');
 assert.equal(deliveryRouteDecision(prior,{...fresh,map:'forest',in:'forest'},here),'retarget');
 assert.equal(deliveryRouteDecision(prior,{...fresh,map:'main',x:1002,y:4},here),'arrived');
 assert.equal(deliveryRouteDecision(prior,null,here),'cancel');
});
test('merchant actually stops old smart route and heads to recipient new map',()=>{
 const {A,B}=pair(),r=defaultsFor(LIVE_DESCRIPTOR.schema.properties.items.items);
 A.cfg.items=[{...r,name:'Deliver',item:'elixirdex0',role:'merchant',action:'send',recipient:'B',keep:0,teamReserve:0,batch:1,maxCount:100,enabled:true}];
 A.p.c.items[0]={name:'elixirdex0',level:0};A.p.c.x=900;
 A.transport.peers.set('B',{});
 const fresh=A.transport.fresh;
 A.transport.fresh=n=>({...fresh(n),name:n,map:'forest',in:'forest',x:250,y:400,elixir:{item:'elixirdex0',quantity:1}});
 let stops=0,rerouted=null;
 A.strategy={canVisit:()=>true};
 A.movement={order:{owner:'logistics',dest:{name:'B',map:'main',in:'main',x:0,y:0}},stop(){stops++;this.order=null;},
  go(dest,owner){rerouted={dest,owner};this.order={owner,dest};return true;}};
 A.logistics.travel();
 assert.equal(stops,1);
 assert.equal(rerouted?.owner,'logistics');
 assert.equal(rerouted.dest.map,'forest');
 assert.equal(rerouted.dest.x,250);
});

function fullMerchantOfferFixture(){
 const f=pair(),r=defaultsFor(LIVE_DESCRIPTOR.schema.properties.items.items);
 f.A.me.role='farmer';f.B.me.role='merchant';
 f.A.cfg.party.merchant='B';f.A.cfg.merchant.enabled=true;
 f.A.cfg.merchant.pickup=true;f.A.cfg.merchant.maxDelivery=3000;
 f.A.cfg.items=[{...r,name:'Abgabe',item:'hpot1',role:'farmer',
  enabled:true,action:'send',recipient:'B',keep:0,teamReserve:0,batch:10}];
 f.A.p.G={items:{hpot1:{type:'material',s:9999}}};
 f.B.p.G={items:{hpot1:{type:'material',s:9999}}};
 f.B.p.c.items=[{name:'hpot1',q:9998},...Array(41).fill({name:'other'})];
 f.B.free=()=>f.B.p.c.items.filter(i=>!i).length;
 f.B.merchant={status:()=>({capacityRecovery:true})};
 const originalFresh=f.A.transport.fresh;
 f.A.transport.fresh=n=>({...originalFresh(n),free:0});
 return f;
}
test('sender asks full Merchant about matching stack headroom and sends only acknowledged one',()=>{
 const f=fullMerchantOfferFixture();
 f.A.logistics.poll();
 assert.equal(f.A.logistics.stats().offersSent,1);
 assert.equal(f.B.journal?.quantity,1,'receive admission caps 9998/9999 at one');
 f.A.logistics.poll();
 assert.equal(f.sends(),1);
 assert.equal(f.B.p.c.items[0].q,9999);
 assert.equal(f.A.p.c.items[0].q,99);
});
test('sender inquiry at full Merchant with incompatible stacks cannot trigger value dispatch',()=>{
 const f=fullMerchantOfferFixture();
 f.B.p.c.items[0]={name:'ringsj'};
 f.A.logistics.poll();
 assert.equal(f.A.logistics.stats().offersSent,1,'a bounded offer is harmless');
 assert.equal(f.B.journal,null,'no physical room and no accept');
 f.A.logistics.poll();
 assert.equal(f.sends(),0);
});


function carrierPair({merchantItems=2,farmerCarrier=null,farmerFree=40}={}){
 const {A,B,sends}=pair();
 const cfg=A.cfg;
 cfg.items=[];
 cfg.party.merchant='A';cfg.farming.freeSlots=4;
 cfg.merchant.supply=true;cfg.merchant.enabled=true;
 cfg.merchant.pickup=true;cfg.merchant.maxDelivery=100;
 A.p.G={items:{tracker:{type:'tracker'},supercomputer:{type:'computer'}}};
 B.p.G=A.p.G;
 A.farmers=['B'];
 A.p.c.items=Array.from({length:42},(_,idx)=>
  idx<merchantItems?{name:'tracker',level:0}:null);
 B.p.c.items=Array.from({length:42},(_,idx)=>
  idx<42-farmerFree?{name:'gem0',level:0}:null);
 if(farmerCarrier)B.p.c.items[0]={name:farmerCarrier,level:0};
 const parentFresh=A.transport.fresh;
 A.transport.fresh=name=>{
  const result=parentFresh(name);
  return {...result,free:B.p.c.items.filter(i=>!i).length,
   achievementCarrier:farmerCarrier,inventoryBlocked:false,journal:false};
 };
 return {A,B,sends};
}
test('Merchant sends exactly one spare Tracktrix to Farmer with verified missing carrier',()=>{
 const {A,B,sends}=carrierPair();
 assert.equal(B.logistics.summary().find(x=>x.item==='tracker')?.need,1);
 A.logistics.poll();
 assert.equal(B.journal?.kind,'receive');
 A.logistics.poll();
 assert.equal(sends(),1);
 assert.equal(A.p.c.items.filter(i=>i?.name==='tracker').length,1);
 assert.equal(B.p.c.items.filter(i=>i?.name==='tracker').length,1);
 B.logistics.poll();A.logistics.poll();
 assert.equal(A.logistics.stats().sendsStarted,1);
});
test('Merchant keeps its only Tracker without Super Computer, even if Farmer needs one',()=>{
 const {A,B,sends}=carrierPair({merchantItems:1});
 A.logistics.poll();A.logistics.poll();
 assert.equal(sends(),0);
 assert.equal(A.p.c.items.filter(i=>i?.name==='tracker').length,1);
 assert.equal(B.logistics.summary().find(x=>x.item==='tracker')?.need,1);
});
test('Farmer with Super Computer or unknown carrier cannot trigger speculative Tracker transfer',()=>{
 for(const carrier of ['supercomputer','unknown','tracker']){
  const {A,sends}=carrierPair({farmerCarrier:carrier});
  A.logistics.poll();A.logistics.poll();
  assert.equal(sends(),0,'carrier '+carrier);
 }
});
test('automatic Tracker transfer requires verified Farmer workspace and permitted session',()=>{
 for(const free of [0,1,4]){
  const {A,B,sends}=carrierPair({farmerFree:free});
  assert.equal(B.logistics.summary().find(x=>x.item==='tracker')?.need??0,0);
  A.logistics.poll();A.logistics.poll();
  assert.equal(sends(),0,'free: '+free);
 }
});
test('explicit Merchant keep rule overrides implicit Tracktrix distribution',()=>{
 const {A,sends}=carrierPair();
 A.cfg.items=[{enabled:true,name:'No Tracker transfer',role:'merchant',
  item:'tracker',action:'keep',minLevel:0,maxLevel:99,character:'',
  server:'',map:'',task:'',statType:'',property:'',title:'',priority:100}];
 // Merchant transport is mocked without economy.explicit; include the
 // real explicit rule checker to cover the full merchant integration.
 A.economy={explicit:i=>A.cfg.items.find(r=>r.item===i.name)};
 A.logistics.poll();A.logistics.poll();
 assert.equal(sends(),0);
});

test('W10/W13 receipt priority only reorders matching current uncommitted own loot',()=>{
 const items=[{name:'ordinary',level:0},{name:'gem0',level:0},
  {name:'ring',level:0,l:'s'},{name:'gem0',level:1}];
 const hint={evidence:'own-physical-receipt-confirmed',
  state:'read-only-demand-match',dispatchAuthorized:false,
  variantIdentity:identity(items[1]),observedUnits:1,currentUnits:1,
  uncommittedEstimate:1};
 assert.deepEqual(receiptBackedPickupOrder(items,[hint],{
  role:'farmer',merchant:'M',pickup:true}),[1,0,2,3]);
 assert.deepEqual(receiptBackedPickupOrder(items,[hint],{
  role:'merchant',merchant:'M',pickup:true}),[0,1,2,3]);
 assert.deepEqual(receiptBackedPickupOrder(items,[hint],{
  role:'farmer',merchant:'M',pickup:false}),[0,1,2,3]);
 assert.deepEqual(receiptBackedPickupOrder(items,[hint],{
  role:'farmer',merchant:'',pickup:true}),[0,1,2,3]);
});
test('W13 no physical receipt, invalid scope or zero free estimate never changes priority',()=>{
 const items=[{name:'ordinary'},{name:'gem0'}];
 const baseline={variantIdentity:identity(items[1]),observedUnits:1,
  currentUnits:1,uncommittedEstimate:1,dispatchAuthorized:false,
  evidence:'own-physical-receipt-confirmed',state:'read-only-demand-match'};
 for(const edit of [
  r=>{r.evidence='server-attributed-unverified';},
  r=>{r.state='reservation-unverified';},
  r=>{r.dispatchAuthorized=true;},
  r=>{r.observedUnits=0;},
  r=>{r.uncommittedEstimate=0;},
  r=>{r.uncommittedEstimate=null;},
  r=>{r.variantIdentity=identity({name:'other'});},
  r=>{r.variantIdentity='';}
 ]){
  const row={...baseline};edit(row);
  assert.deepEqual(receiptBackedPickupOrder(items,[row],{
   role:'farmer',merchant:'M',pickup:true}),[0,1]);
 }
});
test('W13 duplicate diagnostic rows never create more physical priority credit',()=>{
 const items=[{name:'ordinary'},{name:'gem0'},{name:'gem0'},
  {name:'gem0'}],entry={variantIdentity:identity(items[1]),
  observedUnits:1,currentUnits:3,uncommittedEstimate:3,
  dispatchAuthorized:false,evidence:'own-physical-receipt-confirmed',
  state:'read-only-demand-match'};
 assert.deepEqual(receiptBackedPickupOrder(items,[entry,entry],{
  role:'farmer',merchant:'M',pickup:true}),[1,0,2,3]);
});
function receiptPickupPair(){
 const {A,B,sends}=pair();
 const r=defaultsFor(LIVE_DESCRIPTOR.schema.properties.items.items);
 A.me.role='farmer';B.me.role='merchant';
 A.cfg.party.merchant='B';A.cfg.merchant.pickup=true;
 A.cfg.merchant.maxDelivery=100;
 A.cfg.items=[
  {...r,enabled:true,item:'ordinary',role:'farmer',action:'send',
   recipient:'B',keep:0,teamReserve:0,batch:1},
  {...r,enabled:true,item:'gem0',role:'farmer',action:'send',
   recipient:'B',keep:0,teamReserve:0,batch:1}
 ];
 A.p.G={items:{ordinary:{type:'material'},
  gem0:{type:'material'}}};
 B.p.G=A.p.G;
 A.p.c.items[0]={name:'ordinary',level:0};
 A.p.c.items[1]={name:'gem0',level:0};
 B.p.c.items[0]=null;
 A.lootReceipts={status:()=>({purposeHints:[{
  variantIdentity:identity(A.p.c.items[1]),observedUnits:1,
  currentUnits:1,uncommittedEstimate:1,
  evidence:'own-physical-receipt-confirmed',
  state:'read-only-demand-match',dispatchAuthorized:false}]})};
 return {A,B,sends};
}
test('W10/W13 confirmed loot gets first existing authorized item handoff, with normal receipt',async()=>{
 const f=receiptPickupPair();
 f.A.logistics.poll();
 assert.equal(f.A.logistics.stats().offersSent,1);
 assert.equal(f.sends(),0);
 f.A.logistics.poll();
 assert.equal(f.sends(),1);
 assert.equal(f.B.p.c.items.some(i=>i?.name==='gem0'),true);
 assert.equal(f.A.p.c.items[0].name,'ordinary');
 f.B.logistics.poll();f.A.logistics.poll();await Promise.resolve();
 f.A.exec.poll();
 assert.equal(f.A.journal,null);
 assert.equal(f.B.journal,null);
});
test('W13 receipt cannot bypass existing sendRule or gross reservation',()=>{
 const f=receiptPickupPair();
 f.A.cfg.items=f.A.cfg.items.map(x=>x.item==='gem0'?{...x,action:'keep',recipient:''}:x);
 f.A.logistics.poll();
 assert.equal(f.A.logistics.stats().offersSent,1,
  'only separately permitted ordinary item can be offered');
 f.A.logistics.poll();
 assert.equal(f.B.p.c.items.some(i=>i?.name==='ordinary'),true);
 assert.equal(f.A.p.c.items[1].name,'gem0');
 const g=receiptPickupPair();
 g.A.production={reservedQuantity:i=>i.name==='gem0'?1:0,
  canRecordDelivery:()=>true,matchesOutput:()=>true};
 g.A.logistics.poll();g.A.logistics.poll();
 assert.equal(g.B.p.c.items.some(i=>i?.name==='ordinary'),true);
 assert.equal(g.A.p.c.items[1].name,'gem0');
});
