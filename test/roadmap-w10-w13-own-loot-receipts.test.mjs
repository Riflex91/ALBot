import test from 'node:test';
import assert from 'node:assert/strict';
import {ownChestShare,createOwnLootReceipts,lootPurposeEvidence} from '../src/items/loot-receipts.mjs';
import {createPorts} from '../src/runtime/ports.mjs';
import {fitHeartbeat} from '../src/party/transport.mjs';

function fixture(){
 let at=100000,realm='EUI',callCount=0;
 const items=[{name:'sword',level:0},null,null];
 const chests={X:{x:5,y:5,items:2,map:'main',in:'main'}};
 const events=[];
 const p={c:{name:'Priest',map:'main',in:'main',gold:100,
  items},G:{items:{sword:{},ring:{},hpot0:{s:9999},gem0:{}}},
  parent:{chests},realm:()=>realm};
 const bot={p,me:{name:'Priest',role:'farmer'},session:'session1',
  running:true,journal:null,inventoryBlocked:false,bank:{pending:false},
  logistics:{reserved:false},event:(...a)=>events.push(a)};
 const receipts=createOwnLootReceipts(bot,{now:()=>at});
 return {bot,p,items,chests,events,receipts,
  advance:ms=>{at+=ms;},setRealm:value=>{realm=value;},setGold:x=>{p.c.gold=x;}};
}
const chest=(items,gold=5,more={})=>({
 id:'X',opener:'Priest',gold,
 items:items.map(i=>({name:i.name,level:i.level??0,
  q:i.q,looter:i.looter??'Priest'})),...more
});
test('W10 source server chest_opened explicitly assigns item loot by individual looter',()=>{
 const G={items:{sword:{},ring:{}}};
 const r=ownChestShare(chest([
  {name:'sword',looter:'Priest'},
  {name:'ring',looter:'Ranger'}],15,{opener:'Ranger'}),'Priest',G);
 assert.equal(r?.items.size,1);
 assert.equal(r?.gold,15);
 assert.equal(r?.opener,'party');
 assert.equal(ownChestShare({...chest([]),gone:true},'Priest',G),null);
 assert.equal(ownChestShare({...chest([]),gold:NaN},'Priest',G),null);
});
test('W13 loot baseline + server event + exact physical delta yields only own confirmed receipt',()=>{
 const f=fixture();f.receipts.beforeLoot();
 const server=chest([{name:'ring',looter:'Priest'},{name:'gem0',looter:'Ranger'}],5,
  {opener:'Ranger'});
 assert.equal(f.receipts.observeChest(server),true);
 assert.equal(f.receipts.status().pending,1);
 assert.equal(f.receipts.status().physicalConfirmed,0);
 f.items[1]={name:'ring',level:0,src:'pvp'};
 f.setGold(105);
 f.receipts.sample();
 const status=f.receipts.status();
 assert.equal(status.physicalConfirmed,1);
 assert.equal(status.recent[0].state,'own-physical-receipt-confirmed');
 assert.equal(status.recent[0].opener,'party');
 assert.equal(f.events[0][0],'loot.ownReceipt');
 assert.equal(f.receipts.heartbeat().length,1);
 assert.equal(f.receipts.heartbeat()[0].id,'X');
});
test('W13 disappearing chest alone and another player loot never confirm own inventory',()=>{
 const f=fixture();f.receipts.beforeLoot();
 delete f.chests.X;
 assert.equal(f.receipts.status().physicalConfirmed,0);
 assert.equal(f.receipts.observeChest(chest([{name:'ring',looter:'Ranger'}],0)),false);
 f.receipts.sample();
 assert.equal(f.receipts.status().physicalConfirmed,0,
  'another player receiving the only item does not create own loot');
});
test('W13 prior source observation cannot be replaced by a positive-looking server event',()=>{
 const f=fixture();
 f.receipts.observeChest(chest([{name:'ring'}],2));
 assert.equal(f.receipts.status().serverOnly,1);
 f.items[1]={name:'ring'};f.setGold(102);
 f.receipts.sample();
 assert.equal(f.receipts.status().physicalConfirmed,0);
 assert.equal(f.receipts.heartbeat().length,0);
});
test('W13 mismatched gold, wrong extra item or different recipient leaves receipt unverified',()=>{
 for(const mutate of [
  f=>{f.setGold(104);f.items[1]={name:'ring'};},
  f=>{f.setGold(105);f.items[1]={name:'sword'};},
  f=>{f.setGold(105);f.items[1]={name:'ring'};f.items[2]={name:'gem0'};},
  f=>{f.setGold(105);f.items[1]={name:'ring',level:2};}
 ]){
  const f=fixture();f.receipts.beforeLoot();
  f.receipts.observeChest(chest([{name:'ring'}],5));
  mutate(f);f.receipts.sample();
  assert.equal(f.receipts.status().physicalConfirmed,0);
  f.advance(3501);
  assert.equal(f.receipts.status().serverOnly,1,
   'expired uncertain receipt must not be presented as own loot');
 }
});
test('W13 incomplete server item data and lost-and-found cannot fabricate personal loot',()=>{
 const f=fixture(),G=f.p.G;
 assert.equal(ownChestShare(chest([{name:'forged'}]),'Priest',G),null);
 assert.equal(ownChestShare(chest([{name:'ring',q:-2}]),'Priest',G),null);
 const row=chest([{name:'ring'}]);
 row.items[0].looter=null;row.items[0].lostandfound=true;
 const result=ownChestShare(row,'Priest',G);
 assert.equal(result?.items.size,0);
});
test('W13 realm, session, current inventory-value journal invalidate receipt baseline',()=>{
 for(const mutate of [
  f=>{f.setRealm('USI');},
  f=>{f.bot.session='session2';},
  f=>{f.bot.journal={kind:'mail.claim'};},
  f=>{f.bot.inventoryBlocked=true;},
  f=>{f.bot.logistics.reserved=true;}
 ]){
  const f=fixture();f.receipts.beforeLoot();mutate(f);
  f.receipts.observeChest(chest([{name:'ring'}],5));
  f.items[1]={name:'ring'};f.setGold(105);f.receipts.sample();
  assert.equal(f.receipts.status().physicalConfirmed,0);
 }
});
test('W13 direct loot(id) observes one chest and loot(true) cannot capture ambiguous remote chest',()=>{
 const f=fixture();
 f.receipts.beforeLoot(true);
 f.receipts.observeChest(chest([{name:'ring'}],5));
 assert.equal(f.receipts.status().serverOnly,1);
 const g=fixture();g.receipts.beforeLoot('X');
 g.receipts.observeChest(chest([{name:'ring'}],5));
 g.items[1]={name:'ring'};g.setGold(105);g.receipts.sample();
 assert.equal(g.receipts.status().physicalConfirmed,1);
});
test('W13 observed loot is diagnostic only, and optional heartbeat evidence is dropped first under pressure',()=>{
 const f=fixture();f.receipts.beforeLoot('X');
 f.receipts.observeChest(chest([{name:'ring'}],5));
 f.items[1]={name:'ring'};f.setGold(105);f.receipts.sample();
 assert.equal(f.receipts.status().dispatchAuthorized,false);
 const payload={name:'Priest',lootReceipts:f.receipts.heartbeat(),
  items:[],materials:[],other:'x'.repeat(220)};
 const result=fitHeartbeat(payload,300);
 assert.ok(result);
 assert.equal(result.lootReceipts,undefined);
});
test('W13 port listener attaches to official chest_opened and detaches cleanly',()=>{
 const listeners=new Map();
 const socket={on:(name,fn)=>listeners.set(name,fn),
  off:(name,fn)=>{if(listeners.get(name)===fn)listeners.delete(name);}};
 const p=createPorts({parent:{socket}}),events=[];
 const stop=p.watchChestOpened(row=>events.push(row));
 assert.equal(typeof stop,'function');
 listeners.get('chest_opened')({id:'X',gold:1});
 assert.equal(events.length,1);
 stop();assert.equal(listeners.has('chest_opened'),false);
 assert.equal(createPorts({parent:{}}).watchChestOpened(()=>{}),null);
});

test('W10/W13 confirmed loot receipt links to a live gear demand without authorizing transfer',()=>{
 const f=fixture();f.bot.production={reservedQuantity:()=>1,
  activeGoal:{item:'ring',level:0,recipient:'Ranger'}};
 f.bot.gear={goals:()=>[{item:'ring',level:0,recipient:'Ranger',
  quantity:1,gearSlot:'ring1'}]};
 f.receipts.beforeLoot('X');
 f.receipts.observeChest(chest([{name:'ring'}],5));
 f.items[1]={name:'ring',level:0};f.setGold(105);f.receipts.sample();
 const hints=f.receipts.status().purposeHints;
 assert.equal(hints.length,1);
 assert.equal(hints[0].name,'ring');
 assert.equal(hints[0].observedUnits,1);
 assert.equal(hints[0].currentUnits,1);
 assert.equal(hints[0].grossReservedUnits,1);
 assert.equal(hints[0].uncommittedEstimate,0);
 assert.deepEqual(hints[0].candidateRecipients,['Ranger']);
 assert.equal(hints[0].matchesCurrentProductionGoal,true);
 assert.equal(hints[0].dispatchAuthorized,false);
});
test('W13 multiple receipts of one variant cannot double-allocate physical inventory',()=>{
 const item={name:'ring',level:0};
 const variant=JSON.stringify(['ring',0,'','','','','','', '']);
 const f=fixture(),proofs=[
  {id:'X',physical:true,at:1000,items:[{variant,quantity:1}]},
  {id:'X',physical:true,at:1001,items:[{variant,quantity:1}]},
  {id:'Y',physical:true,at:1002,items:[{variant,quantity:1}]}];
 // Use the SAME canonical runtime identity including lock booleans.
 const canonical=JSON.stringify([item.name,0,'','','','','','','']);
 const normalized=proofs.map(p=>({...p,items:[{variant:canonical,quantity:1}]}));
 const hints=lootPurposeEvidence({proofs:normalized,
  inventory:[item],reserve:()=>1,gearGoals:[],now:1200});
 assert.equal(hints.length,1);
 assert.equal(hints[0].observedUnits,1,'a confirmed amount never exceeds actual units');
 assert.equal(hints[0].uncommittedEstimate,0);
});
test('W13 protected stock and unknown reservation authority cannot become free supplies',()=>{
 const item={name:'ring',level:0,l:'s'};
 const variant=JSON.stringify(['ring',0,'','','','','','s','']);
 const proofs=[{id:'X',physical:true,at:100,items:[{variant,quantity:1}]}];
 const protectedHints=lootPurposeEvidence({proofs,inventory:[item],
  reserve:()=>0,now:200});
 assert.equal(protectedHints[0]?.protectedUnits,1);
 assert.equal(protectedHints[0]?.uncommittedEstimate,0);
 const unknown=lootPurposeEvidence({proofs,inventory:[item],
  reserve:()=>null,now:200});
 assert.equal(unknown[0]?.uncommittedEstimate,null);
 assert.equal(unknown[0]?.state,'reservation-unverified');
});
test('W13 missing or moved physical loot is not kept as a claim on an item',()=>{
 const base={name:'ring',level:0};
 const variant=JSON.stringify(['ring',0,'','','','','','','']);
 const proofs=[{id:'X',physical:true,at:100,items:[{variant,quantity:1}]}];
 assert.deepEqual(lootPurposeEvidence({proofs,inventory:[],
  reserve:()=>0,now:200}),[]);
 assert.deepEqual(lootPurposeEvidence({proofs,inventory:[{name:'ring',level:1}],
  reserve:()=>0,now:200}),[]);
 assert.deepEqual(lootPurposeEvidence({proofs,inventory:[base],
  reserve:()=>0,now:21600300}),[]);
});
test('W13 repeated chest_opened for one id never credits another physical receipt',()=>{
 const f=fixture();f.receipts.beforeLoot('X');
 const first=chest([{name:'ring'}],5);
 assert.equal(f.receipts.observeChest(first),true);
 assert.equal(f.receipts.observeChest(first),false);
 f.items[1]={name:'ring'};f.setGold(105);
 f.receipts.sample();f.receipts.sample();
 assert.equal(f.receipts.status().physicalConfirmed,1);
 assert.equal(f.receipts.status().purposeHints.length,1);
 assert.equal(f.receipts.heartbeat().length,1);
});
test('W13 gear suggestions require current exact variant; variants never create send authority',()=>{
 const item={name:'ring',level:0,stat_type:'dex'};
 const variant=JSON.stringify(['ring',0,'dex','','','','','','']);
 const proofs=[{id:'X',physical:true,at:100,items:[{variant,quantity:1}]}];
 const hints=lootPurposeEvidence({proofs,inventory:[item],now:200,
  reserve:()=>0,gearGoals:[{item:'ring',level:0,recipient:'A',
   variant:{stat_type:'int'}},{item:'ring',level:0,recipient:'B',
   variant:{stat_type:'dex'}}]});
 assert.deepEqual(hints[0]?.candidateRecipients,['B']);
 assert.equal(hints[0]?.dispatchAuthorized,false);
});

test('W13 two simultaneous chest callbacks cannot spend the same physical delta twice',()=>{
 const f=fixture();f.chests.Y={x:5,y:5,items:1,map:'main',in:'main'};
 f.receipts.beforeLoot();
 assert.equal(f.receipts.observeChest(chest([{name:'ring'}],5)),true);
 assert.equal(f.receipts.observeChest({
  ...chest([{name:'ring'}],5),id:'Y'}),true);
 assert.equal(f.receipts.status().pending,2);
 f.items[1]={name:'ring',level:0};f.setGold(105);
 f.receipts.sample();f.receipts.sample();
 const result=f.receipts.status();
 assert.equal(result.physicalConfirmed,1);
 assert.equal(result.serverOnly,1);
 assert.equal(result.pending,0);
 assert.equal(result.purposeHints[0]?.observedUnits,1);
 assert.equal(f.events.filter(e=>e[0]==='loot.ownReceipt').length,1);
});

test('W10 cyclic opaque chest item never crashes server event attribution',()=>{
 const G={items:{ring:{}}},opaque={seed:7};opaque.self=opaque;
 const row={id:'X',opener:'Priest',gold:5,items:[
  {name:'ring',level:0,looter:'Priest',data:opaque}]};
 assert.doesNotThrow(()=>ownChestShare(row,'Priest',G));
 assert.equal(ownChestShare(row,'Priest',G),null,
  'a non-serializable item must not create a physical receipt');
});

test('W10 malformed live inventory cannot be used as a loot baseline',()=>{
 const f=fixture(),opaque={seed:1};opaque.self=opaque;
 f.items[0]={name:'sword',data:opaque};
 assert.doesNotThrow(()=>f.receipts.beforeLoot('X'));
 assert.equal(f.receipts.observeChest(chest([{name:'ring'}],5)),true);
 f.items[1]={name:'ring'};f.setGold(105);
 assert.doesNotThrow(()=>f.receipts.sample());
 assert.equal(f.receipts.status().physicalConfirmed,0);
 assert.equal(f.receipts.status().serverOnly,1);
});

test('W10 malformed inventory denies all free-loot planning hints without throwing',()=>{
 const item={name:'ring',level:0},
  variant=JSON.stringify(['ring',0,'','','','','','','']),
  proofs=[{id:'X',physical:true,at:100,
   items:[{variant,quantity:1}]}];
 const opaque={seed:9};opaque.self=opaque;
 assert.deepEqual(lootPurposeEvidence({proofs,
  inventory:[item,{name:'sword',data:opaque}],reserve:()=>0,now:200}),[]);
 assert.equal(lootPurposeEvidence({proofs,inventory:[item],
  reserve:()=>0,now:200})[0]?.dispatchAuthorized,false);
});

test('W10 cyclic or spoofed variant goals never become recipient suggestions',()=>{
 const item={name:'ring',level:0,stat_type:'dex'},
  variant=JSON.stringify(['ring',0,'dex','','','','','','']),
  proofs=[{id:'X',physical:true,at:100,
   items:[{variant,quantity:1}]}];
 const cycle={stat_type:'dex'};cycle.self=cycle;
 const goals=[
  {item:'ring',level:0,recipient:'Cyclic',variant:cycle},
  {item:'ring',level:0,recipient:'Spoofed item',
   variant:{name:'sword',stat_type:'dex'}},
  {item:'ring',level:0,recipient:'Spoofed level',
   variant:{level:5,stat_type:'dex'}},
  {item:'ring',level:0,recipient:'Malformed',
   variant:{data:{x:1n}}},
  {item:'ring',level:0,recipient:'Valid',
   variant:{stat_type:'dex'}},
  {item:'ring',level:0,recipient:'Generic',variant:null}
 ];
 const hints=lootPurposeEvidence({proofs,inventory:[item],
  gearGoals:goals,reserve:()=>0,now:200});
 assert.deepEqual(hints[0]?.candidateRecipients,['Valid','Generic']);
 assert.equal(hints[0]?.dispatchAuthorized,false);
});

test('W10 own-loot status tolerates corrupted gear objectives without creating send authority',()=>{
 const f=fixture();f.receipts.beforeLoot('X');
 assert.equal(f.receipts.observeChest(chest([{name:'ring'}],5)),true);
 f.items[1]={name:'ring',level:0};f.setGold(105);f.receipts.sample();
 const cyclic={stat_type:'dex'};cyclic.self=cyclic;
 f.bot.gear={goals:()=>[
  {item:'ring',level:0,recipient:'Ranger',variant:cyclic}
 ]};
 f.bot.production={reservedQuantity:()=>0};
 let status;
 assert.doesNotThrow(()=>{status=f.receipts.status();});
 assert.equal(status.physicalConfirmed,1);
 assert.deepEqual(status.purposeHints[0]?.candidateRecipients,[]);
 assert.equal(status.purposeHints[0]?.dispatchAuthorized,false);
});

test('W10/W13 a physically impossible post-loot potion stack never confirms own receipt',()=>{
 const f=fixture();
 f.items[0]={name:'hpot0',q:9999};
 f.receipts.beforeLoot('X');
 assert.equal(f.receipts.observeChest(chest([{name:'hpot0',q:1}],5)),true);
 f.items[0]={name:'hpot0',q:10000};
 f.setGold(105);f.receipts.sample();
 assert.equal(f.receipts.status().physicalConfirmed,0);
 f.advance(3501);
 assert.equal(f.receipts.status().serverOnly,1);
 const good=fixture();
 good.items[0]={name:'hpot0',q:9998};
 good.receipts.beforeLoot('X');
 assert.equal(good.receipts.observeChest(chest([{name:'hpot0',q:1}],5)),true);
 good.items[0]={name:'hpot0',q:9999};
 good.setGold(105);good.receipts.sample();
 assert.equal(good.receipts.status().physicalConfirmed,1,
  'one real unit can fill the server-defined last stack slot');
});

test('W10/W13 malformed unrelated stock denies both baseline and later physical proof',()=>{
 for(const phase of ['before','after']){
  const f=fixture();
  if(phase==='before')f.items[0]={name:'sword',q:2};
  f.receipts.beforeLoot('X');
  assert.equal(f.receipts.observeChest(chest([{name:'ring'}],5)),true);
  f.items[1]={name:'ring'};
  if(phase==='after')f.items[0]={name:'sword',q:2};
  f.setGold(105);f.receipts.sample();
  assert.equal(f.receipts.status().physicalConfirmed,0,phase);
  assert.equal(f.receipts.heartbeat().length,0);
 }
});

test('W10/W13 current item definition drift blocks a pre-loot receipt',()=>{
 const f=fixture();f.p.G.version=3;
 f.receipts.beforeLoot('X');
 assert.equal(f.receipts.observeChest(chest([{name:'ring'}],5)),true);
 f.p.G.version=4;
 f.items[1]={name:'ring'};f.setGold(105);f.receipts.sample();
 assert.equal(f.receipts.status().physicalConfirmed,0);
});

test('W13 read-only gear-demand hints never accept explicit null or overstacked inventory',()=>{
 const ring={name:'ring',level:0},
  variant=JSON.stringify(['ring',0,'','','','','','','']),
  proof=[{id:'X',physical:true,at:100,items:[{variant,quantity:1}]}],
  G={items:{ring:{},gem0:{s:99}}};
 const hint=inventory=>lootPurposeEvidence({
  proofs:proof,inventory,G,reserve:()=>0,now:200});
 assert.equal(hint([ring])[0]?.currentUnits,1);
 assert.deepEqual(hint([{...ring,q:null}]),[]);
 assert.deepEqual(hint([ring,{name:'gem0',q:100}]),[],
  'a physically impossible unrelated row invalidates the entire hint snapshot');
 assert.deepEqual(hint([ring,{name:'ring',q:2}]),[]);
 assert.deepEqual(hint([ring,{name:'forged',q:1}]),[]);
 assert.deepEqual(lootPurposeEvidence({
  proofs:proof,inventory:[{...ring,q:2}],reserve:()=>0,now:200}),[],
  'without game stack definitions the hint cannot assume a stackable item');
});
