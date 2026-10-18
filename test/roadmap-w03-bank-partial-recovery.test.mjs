import test from 'node:test';
import assert from 'node:assert/strict';
import {fingerprint} from '../src/core/policy.mjs';
import {classifyBankPartialRecord,validateBankPartialRecord}
 from '../src/merchant/bank-partial-recovery.mjs';
import {createBank} from '../src/merchant/bank.mjs';

const owner='M',realm='EU:I',now=1700000000000;
const material={name:'beewing',q:131},blank=()=>Array(42).fill(null);
function checkpoint(extra={}){
 return {version:2,owner,realm,at:now,pack:'items0',
  bankSlot:7,dest:0,splitSlot:1,item:{...material},
  sourcePrint:fingerprint(material),total:131,take:100,
  before:0,bankBefore:131,...extra};
}
function evidence(r,{source={...material},dest=null,split=null,
 map='bank',packPresent=true,bankMap='bank'}={}){
 const inventory=blank(),pack=blank();inventory[0]=dest;
 inventory[1]=split;pack[7]=source;
 return classifyBankPartialRecord(r,{owner,realm,now,inventory,
  bank:packPresent?{items0:pack}:{},map,packMap:()=>bankMap});
}
test('W03 partial checkpoint must be v2, same character/realm and exact whole-stack fingerprint',()=>{
 assert.equal(validateBankPartialRecord(checkpoint(),{owner,realm,now}).valid,true);
 for(const change of [{version:1},{owner:'Other'},{realm:'US:I'},
  {sourcePrint:'changed'},{bankSlot:42},{dest:1},{splitSlot:0},
  {total:132},{take:131},{take:0},{before:-1},
  {bankBefore:130},{item:{...material,l:true}},
  {item:{...material,q:130}},{at:now+3000}]){
  assert.equal(validateBankPartialRecord(checkpoint(change),{owner,realm,now}).valid,
   false,JSON.stringify(change));
 }
});
test('W03 exact source and destination states form the four finite phases',()=>{
 const r=checkpoint();
 assert.equal(evidence(r).phase,'original');
 assert.equal(evidence(r,{source:null,dest:{...material}}).phase,'withdrawn');
 assert.equal(evidence(r,{source:null,
  dest:{name:'beewing',q:31},split:{name:'beewing',q:100}}).phase,'split');
 assert.equal(evidence(r,{source:{name:'beewing',q:31},
  split:{name:'beewing',q:100}}).phase,'returned');
});
test('W03 other inventory quantity cannot impersonate a returned split stack',()=>{
 const r=checkpoint();
 for(const sample of [{source:null,split:{name:'beewing',q:100}},
  {source:{...material},split:{name:'beewing',q:100}},
  {source:{name:'beewing',q:31},dest:{name:'beewing',q:100}},
  {source:null,dest:{name:'beewing',q:31},split:{name:'beewing',q:99}},
  {source:{name:'beewing',q:32},split:{name:'beewing',q:100}},
  {source:{name:'beewing',q:31},split:{name:'beewing',q:100,l:true}}]){
  assert.equal(evidence(r,sample).phase,'ambiguous',JSON.stringify(sample));
 }
});
test('W03 stale or off-map bank arrays cannot act as physical recovery receipts',()=>{
 assert.equal(evidence(checkpoint(),{map:'main'}).phase,'unobserved');
 assert.equal(evidence(checkpoint(),{packPresent:false}).phase,'unobserved');
 assert.equal(evidence(checkpoint(),{bankMap:'bank_b'}).phase,'unobserved');
 assert.equal(evidence(checkpoint({realm:'US:I'})).phase,'invalid');
});
function fixture(saved=null,{persist=true,perform=true}={}){
 const store=new Map(saved?[['albot:bank-partial:M',saved]]:[]),pack=blank(),
  inventory=blank(),calls=[],events=[],notes=[];
 pack[7]={...material};
 let canWrite=persist;
 const p={c:{name:'M',map:'bank',in:'bank',items:inventory,
  bank:{items0:pack},gold:1000,slots:{}},
  G:{items:{beewing:{s:9999,type:'material'}},
   bank_packs:{items0:['bank',0,0]}},realm:()=>realm,
  read:key=>store.get(key)??null,
  write:(key,value)=>{if(!canWrite)return false;store.set(key,value);return true;}};
 const economy={safe:i=>!!i&&!i.l&&!i.b,
  travel:()=>true,note:s=>notes.push(s),count:i=>
   inventory.filter(x=>x?.name===i.name).reduce((n,x)=>n+(x.q??1),0),
  remaining:()=>true,spare:()=>9999,
  explicit:()=>null,rules:()=>null,
  perform:(kind,options)=>{calls.push({kind,options});return perform;}};
 const bot={p,economy,cfg:{party:{merchant:'M'},
  merchant:{bank:true,partialBank:true,partialBankMaxStack:9999,
   bankReclaim:false},production:{autoDisposition:false,
    goals:[],gearTargets:[]}},me:{name:'M'},session:'new',
  inventoryBlocked:false,journal:null,running:true,
  logistics:{reserved:false},exec:{busy:()=>false},
  event:(...args)=>events.push(args),free:()=>inventory.filter(x=>!x).length};
 bot.bank=createBank(bot);
 return {bot,pack,inventory,calls,events,notes,store,stopWrites(){canWrite=false;}};
}
test('W03 partial recovery emits only the next observed valid physical action',()=>{
 const r=checkpoint({at:Date.now()}),f=fixture(r);
 assert.equal(f.bot.bank.recover(),true);
 assert.equal(f.calls.at(-1).kind,'bank.partial.retrieve');
 assert.equal(f.calls.at(-1).options.guard(),true);
 f.pack[7]=null;f.inventory[0]={...material};
 assert.equal(f.calls.at(-1).options.observe(),true);
 f.bot.bank.recover();
 assert.equal(f.calls.at(-1).kind,'bank.partial.split');
 assert.equal(f.calls.at(-1).options.guard(),true);
 f.inventory[0]={name:'beewing',q:31};
 f.inventory[1]={name:'beewing',q:100};
 f.bot.bank.recover();
 assert.equal(f.calls.at(-1).kind,'bank.partial.return');
 assert.equal(f.calls.at(-1).options.guard(),true);
 f.inventory[0]=null;f.pack[7]={name:'beewing',q:31};
 assert.equal(f.calls.at(-1).options.observe(),true);
 f.bot.bank.recover();
 assert.equal(f.bot.bank.pending,false);
 assert.equal(f.store.get('albot:bank-partial:M'),null);
 assert.equal(f.events.at(-1)[0],'bank.partial.complete');
});
test('W03 aggregate counts without addressed returned slot cannot clear partial checkpoint',()=>{
 const r=checkpoint({at:Date.now()}),f=fixture(r);
 f.pack[7]=null;f.inventory[0]={name:'beewing',q:100};
 f.inventory[1]={name:'beewing',q:31};
 f.bot.bank.recover();
 assert.equal(f.bot.inventoryBlocked,true);
 assert.equal(f.bot.bank.pending,true);
 assert.equal(f.calls.length,0);
});
test('W03 pending partial recovery with old unversioned checkpoint fails closed',()=>{
 const legacy=checkpoint({version:undefined,at:Date.now()}),f=fixture(legacy);
 assert.equal(f.bot.inventoryBlocked,true);
 assert.equal(f.bot.bank.pending,true);
 f.bot.bank.recover();
 assert.equal(f.calls.length,0);
});
test('W03 unresolved bank map does not attempt even a reversible repeat',()=>{
 const r=checkpoint({at:Date.now()}),f=fixture(r);
 f.bot.p.c.map='main';
 assert.equal(f.bot.bank.recover(),true);
 assert.equal(f.calls.length,0);
 assert.equal(f.bot.bank.pending,true);
});
test('W03 failed returned-phase checkpoint clearing blocks rather than claims success',()=>{
 const r=checkpoint({at:Date.now()}),f=fixture(r);
 f.pack[7]={name:'beewing',q:31};f.inventory[1]={name:'beewing',q:100};
 f.stopWrites();
 f.bot.bank.recover();
 assert.equal(f.bot.inventoryBlocked,true);
 assert.equal(f.bot.bank.pending,true);
 assert.equal(f.events.length,0);
});
test('W03 late bank slot drift cancels previously planned next step',()=>{
 const r=checkpoint({at:Date.now()}),f=fixture(r);
 f.bot.bank.recover();
 const first=f.calls.at(-1).options;
 f.pack[7]={name:'beewing',q:130};
 assert.equal(first.guard(),false);
});
