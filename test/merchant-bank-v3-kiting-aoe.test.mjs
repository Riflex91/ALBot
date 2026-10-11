import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecovery} from '../src/core/recovery.mjs';
import {createBank} from '../src/merchant/bank.mjs';
import {createCombatNavigation} from '../src/combat/navigation.mjs';
import {fingerprint} from '../src/core/policy.mjs';
import {createSkills} from '../src/combat/skills.mjs';

function legacySwapFixture(){
 const oldSource={name:'beewings',q:10},oldBank={name:'beewings',q:11};
 const evidence={realm:'EUII',gold:1000,inventory:[fingerprint(oldSource),null]};
 const journal={kind:'bank.store',item:'beewings',quantity:10,pack:'items0',
  sourceSlot:0,bankSlot:18,bankTargetBefore:fingerprint(oldBank),bankTargetQuantity:11,
  slots:[[0,fingerprint(oldSource)]],evidence,at:123};
 const bank=Array(42).fill(null);bank[18]=structuredClone(oldSource);
 const c={name:'M',map:'bank',in:'bank',gold:1000,items:[structuredClone(oldBank),null],bank:{items0:bank}};
 const events=[],bot={p:{c,realm:()=> 'EUII'},me:{name:'M'},cfg:{party:{merchant:'M'},general:{messageTtlMs:10000}},
   journal,inventoryBlocked:true,transport:{peers:new Map()},
   event:(name,data)=>events.push({name,data}),endValue(state){if(state==='confirmed'){this.journal=null;this.inventoryBlocked=false;}}};
 return {bot,c,events,journal,oldSource,oldBank};
}
test('real beewings 10/11 bank-store swap is auto-reconciled only with exact two-slot evidence',()=>{
 const f=legacySwapFixture();
 assert.equal(createRecovery(f.bot).reconcile(),true);
 assert.equal(f.bot.journal,null);
 assert.equal(f.bot.inventoryBlocked,false);
 assert.equal(f.events[0]?.name,'recovery.bankStoreVerified');
 assert.equal(f.events[0]?.data.outcome,'swapped');
});
test('unobserved or altered bank slot never clears the merchant inventory checkpoint',()=>{
 for(const change of [
  f=>{delete f.c.bank;},
  f=>{f.c.bank.items0[18]={name:'beewings',q:9};},
  f=>{f.c.items[1]={name:'other'};},
  f=>{f.c.gold=999;},
  f=>{f.bot.journal.bankTargetBefore='not-original';}
 ]){
  const f=legacySwapFixture();change(f);
  assert.equal(createRecovery(f.bot).reconcile(),false);
  assert.equal(f.bot.inventoryBlocked,true);
  assert.ok(f.bot.journal);
 }
});
test('a new bank.store never addresses an occupied compatible stack',()=>{
 const old={name:'beewings',q:11},out={name:'beewings',q:10};
 let destination=null;
 const bank=Array(42).fill(null);bank[18]=old;
 const c={name:'M',map:'bank',in:'bank',items:[out],bank:{items0:bank}};
 const bot={p:{c,G:{items:{beewings:{s:true}},bank_packs:{items0:['bank',0]}},root:{},parent:{},read:()=>null,call:(key,...args)=>{if(key==='bank_store')destination=args[2];return null;}},me:{name:'M'},
  cfg:{party:{merchant:'M'},merchant:{bank:true,minFreeSlots:4,bankWorkspace:2,bankBudget:0}},
  journal:null,inventoryBlocked:false,logistics:{reserved:false},
  economy:{safe:()=>true,explicit:()=>null,spare:()=>10,travel:()=>true,count:()=>10,
   perform:(kind,job)=>{assert.equal(kind,'bank.store');assert.equal(job.guard(),true);job.call();return true;}}};
 assert.equal(createBank(bot).store(0,{action:'bank'}),true);
 assert.notEqual(destination,18);
 assert.equal(destination,0);
});

function positioning({blocked=false,ctype='ranger',owner='Ranger'}={}){
 const c={name:'Ranger',ctype,map:'main',in:'main',x:0,y:0,range:150,speed:40};
 const t={id:'mob',type:'monster',mtype:'bee',map:'main',in:'main',x:50,y:0,hp:100,target:owner};
 const moves=[];
 const bot={p:{c,G:{monsters:{bee:{range:25,aggro:1}}},call:(name,x,y)=>name==='can_move_to'?!blocked||x>=-1:true},
  cfg:{farming:{kiting:true}},teamNames:['Ranger','Ally'],me:{name:'Ranger'},
  monsters:()=>[t],teamPlan:null,event:()=>{},
  movement:{order:null,stop(){this.order=null;},local(x,y,who){moves.push({x,y,who});this.order={owner:who};}}};
 return {bot,c,t,moves,navigation:createCombatNavigation(bot)};
}
test('v3 ranged kiting creates an outward preemptive step before receiving damage',()=>{
 const f=positioning();
 assert.equal(f.navigation.rangePosition(f.t),true);
 assert.equal(f.moves.length,1);
 assert.equal(f.moves[0].who,'kite');
 assert.ok(f.moves[0].x<0);
 assert.ok(Math.hypot(f.moves[0].x-f.t.x,f.moves[0].y-f.t.y)>50);
 assert.equal(f.navigation.rangePosition(f.t),false);
});
test('v3 orbit picks reachable tangent when radial step is blocked',()=>{
 const f=positioning({blocked:true});
 assert.equal(f.navigation.rangePosition(f.t),true);
 assert.equal(f.moves.length,1);
 assert.ok(f.moves[0].x>=-1);
 assert.ok(Math.abs(f.moves[0].y)>1);
});
test('support ranger does not wander from shared fight and melee rogue is never ranged-kited',()=>{
 const friend=positioning({owner:'Ally'});
 assert.equal(friend.navigation.rangePosition(friend.t),false);
 const rogue=positioning({ctype:'rogue'});
 assert.equal(rogue.navigation.rangePosition(rogue.t),false);
});
test('eligible 3shot uses all available mana instead of requiring 35-percent MP reserve',()=>{
 const c={name:'Ranger',ctype:'ranger',level:60,map:'main',in:'main',x:0,y:0,range:145,mp:320,max_mp:1000,attack:50,hp:1000,max_hp:1000,slots:{},s:{}};
 const mobs=[0,1].map(i=>({id:'bee-'+i,type:'monster',mtype:'bee',map:'main',in:'main',x:30+i*5,y:0,hp:400,max_hp:400,target:'Ranger'}));
 const casts=[];
 const bot={p:{c,parent:{is_pvp:false},G:{items:{},skills:{'3shot':{class:['ranger'],level:60,mp:300,range:145,hostile:true}},monsters:{bee:{}},maps:{main:{}}},call:(action,...args)=>{if(action==='is_on_cooldown')return false;if(action==='use_skill')casts.push({skill:args[0],targets:args[1]});}},
 cfg:{general:{testLogging:true},farming:{pvp:false,maxAggro:5},party:{aoe:true,aoeMaxTargets:5},skills:[]},
 teamNames:['Ranger'],monsters:()=>mobs,entity:id=>mobs.find(m=>m.id===id),allowed:m=>!!m&&m.target==='Ranger',
 exec:{run:(_key,_locks,guard,invoke)=>{if(!guard())return false;invoke();return true;}},
 allies:()=>[],count:()=>0,event:()=>{}};
 createSkills(bot).rotation(mobs[0]);
 assert.deepEqual(casts.map(x=>x.skill),['3shot']);
 assert.equal(casts[0].targets.length,2);
});
