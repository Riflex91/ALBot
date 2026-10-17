import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {nativeSkillCooldown,createSkillWakeups} from '../src/core/skill-wakeups.mjs';
import {inventoryStockEvidence,packInventoryEvidence,
 unpackInventoryEvidence,reconcileStockEvidence} from '../src/items/stock-evidence.mjs';
import {fitHeartbeat} from '../src/party/transport.mjs';
import {accountPhysicalLedger} from '../src/items/account-stock-ledger.mjs';
import {supplyTourLeadSeconds,proactivePotionAlarm} from '../src/merchant/potion-receipts.mjs';

test('phase 3 live: native shared cooldown follows official runner even across browser realms',()=>{
 const t=Date.now(),deadline=runInNewContext('new Date('+JSON.stringify(t+360)+')');
 assert.equal(deadline instanceof Date,false);
 const p={G:{skills:{heal:{share:'attack'},'3shot':{share:'attack'},attack:{}}},
  parent:{next_skill:{attack:deadline}},c:{}};
 const native=nativeSkillCooldown(p,'3shot');
 assert.equal(native.key,'attack');
 assert.equal(native.at,t+360);
 assert.equal(native.reason,'native');
 let at=t;const hints=createSkillWakeups({now:()=>at});
 assert.equal(hints.observe('3shot',native.at,native),true);
 assert.equal(hints.blocked('3shot',native.at,native.key),true);
 assert.equal(hints.nextDelay(250),250);
 at+=150;
 assert.equal(hints.nextDelay(250),210);
 assert.equal(hints.blocked('3shot',native.at,'3shot'),false,
  'wrong native share key never suppresses the API check');
 assert.equal(hints.status().sharedResolved,1);
 assert.equal(hints.status().cooldownChecksAvoided,1);
});
test('phase 3 live: missing/native malformed and cyclic sharing fail open with diagnostics',()=>{
 const p={G:{skills:{heal:{share:'attack'},attack:{share:'heal'}}},parent:{}};
 const cyclic=nativeSkillCooldown(p,'heal');
 assert.equal(cyclic.reason,'share-cycle');
 p.G.skills.attack={};
 const missing=nativeSkillCooldown(p,'heal');
 assert.equal(missing.reason,'missing-native-deadline');
 let at=10000;const hints=createSkillWakeups({now:()=>at});
 assert.equal(hints.observe('heal',missing.at,missing),false);
 assert.equal(hints.status().missingNative,1);
 p.parent.next_skill={attack:{invalid:true}};
 const malformed=nativeSkillCooldown(p,'heal');
 assert.equal(malformed.reason,'invalid-native-format');
 assert.equal(hints.observe('heal',malformed.at,malformed),false);
 assert.equal(hints.status().invalid,1);
});
test('phase 4 live: 27 merchant variants survive bounded wire encoding without claiming stock rights',()=>{
 const time=Date.now(),realm='USI',merchant='My_Merchant',session='m1';
 const items=Array.from({length:27},(_,i)=>({name:'item_'+i,level:0,q:i+1}));
 items[25].data={gift:true,uid:'abc'};
 items[26].p=4;
 const local=inventoryStockEvidence(items,{owner:merchant,session,realm,at:time,maxRows:32,allowOpaque:true});
 assert.equal(local.complete,true);
 assert.equal(local.rows.length,27);
 assert.equal(local.rows[25].protectedUnits,26);
 assert.equal(local.rows[26].protectedUnits,27);
 const packed=packInventoryEvidence(local);
 assert.ok(JSON.stringify(packed).length<2800);
 const unwrapped=unpackInventoryEvidence(packed);
 assert.equal(unwrapped.complete,true);
 assert.deepEqual(unwrapped.rows,local.rows);
 const h={name:merchant,session,realm,received:time,running:true,rip:false,
  journal:false,reserved:false,inventoryBlocked:false,lifecycleChanging:false,
  inventoryEvidence:unwrapped};
 const a=reconcileStockEvidence({local:inventoryStockEvidence([],{
  owner:'My_Ranger1',session:'r1',realm,at:time}),
  peers:[h],owner:'My_Ranger1',session:'r1',realm,now:time,expected:[merchant]});
 assert.equal(a.complete,true);
 assert.equal(a.quantity('item_3'),4);
 assert.equal(a.quantity('item_25'),0);
});
test('phase 4 live: heartbeat sheds optional telemetry first, retains compact inventory proof',()=>{
 const t=Date.now(),local=inventoryStockEvidence(
  Array.from({length:27},(_,i)=>({name:'i'+i,q:i+1})),
  {owner:'Merchant',session:'m1',realm:'USI',at:t,maxRows:32});
 const compact=packInventoryEvidence(local);
 const data={items:[],materials:[],inventoryEvidence:compact,
  performance:{blob:'x'.repeat(8000)},advice:{blob:'x'.repeat(1000)},
  name:'Merchant',potionConsumption:{session:'m1',realm:'USI',hpot0:0,mpot0:0}};
 const limited=fitHeartbeat(data,4200);
 assert.ok(limited&&JSON.stringify(limited).length<=4200);
 assert.equal(limited.performance,undefined);
 assert.equal(limited.inventoryEvidence.c,1);
 assert.equal(unpackInventoryEvidence(limited.inventoryEvidence).rows.length,27);
});
test('phase 4 live: corrupt wire evidence cannot invent account stock',()=>{
 const proof=packInventoryEvidence(inventoryStockEvidence([{name:'ore',q:3}],
   {owner:'Merchant',session:'m1',realm:'USI',maxRows:32}));
 const tampered=structuredClone(proof);
 tampered.x[0][8]=-1;
 assert.equal(unpackInventoryEvidence(tampered),null);
 const absent=fitHeartbeat({items:[],materials:[],inventoryEvidence:proof,
  name:'Merchant',mandatory:'x'.repeat(2000)},180);
 assert.equal(absent,null,'required fields over budget must abort whole status');
});
test('phase 5 live: proof-backed tour starts early enough for serial stops and remote travel',()=>{
 const farmer=(name,map,x)=>({name,map,in:map,x,y:200,
  session:name+'-s',realm:'USI',potions:{hpot0:2000,mpot0:150},
  running:true,rip:false});
 const farmers=[farmer('My_Ranger1','main',100),
  farmer('My_Ranger2','main',200),farmer('My_Priest','cave',20)];
 const merchant={map:'main',in:'main',x:0,y:0,speed:70};
 const lead=supplyTourLeadSeconds({farmers,merchant});
 assert.ok(lead>180&&lead<=1800,'travel + supply cannot use only three minutes');
 const results=farmers.map(f=>({valid:true,owner:f.name,session:f.session,
  rows:{hpot0:{confirmedCount:0,remainingSeconds:null},
   mpot0:{confirmedCount:5,remainingSeconds:lead-2}}}));
 const early=proactivePotionAlarm(results,farmers,{target:{mpot0:3000},
  thresholdSeconds:lead});
 assert.equal(early.trigger,true);
 assert.equal(early.reason,'verified-consumption-runway');
 assert.equal(proactivePotionAlarm(results.slice(1),farmers,{
  target:{mpot0:3000},thresholdSeconds:lead}).trigger,false);
 assert.equal(proactivePotionAlarm(results,farmers,{target:{mpot0:0},
  thresholdSeconds:lead}).trigger,false);
});
