import test from 'node:test';
import assert from 'node:assert/strict';
import {createPorts} from '../src/runtime/ports.mjs';
import {createCaveLifecycle} from '../src/world/cave-lifecycle.mjs';

const key='albot:cave-lifecycle:P';
function storageFixture(){
 const data=new Map(),root={
  character:{name:'P'},G:{items:{}},get:()=>null
 };
 root.localStorage={
  getItem:k=>data.has(k)?data.get(k):null,
  setItem:(k,v)=>{data.set(k,v);},
  removeItem:k=>{data.delete(k);}
 };
 return {data,root,p:createPorts(root)};
}
test('N12 raw Cave reader reads same namespace as writes, preserving null vs malformed JSON',()=>{
 const f=storageFixture();
 assert.equal(f.p.readCaveJournal(key),null);
 const record={version:1,name:'P',phase:'dispatch-unknown',run:'a'.repeat(24)};
 assert.equal(f.p.write(key,record),true);
 assert.deepEqual(f.p.readCaveJournal(key),record);
 assert.equal(f.data.get('cstore_'+key),JSON.stringify(record));
 f.data.set('cstore_'+key,'{broken');
 assert.throws(()=>f.p.readCaveJournal(key),SyntaxError,
  'malformed journal must not be returned as missing');
 assert.equal(f.p.read(key),null,
  'legacy convenience read is deliberately not a journal proof');
 f.data.set('cstore_'+key,JSON.stringify(record));
 assert.deepEqual(f.p.readCaveJournal(key),record);
});
test('N12 strict reader does not replace storage exceptions or corrupt objects with no journal',()=>{
 const f=storageFixture();
 f.root.localStorage.getItem=()=>{throw Error('storage denied')};
 assert.throws(()=>f.p.readCaveJournal(key),/storage denied/);
 f.root.localStorage.getItem=()=>undefined;
 assert.throws(()=>f.p.readCaveJournal(key),/Invalid Cave journal storage payload/);
 f.root.localStorage.getItem=()=>'{'+ 'x'.repeat(65537)+'}';
 assert.throws(()=>f.p.readCaveJournal(key),/Invalid Cave journal storage payload/);
});
test('N12 unsupported host must deny Cave journal writes rather than read a swallowing get()',()=>{
 const root={character:{name:'P'},get:()=>null};
 const p=createPorts(root);
 assert.throws(()=>p.readCaveJournal(key),/Strict Cave journal storage unavailable/);
 assert.equal(p.read(key),null);
 let rpc=0;
 const bot={p:{...p,realm:()=> 'EUI',has:()=>true,
  call:()=>{rpc++;return Promise.resolve({success:true})}},
  me:{name:'P'},session:'S',running:true,
  cave:{status:()=>({entryPreflight:{
   mode:'new',party:['P'],run:null,localConditionsMet:true,
   requiresJournal:true,executable:false,serverVerified:false
  },live:null})}
 };
 const lifecycle=createCaveLifecycle(bot,{now:()=>1770000000000});
 assert.equal(lifecycle.status().state,'storage-uncertain');
 assert.equal(lifecycle.prepare(),false);
 assert.equal(lifecycle.requestEntry(),false);
 assert.equal(rpc,0);
});
test('N12 rejected keys cannot read other personal localStorage settings',()=>{
 const f=storageFixture();
 for(const rejected of ['profile','albot:cave-lifecycle:','albot:cave-lifecycle:../P',
  'albot:cave-lifecycle:My Ranger','albot:cave-lifecycle:P\nother']){
  assert.throws(()=>f.p.readCaveJournal(rejected),/Invalid Cave journal key/);
 }
});

test('N12 strict Cave vote namespace is durable and corrupt vote JSON fails closed',()=>{
 const f=storageFixture(),vote='albot:cave-vote:P';
 assert.equal(f.p.readCaveJournal(vote),null);
 const record={version:1,name:'P',phase:'dispatch-unknown',
  choiceId:'scene-1',optionId:'safe'};
 assert.equal(f.p.write(vote,record),true);
 assert.deepEqual(f.p.readCaveJournal(vote),record);
 f.data.set('cstore_'+vote,'not-json');
 assert.throws(()=>f.p.readCaveJournal(vote),SyntaxError);
 for(const invalid of ['albot:cave-vote:../P','albot:cave-vote:','albot:cave-vote:P/other'])
  assert.throws(()=>f.p.readCaveJournal(invalid),/Invalid Cave journal key/);
});
