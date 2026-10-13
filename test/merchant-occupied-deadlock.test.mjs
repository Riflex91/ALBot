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
