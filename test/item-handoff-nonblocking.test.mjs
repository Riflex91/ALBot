import test from 'node:test';
import assert from 'node:assert/strict';
import {createCheckpoint,isItemHandoffJournal,releaseItemHandoffJournal} from '../src/core/checkpoint.mjs';

function storeFixture({allowWrites=true}={}){
 const saved=new Map(),events=[],messages=[];
 const p={root:{localStorage:{removeItem(){}}},
  read:k=>saved.get(k)??null,
  write(k,v){if(!allowWrites)return false;saved.set(k,structuredClone(v));return true;},
  storageError:'write failed'};
 const report={event:(name,data)=>events.push({name,data}),
  error:(name,message)=>messages.push({name,message})};
 const key='albot:test-checkpoint';
 const checkpoint=createCheckpoint(p,key,report);
 return {p,checkpoint,saved,events,messages,key};
}

test('only direct item send/receive handoffs are eligible for best-effort unlock',()=>{
 for(const kind of ['send','receive'])
  assert.equal(isItemHandoffJournal({kind}),true);
 for(const kind of ['gold.send','gold.receive','bank.store','bank.retrieve',
  'exchange','upgrade','sell','compound','gather.mining','consume'])
  assert.equal(isItemHandoffJournal({kind}),false,kind);
 assert.equal(isItemHandoffJournal(null),false);
});

test('unconfirmed receive is a bounded attempt: clear journal but never count it as delivery',()=>{
 const f=storeFixture();
 const old={kind:'receive',id:'farmer-session:4',from:'My_Ranger2',
  item:{name:'beewings',level:0},quantity:3,before:3};
 assert.equal(f.checkpoint.begin(old),true);
 assert.deepEqual(f.saved.get(f.key).journal,old);
 assert.equal(releaseItemHandoffJournal(f.checkpoint,old),true);
 assert.equal(f.saved.get(f.key).journal,null);
 assert.equal(f.checkpoint.durable,true);
});

test('unconfirmed sender journal also clears; not-yet-dispatched and sent statuses never replay',()=>{
 for(const state of ['offered','accepted','sent']){
  const f=storeFixture();
  const old={kind:'send',state,id:'sender:7',item:{name:'beewings'},quantity:3};
  assert.equal(f.checkpoint.begin(old),true);
  assert.equal(releaseItemHandoffJournal(f.checkpoint,old),true);
  assert.equal(f.saved.get(f.key).journal,null);
 }
});

test('checkpoint write failure never pretends the transfer journal has been released',()=>{
 const f=storeFixture();
 const old={kind:'receive',id:'r:1',quantity:3};
 assert.equal(f.checkpoint.begin(old),true);
 f.p.write=()=>false;
 assert.equal(releaseItemHandoffJournal(f.checkpoint,old),false);
 assert.notEqual(f.saved.get(f.key).journal,null);
 assert.equal(f.checkpoint.durable,false);
});

test('gold, bank, trade and upgrades remain journaled and are not silently released',()=>{
 const f=storeFixture();
 for(const kind of ['gold.send','gold.receive','bank.store','exchange','upgrade']){
  const old={kind,id:'test:1'};
  assert.equal(f.checkpoint.begin(old),true);
  assert.equal(releaseItemHandoffJournal(f.checkpoint,old),false);
  assert.equal(f.saved.get(f.key).journal.kind,kind);
 }
});
