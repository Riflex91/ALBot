import test from 'node:test';
import assert from 'node:assert/strict';
import {createGearAllocation} from '../src/production/allocation.mjs';
import {fingerprint} from '../src/core/policy.mjs';

const key='albot:gear:Priest:allocations:receiving';
function fixture(initial=null){
 const storage=new Map(),messages=[],item={name:'staff',level:2,stat_type:'int'};
 if(initial!==null)storage.set(key,structuredClone(initial));
 let writable=true;
 const bot={
  me:{name:'Priest',role:'farmer',gearRole:'auto'},
  cfg:{general:{messageTtlMs:10000},party:{merchant:'Merchant'}},
  p:{c:{items:Array(42).fill(null),slots:{mainhand:null}},
   realm:()=> 'EUI',
   G:{items:{staff:{type:'weapon',wtype:'staff'}},
    classes:{priest:{mainhand:{staff:1},doublehand:{},offhand:{}}}},
   read:k=>storage.get(k)??null,
   write:(k,v)=>{if(!writable)return false;storage.set(k,structuredClone(v));return true;},
   call:(kind)=>kind==='item_properties'?{attack:40,int:30,hp:20}:null},
  gear:{snapshot:()=>({class:'priest',level:80,slots:{mainhand:null,offhand:null}})},
  economy:{explicit:()=>null},event:(...args)=>messages.push(args)
 };
 const allocation=createGearAllocation(bot);
 const gear=()=>({slot:'mainhand',expected:fingerprint(null),
  expires:Date.now()+5000});
 return {bot,storage,messages,item,allocation,gear,
  setWritable:v=>writable=v,accept:(id='m:1',from='Merchant',session='ms1',g=gear())=>
   allocation.accept(id,from,session,item,g)};
}

test('W13 one legitimate receiver claim is durable, then transfer-id replay is refused',()=>{
 const f=fixture();
 assert.equal(f.accept(),true);
 const original=structuredClone(f.storage.get(key));
 assert.equal(original.length,1);
 assert.equal(original[0].session,'ms1');
 assert.equal(f.accept(),false,'a repeated offer is not a fresh authority');
 assert.equal(f.accept('m:1','Merchant','different-session'),false);
 assert.equal(f.accept('m:1','Other','ms1'),false);
 assert.deepEqual(f.storage.get(key),original);
 const reloaded=createGearAllocation(f.bot);
 assert.equal(reloaded.accept('m:1','Merchant','ms1',f.item,f.gear()),false,
  'after a restart the exact same id cannot create a second promise');
 assert.equal(reloaded.accept('m:2','Merchant','ms1',f.item,f.gear()),true);
 assert.equal(f.storage.get(key).length,2);
});

test('W13 at the receiver ledger cap active accepted claims are not evicted',()=>{
 const f=fixture();
 for(let i=0;i<16;i++)assert.equal(f.accept('job:'+i),true);
 const baseline=structuredClone(f.storage.get(key));
 assert.equal(baseline.length,16);
 assert.equal(f.accept('job:17'),false);
 assert.deepEqual(f.storage.get(key),baseline);
 const restarted=createGearAllocation(f.bot);
 assert.equal(restarted.accept('job:18','Merchant','ms1',f.item,f.gear()),false);
 assert.deepEqual(f.storage.get(key),baseline);
});

test('W13 malformed durable receiver history is quarantined not silently reset',()=>{
 const valid=fixture();
 assert.equal(valid.accept('m:1'),true);
 const row=valid.storage.get(key)[0];
 const invalid=[
  7,{unexpected:true},[null],[{...row,expires:'tomorrow'}],
  [{...row,session:null}],
  [{...row},{...row,id:row.id}]
 ];
 for(const history of invalid){
  const f=fixture(history);
  assert.equal(f.allocation.recoveryStatus().unsafeReceiving,true);
  assert.equal(f.allocation.recoveryStatus().blockedNewGear,true);
  assert.equal(f.accept(),false);
  assert.deepEqual(f.allocation.rules(),[]);
  assert.equal(f.allocation.equipGuard(f.item,'mainhand'),false);
  assert.equal(f.allocation.pendingReceived(f.item),true);
  assert.doesNotThrow(()=>f.allocation.tick());
  assert.deepEqual(f.storage.get(key),history);
 }
});

test('W13 invalid recipient promise expiry and sender do not persist an ACK',()=>{
 const f=fixture(),now=Date.now();
 for(const g of [
  {...f.gear(),expires:NaN},{...f.gear(),expires:Infinity},
  {...f.gear(),expires:now-10},
  {...f.gear(),expires:now+1000000},
  {...f.gear(),expected:42},
  {...f.gear(),slot:42}
 ]){
  assert.equal(f.accept('m:1','Merchant','ms1',g),false);
 }
 assert.equal(f.accept('m:1','SomeOther','ms1'),false);
 assert.equal(f.accept('m:1','Merchant',''),false);
 assert.equal(f.accept(''),false);
 assert.equal(f.storage.has(key),false);
});

test('W13 failed durable receiver promise write does not change in-memory admission',()=>{
 const f=fixture();
 f.setWritable(false);
 assert.equal(f.accept('m:1'),false);
 assert.equal(f.storage.has(key),false);
 assert.equal(f.allocation.pendingReceived(f.item),false);
 f.setWritable(true);
 assert.equal(f.accept('m:1'),true);
 assert.equal(f.storage.get(key).length,1);
});

test('W13 distinct expired entries can be replaced without losing still active claims',()=>{
 const seed=fixture();
 assert.equal(seed.accept('old:1'),true);
 const accepted=seed.storage.get(key)[0];
 const expired={...accepted,id:'expired:1',expires:Date.now()-1000};
 const f=fixture([expired,accepted]);
 assert.equal(f.accept('new:1'),true);
 assert.deepEqual(f.storage.get(key).map(x=>x.id),['old:1','new:1']);
});
