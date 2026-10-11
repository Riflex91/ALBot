import test from 'node:test';
import assert from 'node:assert/strict';
import {pickupCleanupCandidates} from '../src/merchant/pickup-capacity.mjs';
import {createMerchant} from '../src/merchant/controller.mjs';
import {peerReadyForHandoff,confirmedHandoffCooldown} from '../src/items/handoff-coordinator.mjs';
import {createGoldLogistics} from '../src/items/gold.mjs';
import {createEconomicIntelligence} from '../src/production/intelligence.mjs';

test('pickup can bank a full derived stack while preserving protected/manual/production reserves',()=>{
 const items=[{name:'bankable',q:13},{name:'manual',q:12},
  {name:'reserved',q:11},{name:'no-auto',q:11},{name:'locked',q:1,l:true}];
 const rules=i=>({action:'bank',keep:10,teamReserve:0,batch:100,item:i.name,
  _autoDisposition:i.name!=='no-auto'});
 const spare=(slot,r)=>Math.max(0,Math.min(items[slot].q,r.batch,items[slot].q-r.keep));
 const allow=i=>!['manual','reserved'].includes(i.name);
 const {bank,sell}=pickupCleanupCandidates(items,rules,spare,i=>!i.l,allow);
 assert.deepEqual(bank.map(x=>x.slot),[0]);
 assert.equal(bank[0].rule.keep,0);
 assert.equal(bank[0].adjusted,true);
 assert.equal(items[0].q,13,'preflight never mutates local items');
 assert.deepEqual(sell,[]);
});
test('merchant prepares then verifies the entire auto bank stack before departing',()=>{
 const c={name:'M',map:'main',items:[{name:'mat',level:0,q:13},
  ...Array.from({length:37},()=>({name:'locked',l:true})),...Array(4).fill(null)]};
 const actions=[],cfg={party:{merchant:'M'},merchant:{enabled:true,pickup:true,bank:true,
  minFreeSlots:4,taskHoldMs:30000,starvationMs:120000}};
 const bot={p:{c,G:{items:{mat:{type:'material'}}}},cfg,
  me:{name:'M',role:'merchant'},running:true,inventoryBlocked:false,journal:null,
  free:()=>c.items.filter(i=>!i).length,exec:{busy:()=>false},
  logistics:{reserved:false},gold:{reserved:false},movement:{order:null},
  bank:{pending:false,consolidateInventory:()=>false,store:(slot,r)=>{
   assert.equal(r.keep,0);assert.equal(r.batch>=13,true);
   actions.push(['bank',slot]);c.items[slot]=null;return true;}},
  economy:{safe:i=>!!i&&!i.l,explicit:()=>null,remaining:()=>true,
   rules:i=>i.name==='mat'?{item:'mat',action:'bank',keep:10,batch:100,teamReserve:0,
    _autoDisposition:true}:{action:'keep'},
   spare:(slot,r)=>Math.max(0,Math.min(c.items[slot]?.q??0,r.batch,
    (c.items[slot]?.q??0)-r.keep-r.teamReserve))},
  event(){}};
 const merchant=createMerchant(bot),peer={name:'F',items:[{item:'mat',to:'M',surplus:2,
  variant:{name:'mat',level:0,stat_type:'',p:'',title:''}}]};
 assert.equal(bot.free(),4);
 assert.equal(merchant.preparePickup(peer),false);
 assert.equal(merchant.status().pickup.state,'banking');
 assert.deepEqual(actions,[['bank',0]]);
 assert.equal(bot.free(),5);
 assert.equal(merchant.preparePickup(peer),true);
 assert.equal(merchant.status().pickup.state,'ready');
});
test('handoff readiness excludes busy journals and gold/item conflicts but not combat actions',()=>{
 const peer={running:true,rip:false,free:3,journal:false,reserved:false,
  inventoryBlocked:false,goldTransferPending:false,pending:9};
 assert.equal(peerReadyForHandoff(peer,{requiresSlot:true}),true);
 for(const k of ['journal','reserved','inventoryBlocked','goldTransferPending']){
  assert.equal(peerReadyForHandoff({...peer,[k]:true}),false,k);
 }
 assert.equal(peerReadyForHandoff({...peer,free:0},{requiresSlot:true}),false);
 assert.equal(confirmedHandoffCooldown(10000),1666);
 assert.ok(confirmedHandoffCooldown(60000)<=2000);
});

test('confirmed consecutive gold blocks can start within two seconds without bypassing receipts',()=>{
 const old=Date.now;let now=1000000;Date.now=()=>now;
 try{
  const messages=[],data=new Map(),c={name:'F',gold:250000,map:'main',in:'main',x:0,y:0,q:{},items:[]};
  const cfg={party:{merchant:'M'},merchant:{enabled:true,collectGold:true,
   goldReserve:0,goldCollectBelow:1,goldTransferMax:100000},
   characters:[{name:'F',enabled:true,role:'farmer'},{name:'M',enabled:true,role:'merchant'}],
   general:{messageTtlMs:10000}};
  const peer={name:'M',running:true,rip:false,realm:'USIV',session:'merchant-session',
   map:'main',in:'main',x:5,y:0,reserved:false,goldTransferPending:false,
   journal:false,inventoryBlocked:false};
  const bot={p:{c,realm:()=> 'USIV',read:k=>data.get(k),
   write:(k,v)=>{data.set(k,v);return true;},
   call:(name,to,quantity)=>{if(name==='send_gold'){c.gold-=quantity;return true;}}},
   cfg,me:{name:'F',role:'farmer',goldReserve:0},session:'farmer-session',
   running:true,inventoryBlocked:false,journal:null,
   logistics:{reserved:false},bank:{pending:false},services:{active:false},
   checkpoint:{durable:true},entity:()=>peer,
   transport:{fresh:()=>peer,send:(to,type,data,id)=>{messages.push({to,type,data,id});return Promise.resolve(true);}},
   exec:{busy:()=>false,run:(name,res,guard,call)=>guard()&&call()},
   event(){},report(){},beginValue(j){this.journal=j;},
   endValue(result){assert.equal(result,'confirmed');this.journal=null;}};
  const gold=createGoldLogistics(bot);
  gold.poll(true);
  const offer=messages.find(m=>m.type==='goldOffer');
  assert.equal(offer.data.quantity,100000);
  gold.receive('M',{type:'goldAccept',id:offer.id,session:peer.session,data:{quantity:100000}});
  gold.poll(true);
  assert.equal(bot.journal?.kind,'gold.send');
  assert.equal(c.gold,150000);
  gold.receive('M',{type:'goldReceipt',id:offer.id,session:peer.session,data:{quantity:100000}});
  gold.poll(true);
  assert.equal(bot.journal,null,'the previous block must be verified and closed');
  assert.equal(messages.filter(m=>m.type==='goldDone').length,1);
  now+=1000;gold.poll(true);
  assert.equal(messages.filter(m=>m.type==='goldOffer').length,1,'cooldown still active');
  now+=700;gold.poll(true);
  assert.equal(messages.filter(m=>m.type==='goldOffer').length,2,
   'a second idempotently journaled transfer can be offered without the old 15-second gap');
 }finally{Date.now=old;}
});
function makeEconomic(){
 const i={name:'unwanted',level:0},c={name:'M',ctype:'merchant',level:50,
  items:[i,...Array(41).fill(null)],slots:{},map:'main'};
 const G={version:1,items:{unwanted:{type:'weapon',wtype:'dagger',upgrade:true,grades:[10,20]},
  scroll0:{g:200},commodity:{type:'material',g:500}},
  classes:{merchant:{mainhand:{},offhand:{},doublehand:{}}},
  upgrades:[[null,.1,.1,.1]],craft:{}};
 const cfg={party:{merchant:'M'},merchant:{bank:true,pickup:true},
  characters:[{name:'M',enabled:true,gearRole:'auto'}],
  general:{planningTickMs:1000},production:{autoDisposition:true,enabled:true,
   upgrade:true,compound:true,autonomy:true,autoGearMaxLevel:2,autoProfitMaxLevel:2,
   minChance:.5,minImprovement:0,helperMaxPrice:1000,lossBudget:10000,
   autoSellMaxValue:100,gearTargets:[]}};
 const bot={p:{c,G,realm:()=> 'USIV',call:(name)=>name==='item_grade'?0:null},cfg,
  me:{name:'M',role:'merchant'},teamNames:['M'],
  transport:{peers:new Map(),fresh:()=>null},
  economy:{safe:i=>!!i&&!i.l&&!i.b,explicit:()=>null,value:()=>500},
  production:{reservedQuantity:()=>0},gear:{snapshot:()=>({class:'merchant',
   level:50,slots:{}}),profile:()=>null},count:()=>1};
 return {bot,i,G,c,cfg};
}
test('unusable unprofitable expensive upgrade is automatically sold after economic screening',()=>{
 const {bot,i}=makeEconomic(),intel=createEconomicIntelligence(bot);
 assert.equal(intel.gearUse(i).state,'no-gear-use');
 assert.equal(intel.mutationEconomics(i).action,'sell');
 const r=intel.disposition(i);
 assert.equal(r?.action,'sell');
 assert.equal(r?._autoDisposition,true);
 assert.equal(r?.minPrice,500);
});
test('unknown progression odds and protected items cannot become automatic liquidation',()=>{
 const a=makeEconomic();delete a.G.upgrades;
 assert.equal(createEconomicIntelligence(a.bot).disposition(a.i)?.action,'bank');
 const b=makeEconomic();b.i.l=true;
 assert.equal(createEconomicIntelligence(b.bot).disposition(b.i),null);
});
test('ordinary non-crafting commodity above old value ceiling is automatically market/NPC sellable',()=>{
 const {bot,c}=makeEconomic();c.items[0]={name:'commodity',level:0};
 const rule=createEconomicIntelligence(bot).disposition(c.items[0]);
 assert.equal(rule?.action,'sell');
 assert.equal(rule?.minPrice,500);
});
