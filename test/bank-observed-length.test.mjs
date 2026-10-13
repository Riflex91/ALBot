import test from 'node:test';
import assert from 'node:assert/strict';
import {createBank} from '../src/merchant/bank.mjs';

function fixture(bankPacks){
 const performed=[],notes=[],writes=[];
 const c={name:'Merchant',map:'bank',in:'bank',items:Array(42).fill(null),
  bank:bankPacks,slots:{},gold:1000,rip:false};
 const cfg={party:{merchant:'Merchant'},merchant:{
  bank:true,bankWorkspace:0,expandBank:false,bankReclaim:false,
  consolidate:false,partialBank:false},production:{autoDisposition:false}};
 const e={safe:i=>!!i&&!i.l&&!i.b,spare:()=>1,
  explicit:()=>null,note:msg=>notes.push(msg),travel:()=>true,
  perform:(kind,opts)=>{
   if(!opts.guard?.())return false;
   performed.push({kind,...opts.details});
   return true;
  }};
 const p={c,G:{items:{mat:{s:9999},other:{s:9999}},
  bank_packs:{items0:['bank',100],items1:['bank',100]}},
  root:{},parent:{},read:()=>null,write:(k,v)=>{writes.push(k);return true;},
  realm:()=> 'EU:II'};
 const bot={p,cfg,me:{name:'Merchant',role:'merchant'},
  economy:e,inventoryBlocked:false,journal:null,decisionEpoch:1,
  logistics:{reserved:false},free:()=>c.items.filter(x=>!x).length};
 const bank=createBank(bot);bot.bank=bank;
 return {bank,c,cfg,p,e,performed,notes,writes,bot};
}
test('short bank arrays report only observed physical slot capacity',()=>{
 const f=fixture({items0:[{name:'other',q:1},null,{name:'mat',q:3}],items1:[]});
 const rows=f.bank.capacity();
 assert.deepEqual(rows.map(r=>[r.pack,r.size,r.used,r.free]),
  [['items0',3,2,1],['items1',0,0,0]]);
 assert.equal(rows.reduce((n,r)=>n+r.free,0),1,'cannot invent 82 additional bank slots');
});
test('sparse array holes within known length are counted as empty, without enlargement',()=>{
 const sparse=Array(4);sparse[1]={name:'mat',q:1};
 const f=fixture({items0:sparse});
 assert.deepEqual(f.bank.capacity().map(r=>[r.size,r.used,r.free]),[[4,1,3]]);
 assert.equal(f.bank.packs()[0][1].length,4);
 assert.equal(f.bank.packs()[0][1].filter(i=>!i).length,3);
});
test('full 42-slot observation retains native capacity and no phantom free cells',()=>{
 const items=Array.from({length:42},(_,n)=>({name:'other',level:0,q:1,data:{n}}));
 const f=fixture({items0:items});
 assert.deepEqual(f.bank.capacity().map(r=>[r.size,r.used,r.free]),[[42,42,0]]);
 assert.equal(f.bank.packs()[0][1].length,42);
});
test('bank store fails closed when observed pack has no physical destination',()=>{
 const f=fixture({items0:[{name:'other',q:1}],items1:[]});
 f.c.items[0]={name:'mat',q:1};
 const rule={name:'Bank mat',item:'mat',action:'bank',batch:1,keep:0,teamReserve:0,pack:'items0'};
 assert.equal(f.bank.store(0,rule),false);
 assert.deepEqual(f.performed,[]);
 assert.equal(f.c.items[0].name,'mat');
});
test('bank store chooses only a live proven vacant slot in the observed range',()=>{
 const f=fixture({items0:[{name:'other',q:1},null]});
 f.c.items[0]={name:'mat',q:1};
 const rule={name:'Bank mat',item:'mat',action:'bank',batch:1,keep:0,teamReserve:0,pack:'items0'};
 assert.equal(f.bank.store(0,rule),true);
 assert.deepEqual(f.performed.map(x=>[x.kind,x.pack,x.bankSlot]),
  [['bank.store','items0',1]]);
});
