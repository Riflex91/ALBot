import test from 'node:test';
import assert from 'node:assert/strict';
import {createMerchant} from '../src/merchant/controller.mjs';
import {createProduction} from '../src/production/production.mjs';
import {gearSlotPriority} from '../src/production/gear.mjs';

function merchantFixture({location='main',sale=true,bank=true}={}){
 const items=Array.from({length:42},(_,slot)=>({name:slot===0?'sale':slot===1?'bank':'protected',level:0,q:slot===0?20:1}));
 const events=[],calls=[];
 const bot={
  p:{c:{name:'M',items,map:location},read:()=>null,G:{items:{}}},
  cfg:{merchant:{enabled:true,minFreeSlots:4,bankWorkspace:2,taskHoldMs:30000,
    starvationMs:120000},party:{merchant:'M'},production:{enabled:true}},
  me:{name:'M',role:'merchant'},running:true,inventoryBlocked:false,
  journal:null,recovering:false,reason:'',free:()=>items.filter(x=>!x).length,
  movement:{order:null},logistics:{reserved:false},gold:{reserved:false},
  exec:{busy:()=>false},event:(type,info)=>events.push({type,...info}),
  economy:{
   safe:x=>!!x,remaining:()=>true,
   rules:x=>x.name==='sale'&&sale?{action:'sell',batch:100,minPrice:0}:
     x.name==='bank'&&bank?{action:'bank',batch:100}:null,
   spare:(slot,r)=>r?.action==='bank'||r?.action==='sell'?(items[slot]?.q??0):0,
   value:()=>10,
   npcSell:(slot)=>{calls.push('sell:'+slot);return true;}
  },
  bank:{
   pending:false,consolidateInventory:()=>false,consolidate:()=>false,
   store:(slot)=>{calls.push('bank:'+slot);return true;}
  }
 };
 return {bot,items,calls,events};
}
test('full merchant on main performs verified sale before starting bank travel',()=>{
 const f=merchantFixture();
 const m=createMerchant(f.bot);m.tick();
 assert.deepEqual(f.calls,['sell:0']);
 assert.equal(f.bot.free(),0,'no direct inventory mutation in planner');
});
test('when physically at bank the merchant deposits a whole allowed stack first',()=>{
 const f=merchantFixture({location:'bank'});
 createMerchant(f.bot).tick();
 assert.deepEqual(f.calls,['bank:1']);
});
test('fully protected inventory blocks futile exchange scheduling and emits diagnosis',()=>{
 const f=merchantFixture({sale:false,bank:false});
 let exchanges=0;f.bot.production={exchange:()=>{exchanges++;return true;}};
 const m=createMerchant(f.bot);m.tick();
 assert.equal(exchanges,0);
 assert.equal(f.calls.length,0);
 assert.equal(f.events.some(e=>e.type==='merchant.inventoryPressure'&&e.free===0),true);
});
test('production goals and derived rules are reentrancy-safe within the same decision epoch',()=>{
 let goals=0,rules=0;
 const bot={
  decisionEpoch:100,
  p:{c:{items:[],slots:{}},read:()=>null},
  me:{name:'M',role:'merchant'},
  cfg:{production:{autonomy:true,enabled:true,goals:[],gearTargets:[]},
    items:[],merchant:{fishing:false,mining:false},party:{merchant:'M'}},
  economy:{},
  transport:{fresh:()=>null},
  allocation:{rules:()=>[]}
 };
 bot.gear={goals:()=>{goals++;bot.production.effectiveRules();return [];}};
 bot.intelligence={profitGoals:()=>[],rules:()=>{rules++;bot.production.effectiveRules();return [];}};
 bot.production=createProduction(bot);
 assert.deepEqual(bot.production.effectiveRules(),[]);
 assert.equal(goals,1);
 assert.equal(rules,1);
 bot.production.effectiveRules();
 assert.equal(goals,1);assert.equal(rules,1,'cached within same epoch');
 bot.decisionEpoch=101;
 bot.production.effectiveRules();
 assert.equal(goals,2);assert.equal(rules,2);
});
test('gear priority favors class weapons, then armor, then jewelry',()=>{
 assert.ok(gearSlotPriority('mainhand','mage')>gearSlotPriority('chest','mage'));
 assert.ok(gearSlotPriority('chest','ranger')>gearSlotPriority('ring1','ranger'));
 assert.equal(gearSlotPriority('mainhand','merchant'),12);
});

test('bank workspace margin does not preempt NPC work while above reserve',()=>{
 const f=merchantFixture({location:'main',sale:false,bank:true});
 for(let slot=36;slot<42;slot++)f.items[slot]=null; // 6 free, reserve 4
 let routed=false;
 f.bot.logistics.travel=()=>{routed=true;f.bot.movement.order={owner:'logistics'};};
 createMerchant(f.bot).tick();
 assert.equal(routed,true,'normal work resumes when above absolute reserve');
 assert.deepEqual(f.calls,[],'must not immediately return to bank for optional workspace');
});

test('merchant at 39/42 occupied slots executes its safely guarded exchange plan',()=>{
 const f=merchantFixture({sale:false,bank:false});
 for(let i=39;i<42;i++)f.items[i]=null; // log: 3 real free slots, configured reserve 4
 let attempted=0;
 f.bot.production={
  status:()=>({steps:[{kind:'exchange',item:'anniversarygift',quantity:221}]}),
  tick:()=>{attempted++;f.calls.push('production.exchange');return true;}
 };
 createMerchant(f.bot).tick();
 assert.equal(f.bot.free(),3);
 assert.equal(attempted,1,'minFreeSlots is not a veto when output physically fits');
 assert.deepEqual(f.calls,['production.exchange']);
 assert.equal(f.events.some(e=>e.type==='merchant.inventoryPressureProgress'&&
  e.kind==='exchange'&&e.free===3),true);
});
test('merchant below reserve rejects unsafe farm and pickup despite 3 physical slots',()=>{
 const f=merchantFixture({sale:false,bank:false});
 for(let i=39;i<42;i++)f.items[i]=null;
 let farms=0,pickups=0;
 f.bot.production={status:()=>({steps:[{kind:'farm',item:'blocked'}]}),
  tick:()=>{farms++;return true;}};
 f.bot.logistics.travel=()=>{pickups++;f.bot.movement.order={owner:'logistics'};};
 createMerchant(f.bot).tick();
 assert.equal(farms,0,'no uncontrolled acquisition is authorized by pressure fallback');
 assert.equal(pickups,0,'pickup still needs configured reserve');
});
test('with no physical free slot merchant still does not initiate a remote exchange',()=>{
 const f=merchantFixture({sale:false,bank:false});
 let exchanges=0;
 f.bot.production={status:()=>({steps:[{kind:'exchange',item:'anniversarygift'}]}),
  tick:()=>{exchanges++;return true;}};
 createMerchant(f.bot).tick();
 assert.equal(exchanges,0);
});

test('full Merchant parks reversible gear at the bank instead of idling without sale rules',()=>{
 const f=merchantFixture({sale:false,bank:false});
 f.bot.cfg.production.autoDisposition=true;
 f.bot.cfg.merchant.bank=true;
 f.bot.bank.park=slot=>{if(slot!==2)return false;f.calls.push('park:2');return true;};
 createMerchant(f.bot).tick();
 assert.deepEqual(f.calls,['park:2']);
 assert.equal(f.bot.free(),0,'planning never invents a confirmed released slot');
});

test('capacity recovery continues past the four-slot reserve until a working margin exists',()=>{
 const f=merchantFixture({sale:false,bank:false});
 f.bot.cfg.production.autoDisposition=true;
 f.bot.cfg.merchant.bank=true;
 let parked=0;
 f.bot.bank.park=()=>{parked++;return true;};
 const merchant=createMerchant(f.bot);
 merchant.tick();assert.equal(parked,1);
 for(let i=38;i<42;i++)f.items[i]=null;
 merchant.tick();
 assert.equal(parked,2,'the controller must not abandon recovery at exactly four free slots');
 for(let i=34;i<38;i++)f.items[i]=null;
 // With eight free slots, the recovery flag is cleared.
 f.bot.logistics.travel=()=>{f.bot.movement.order={owner:'logistics'};return true;};
 merchant.tick();
 assert.equal(parked,2);
});

test('unrecoverable full inventory reports an explicit safe-capacity blocker',()=>{
 const f=merchantFixture({sale:false,bank:false});
 f.bot.cfg.production.autoDisposition=true;
 f.bot.cfg.merchant.bank=true;
 f.bot.bank.park=()=>false;
 createMerchant(f.bot).tick();
 assert.ok(f.events.some(e=>e.type==='merchant.inventoryPressure'&&
  e.code==='NO_SAFE_CAPACITY'&&e.free===0));
});

test('under inventory pressure the admitted upgrade NPC route is resumed before another bank trip',()=>{
 const f=merchantFixture({sale:false,bank:false});
 for(let i=39;i<42;i++)f.items[i]=null;
 f.bot.cfg.production.enabled=true;
 f.bot.cfg.merchant.bank=true;
 f.bot.logistics.travel=()=>{};
 let attempts=0;
 f.bot.production={status:()=>({steps:[{kind:'upgrade',item:'poker',level:3}]}),
  tick:()=>{
   attempts++;
   if(attempts===1){f.bot.movement.order={owner:'economy',dest:{map:'main',x:-207,y:-220}};return true;}
   f.bot.journal={kind:'upgrade'};return true;
  }};
 const merchant=createMerchant(f.bot);
 merchant.tick();assert.equal(attempts,1);
 assert.equal(merchant.status().productionContinuation.item,'poker');
 f.bot.movement.order=null;
 merchant.tick();
 assert.equal(attempts,2,'upgrade must be attempted after NPC arrival');
 assert.equal(f.calls.filter(x=>x.startsWith('bank:')).length,0);
 assert.equal(merchant.status().productionContinuation,null);
});

test('an exhausted recovery at seven free slots releases team pressure but retains diagnosis',()=>{
 const f=merchantFixture({sale:false,bank:false});
 for(let i=35;i<42;i++)f.items[i]=null;
 f.bot.logistics.travel=()=>{f.bot.movement.order={owner:'logistics'};};
 const merchant=createMerchant(f.bot);
 // Enter recovery with 3 free slots first.
 for(let i=35;i<39;i++)f.items[i]={name:'protected',level:0,q:1};
 merchant.tick();assert.equal(merchant.status().capacityRecovery,true);
 for(let i=35;i<39;i++)f.items[i]=null;
 merchant.tick();
 assert.equal(merchant.status().capacityRecovery,false,'farm must not be frozen at 7 free');
 assert.equal(merchant.status().capacityState,'SAFE_MARGIN_BLOCKED');
 assert.equal(merchant.status().capacityBlock.requiredFree,8);
 assert.equal(merchant.status().capacityBlock.reason,'NO_ACTIONABLE_CAPACITY');
});

test('actionable finished gear is routed before speculative bank cleanup',()=>{
 const f=merchantFixture({sale:false,bank:false});
 for(let i=35;i<42;i++)f.items[i]=null;
 for(let i=35;i<39;i++)f.items[i]={name:'protected',level:0,q:1};
 let deliveries=0;
 f.bot.logistics.actionableGearDelivery=()=>true;
 f.bot.logistics.travel=()=>{deliveries++;f.bot.movement.order={owner:'logistics'};};
 const merchant=createMerchant(f.bot);
 merchant.tick();assert.equal(merchant.status().capacityRecovery,true);
 for(let i=35;i<39;i++)f.items[i]=null;
 merchant.tick();
 assert.equal(deliveries,1,'an allocated gear handoff should be prioritized');
 assert.deepEqual(f.calls,[],'no speculative bank or sale transfer');
});
