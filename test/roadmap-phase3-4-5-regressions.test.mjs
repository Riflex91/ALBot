import test from 'node:test';
import assert from 'node:assert/strict';
import {createSkillWakeups} from '../src/core/skill-wakeups.mjs';
import {accountPhysicalLedger} from '../src/items/account-stock-ledger.mjs';
import {inventoryStockEvidence} from '../src/items/stock-evidence.mjs';
import {createPotionReceipts,confirmedPotionRunway,
 proactivePotionAlarm} from '../src/merchant/potion-receipts.mjs';
import {fitHeartbeat} from '../src/party/transport.mjs';

test('phase 3: registered engine deadline skips polling, wakes once and never creates timers',()=>{
 let now=1000000;const scheduler=createSkillWakeups({now:()=>now,leaseMs:750});
 assert.equal(scheduler.observe('3shot',new Date(now+500)),true);
 assert.equal(scheduler.blocked('3shot',new Date(now+500)),true);
 assert.equal(scheduler.blocked('3shot',new Date(now+250)),false,
  'changed native cooldown immediately revokes old hint');
 assert.equal(scheduler.observe('heal',now+300),true);
 now+=300;
 assert.equal(scheduler.blocked('heal',now),false);
 const state=scheduler.status();
 assert.equal(state.wakes,1);
 assert.equal(state.cooldownChecksAvoided,1);
 assert.equal(state.timersCreated,0);
 assert.equal(state.extraGameCalls,0);
});
test('phase 3: untrusted or far-future cooldowns cannot pause skill checks',()=>{
 let now=200000;const s=createSkillWakeups({now:()=>now});
 assert.equal(s.observe('heal',now+90000),false);
 assert.equal(s.blocked('heal',now+90000),false);
 assert.equal(s.observe('heal',now+10000),true);
 now+=800;
 assert.equal(s.blocked('heal',now+9200),false,
  'lease expires even if cooldown is still in the future');
});
test('phase 4: local and remote inventory, equipped gear and current-map bank are separate evidence',()=>{
 const now=20000000,owner='My_Merchant',session='merchant-a',realm='EUII';
 const peerItems=[{name:'seashell',level:0,q:9}];
 const peer={name:'My_Ranger2',session:'ranger-a',realm,
  running:true,rip:false,journal:false,inventoryBlocked:false,
  reserved:false,lifecycleChanging:false,received:now-50};
 peer.inventoryEvidence=inventoryStockEvidence(peerItems,{
  owner:peer.name,session:peer.session,realm,at:now-50});
 const bank={complete:true,owner,session,realm,at:now-30,
  map:'bank',packs:[{name:'items0'}],
  rows:[{item:{name:'seashell',level:0},quantity:30,protectedUnits:0}]};
 const result=accountPhysicalLedger({local:[{name:'seashell',level:0,q:20}],
  peers:[peer],bank,equipment:{mainhand:{name:'staff',level:4}},
  owner,session,realm,now,expected:[peer.name]});
 assert.equal(result.complete,true);
 assert.equal(result.variants.find(x=>x.item.name==='seashell').quantity,59);
 const equipped=result.variants.find(x=>x.item.name==='staff');
 assert.equal(equipped.protectedUnits,1);
 assert.equal(equipped.freeEstimate,0);
 assert.equal(result.bankScope,'verified-current-map');
 assert.equal(result.authority,'none');
 assert.equal(result.executable,false);
});
test('phase 4: wrong-session remote evidence, old bank and open transfer fail closed',()=>{
 const now=20000000,owner='My_Merchant',session='m',realm='EUII';
 const peer={name:'My_Ranger2',session:'new',realm,running:true,rip:false,
  received:now,inventoryEvidence:inventoryStockEvidence([{name:'ringsj'}],{
   owner:'My_Ranger2',session:'old',realm,at:now})};
 const bank={complete:true,owner,session,realm,at:now-300000,rows:[],packs:[]};
 const result=accountPhysicalLedger({local:[],peers:[peer],
  owner,session,realm,now,bank,journal:{kind:'receive'},
  expected:[peer.name]});
 assert.equal(result.complete,false);
 assert.equal(result.bankScope,'unverified-or-not-visible');
 assert.equal(result.transferUnresolved,true);
 assert.equal(result.variants.length,0);
});
test('phase 5: potion receipts increment only on exact confirmed-use observations',()=>{
 let at=10000;const receipts=createPotionReceipts({session:'x',realm:'EUII',now:()=>at});
 assert.equal(receipts.observe('inventory.result',{result:'confirmed'}),false);
 assert.equal(receipts.observe('potion.consumeConfirmed',{item:'hpot0'}),true);
 assert.equal(receipts.observe('potion.consumeConfirmed',{item:'elixirint0'}),false);
 at+=200;
 assert.deepEqual(receipts.heartbeat(),{session:'x',realm:'EUII',hpot0:1,mpot0:0,at:10000});
});
test('phase 5: same-session confirmed use triggers early tour only with short runway',()=>{
 const peer=(received,used,hp=20)=>({name:'My_Ranger1',
  running:true,rip:false,realm:'EUII',session:'r-1',received,
  journal:false,inventoryBlocked:false,reserved:false,
  lifecycleChanging:false,potions:{hpot0:hp,mpot0:4000},
  potionConsumption:{session:'r-1',realm:'EUII',hpot0:used,mpot0:0}});
 const t=200000;
 const result=confirmedPotionRunway(peer(t-40000,0),peer(t,5),{
  now:t,realm:'EUII',minMs:30000});
 assert.equal(result.valid,true);
 assert.equal(result.rows.hpot0.confirmedCount,5);
 assert.ok(result.rows.hpot0.remainingSeconds<180);
 const forecast=[result],farmers=[peer(t,5)];
 assert.equal(proactivePotionAlarm(forecast,farmers,{target:{hpot0:3000}}).trigger,true);
 assert.equal(proactivePotionAlarm(forecast,farmers,{target:{hpot0:0}}).trigger,false);
 assert.equal(proactivePotionAlarm(forecast,[...farmers,peer(t,5)],{target:{hpot0:3000}}).trigger,false);
});
test('phase 5: restarts, decreasing counters and bogus net-stock are never consumption receipts',()=>{
 const peer=(session,received,counter)=>({name:'My_Ranger2',session,
  realm:'EUII',running:true,rip:false,received,
  potions:{hpot0:3,mpot0:4},
  potionConsumption:{session,realm:'EUII',hpot0:counter,mpot0:0}});
 const now=1000000;
 assert.equal(confirmedPotionRunway(peer('s1',now-40000,1),
  peer('s2',now,4),{now,realm:'EUII'}).valid,false);
 assert.equal(confirmedPotionRunway(peer('s1',now-40000,4),
  peer('s1',now,1),{now,realm:'EUII'}).valid,false);
 assert.equal(confirmedPotionRunway({...peer('s1',now-40000,1),
   potionConsumption:null},peer('s1',now,4),{now,realm:'EUII'}).valid,false);
});
test('phase 5: compact potion-use evidence survives optional heartbeat trimming',()=>{
 const d={name:'My_Ranger1',items:[],materials:[],performance:{data:'x'.repeat(3000)},
  potionConsumption:{session:'s1',realm:'EUII',hpot0:3,mpot0:1}};
 const fitted=fitHeartbeat(d,400);
 assert.equal(fitted.potionConsumption.hpot0,3);
 assert.equal(fitted.performance,undefined);
});
