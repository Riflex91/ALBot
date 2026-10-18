import test from 'node:test';
import assert from 'node:assert/strict';
import {fingerprint} from '../src/core/policy.mjs';
import {classifyBankReclaimRecord,validateBankReclaimRecord}
 from '../src/merchant/bank-reclaim-recovery.mjs';
import {createBank} from '../src/merchant/bank.mjs';

const item={name:'ore',q:10},owner='M',realm='EU:I',pack='items0',now=1700000000000;
const empty=()=>Array(42).fill(null);
function record(extra={}){
 return {version:2,owner,realm,at:now,item:{...item},pack,slot:27,
  dest:0,before:0,bankBefore:10,quantity:10,
  gold:1000,sourcePrint:fingerprint(item),expectedSaleGold:20,
  explicitOnly:true,...extra};
}
const context=(r,{source={...item},target=null,map='bank',bankPresent=true}={})=>{
 const inventory=empty(),bankPack=empty();
 inventory[0]=target;bankPack[27]=source;
 return classifyBankReclaimRecord(r,{owner,realm,now,inventory,
  bank:bankPresent?{items0:bankPack}:{},map,packMap:()=> 'bank'});
};
test('W04 recovery proof requires versioned, addressed owner/realm evidence',()=>{
 assert.equal(validateBankReclaimRecord(record(),{owner,realm,now}).valid,true);
 for(const bad of [{version:1},{owner:'Another'},{realm:'US:I'},
  {sourcePrint:'forged'},{quantity:9},{bankBefore:9},
  {before:-1},{explicitOnly:'yes'},{expectedSaleGold:Infinity},
  {gold:-1},{at:now+5000},{slot:42},{dest:1000},
  {item:{name:'ore',q:10,l:true}},{saleConfirmed:false}]){
  assert.equal(validateBankReclaimRecord(record(bad),{owner,realm,now}).valid,
   false,JSON.stringify(bad));
 }
});
test('W04 recovery states require the exact bank and inventory before/after image',()=>{
 const r=record();
 assert.equal(context(r).phase,'unchanged');
 assert.equal(context(r,{source:null,target:{...item}}).phase,'withdrawn');
 assert.equal(context(record({saleConfirmed:true}),{source:null}).phase,'sold');
 assert.equal(context(r,{source:null}).phase,'ambiguous');
 assert.equal(context(r,{source:{...item,q:8}}).phase,'ambiguous');
 assert.equal(context(r,{source:null,target:{...item,q:9}}).phase,'ambiguous');
 assert.equal(context(record({saleConfirmed:true}),{source:{...item}}).phase,'ambiguous');
 assert.equal(context(r,{source:null,target:{...item,l:true}}).phase,'ambiguous');
});
test('W04 missing or foreign bank observations are never treated as empty slots',()=>{
 assert.equal(context(record(),{bankPresent:false}).phase,'unobserved');
 assert.equal(context(record(),{map:'main'}).phase,'unobserved');
 assert.equal(context(record({realm:'US:I'})).phase,'invalid');
});

function fixture({saved,bankItem={...item},carried=null,realmValue=realm,
 write=true,perform=true,rules=true}={}){
 const store=new Map(saved?[['albot:bank-reclaim:M',saved]]:[]);
 const calls=[],sales=[],notes=[],items=empty(),bankPack=empty();
 items[0]=carried;bankPack[27]=bankItem;
 const sourceRule={enabled:true,action:'sell',item:'ore',batch:10,
  maxCount:9999,keep:0,teamReserve:0,minPrice:0,maxActions:0};
 const p={c:{map:'bank',items,bank:{items0:bankPack},
  gold:1000,slots:{}},G:{items:{ore:{type:'material',s:9999,g:2}}},
  realm:()=>realmValue,read:k=>store.get(k)??null,
  write:(k,v)=>{if(write!==true)return false;store.set(k,v);return true;}};
 const bot={p,me:{name:'M',role:'merchant'},session:'new-session',
  cfg:{party:{merchant:'M'},merchant:{bank:true,bankReclaim:true,
   preventiveStorage:true,bankWorkspace:2},production:{
   autoDisposition:false,goals:[],gearTargets:[]}},
  running:true,logistics:{reserved:false},inventoryBlocked:false,
  journal:null,exec:{busy:()=>false},
  free:()=>items.filter(x=>!x).length,
  economy:{
   safe:i=>!!i&&!i.l&&!i.b,
   value:()=>2,explicit:()=>rules?sourceRule:null,
   rules:()=>rules?sourceRule:null,remaining:()=>true,
   count:i=>items.reduce((n,x)=>n+(x?.name===i?.name?(x.q??1):0),0),
   spare:()=>10,note:s=>notes.push(s),
   npcSell:(slot,rule,options)=>{sales.push({slot,rule,options});return true;},
   perform:(kind,args)=>{calls.push({kind,args});return perform;}
  }};
 bot.bank=createBank(bot);
 return {bot,store,calls,sales,notes,bankPack,items,sourceRule};
}
test('W04 restart reconciles untouched bank checkpoint without selling',()=>{
 const f=fixture({saved:record({at:Date.now()})});
 assert.equal(f.bot.inventoryBlocked,false);
 assert.equal(f.bot.bank.pending,true);
 assert.equal(f.bot.bank.recoverCapacity(),true);
 assert.equal(f.bot.bank.pending,false);
 assert.equal(f.store.get('albot:bank-reclaim:M'),null);
 assert.equal(f.sales.length,0);
});
test('W04 restart resumes ONLY the fully observed withdrawn bank item',()=>{
 const f=fixture({saved:record({at:Date.now()}),bankItem:null,carried:{...item}});
 assert.equal(f.bot.bank.recoverCapacity(),true);
 assert.equal(f.sales.length,1);
 assert.equal(f.bot.bank.pending,true,'no confirmation yet');
 assert.equal(f.sales[0].rule._bankExplicitSource,f.sourceRule);
 // Simulate a separate confirmed executor receipt, not an inferred sale.
 assert.equal(f.sales[0].options.onConfirmed(),true);
 assert.equal(f.store.get('albot:bank-reclaim:M').saleConfirmed,true);
 f.items[0]=null;
 assert.equal(f.bot.bank.recoverCapacity(),true);
 assert.equal(f.bot.bank.pending,false);
});
test('W04 a different account realm and legacy unversioned records quarantine',()=>{
 for(const data of [record({at:Date.now(),realm:'US:I'}),
  {...record({at:Date.now()}),version:undefined}]){
  const f=fixture({saved:data});
  assert.equal(f.bot.inventoryBlocked,true);
  assert.equal(f.bot.bank.pending,true);
  assert.equal(f.bot.bank.recoverCapacity(),true);
  assert.equal(f.sales.length,0);
 }
});
test('W04 missing bank pack, altered target or revoked explicit rule never repeat sale',()=>{
 for(const altered of [{bankItem:null,carried:{...item,q:9}},
  {bankItem:{...item,q:8}},
  {bankItem:null,carried:{...item},rules:false}]){
  const f=fixture({saved:record({at:Date.now()}),...altered});
  const prior=f.store.get('albot:bank-reclaim:M');
  f.bot.bank.recoverCapacity();
  assert.equal(f.sales.length,0,JSON.stringify(altered));
  assert.equal(f.bot.bank.pending,true);
  assert.equal(f.store.get('albot:bank-reclaim:M'),prior);
 }
});
test('W04 rejected bank action releases intent only after exact before-image proof',()=>{
 const f=fixture({perform:false});
 f.bot.bank.preventiveDisposition();
 assert.equal(f.bot.bank.preventiveDisposition(),false);
 assert.equal(f.calls.length,1);
 assert.equal(f.bot.bank.pending,false);
 assert.equal(f.store.get('albot:bank-reclaim:M'),null);
});
test('W04 failed checkpoint clear retains conservative block after rejected queue',()=>{
 const f=fixture({perform:false});
 const write=f.bot.p.write;
 let calls=0;
 f.bot.p.write=(k,v)=>++calls===1?write(k,v):false;
 f.bot.bank.preventiveDisposition();
 assert.equal(f.bot.bank.preventiveDisposition(),false);
 assert.equal(f.bot.bank.pending,true);
 assert.equal(f.store.get('albot:bank-reclaim:M').version,2);
});
