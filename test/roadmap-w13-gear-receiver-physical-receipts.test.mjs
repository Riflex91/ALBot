import test from 'node:test';
import assert from 'node:assert/strict';
import {createGearAllocation} from '../src/production/allocation.mjs';
import {fingerprint,identity} from '../src/core/policy.mjs';

const gear={name:'staff',level:3,stat_type:'int'};
const now=Date.now();
function receiverFixture(rows=[]){
 const key='albot:gear:Priest:allocations:receiving',
  senderKey='albot:gear:Priest:allocations',
  store=new Map([[key,structuredClone(rows)],[senderKey,[]]]),
  events=[],slots={mainhand:null},items=[{...gear}];
 const bot={me:{name:'Priest'},p:{c:{slots,items},G:{items:{}},
  read:key=>store.get(key)??null,
  write:(key,value)=>{store.set(key,structuredClone(value));return true;},
  realm:()=> 'EUI'},
  cfg:{party:{merchant:'Merchant'},general:{messageTtlMs:10000}},
  gear:{snapshot:()=>({class:'priest',slots:{...slots}}),
   goals:()=>[]},economy:{explicit:()=>null},
  event:(...values)=>events.push(values)};
 return {bot,store,slots,events,alloc:createGearAllocation(bot)};
}
const accepted=(id='transfer:1')=>({id,from:'Merchant',
 session:'source-session',item:{...gear},slot:'mainhand',
 expected:fingerprint(null),expires:now+600000,state:'accepted'});

test('W13 an inbound gear offer must be one physical singleton, never synthetic q',()=>{
 for(const q of [null,0,-1,0.5,2,3,NaN,Infinity]){
  const f=receiverFixture();
  const g={slot:'mainhand',expected:fingerprint(null),
   expires:Date.now()+10000};
  assert.equal(f.alloc.accept('id','Merchant','source-session',
   {...gear,q},g),false,'invalid incoming quantity '+String(q));
  assert.deepEqual(f.store.get('albot:gear:Priest:allocations:receiving'),[]);
 }
 const f=receiverFixture();
 assert.equal(f.alloc.equipGuard({...gear},'mainhand'),true);
 assert.equal(f.alloc.equipGuard({...gear,q:1},'mainhand'),true);
});
test('W13 in-flight gear equip guard fails on malformed physical inventory',()=>{
 const f=receiverFixture([accepted()]);
 assert.equal(f.alloc.equipGuard({...gear},'mainhand'),true);
 for(const q of [null,0,-1,0.5,2,3,NaN,Infinity]){
  assert.equal(f.alloc.equipGuard({...gear,q},'mainhand'),
   false,'malformed candidate gear '+String(q));
 }
 const bad={...gear,data:{}};bad.data.self=bad.data;
 assert.equal(f.alloc.equipGuard(bad,'mainhand'),false);
});
test('W13 physical equip recognition never converts a synthetic stack to equipped',()=>{
 const f=receiverFixture([accepted()]);
 f.slots.mainhand={...gear,q:2};
 f.alloc.tick();
 assert.equal(f.store.get('albot:gear:Priest:allocations:receiving')[0].state,
  'accepted','a matching variant with q:2 is not wearable gear');
 f.slots.mainhand={...gear,q:null};
 f.alloc.tick();
 assert.equal(f.store.get('albot:gear:Priest:allocations:receiving')[0].state,
  'accepted');
 f.slots.mainhand={...gear,q:1};
 f.alloc.tick();
 assert.equal(f.store.get('albot:gear:Priest:allocations:receiving')[0].state,
  'equipped','an exact ordinary one-unit observation is still accepted');
 assert.equal(f.events.length,1);
});
test('W13 sender delivery settlement ignores synthetic equipped receiver copies',()=>{
 const v=identity(gear),key='albot:gear:Merchant:allocations';
 const rows=[{id:'confirmed',recipient:'Priest',recipientSession:'r1',
  slot:0,fingerprint:fingerprint(gear),variant:v,quantity:1,
  gearSlot:'mainhand',expected:fingerprint(null),realm:'EUI',
  state:'delivered',at:now,settlement:{receipt:true}}];
 const store=new Map([[key,rows]]),peer={name:'Priest',running:true,
  rip:false,realm:'EUI',session:'r1',gear:{slots:{mainhand:{...gear,q:2}}}};
 const bot={me:{name:'Merchant'},p:{c:{items:[]},
  read:key=>store.get(key)??null,
  write:(key,value)=>{store.set(key,structuredClone(value));return true;},
  realm:()=> 'EUI'},transport:{fresh:()=>peer},event:()=>{},
  gear:{goals:()=>[]}};
 const a=createGearAllocation(bot);
 a.tick();assert.equal(a.status()[0].state,'delivered');
 peer.gear.slots.mainhand.q=null;
 a.tick();assert.equal(a.status()[0].state,'delivered');
 peer.gear.slots.mainhand.q=1;
 a.tick();assert.equal(a.status()[0].state,'equipped');
});
