import test from 'node:test';
import assert from 'node:assert/strict';
import {bankGoldTransferPlan,createBank} from '../src/merchant/bank.mjs';

const plan=(overrides={})=>bankGoldTransferPlan({
 wallet:1000,bankGold:8000,goldTarget:500,goldReserve:200,
 characterReserve:150,slots:{trade1:{b:true,price:250,q:4}},
 ...overrides
});

test('W03 open player buy bids are physical obligations before bank gold deposit',()=>{
 const result=plan();
 assert.deepEqual(result,{method:'bank_withdraw',quantity:500,
  target:1500,committed:1000});
 assert.deepEqual(plan({wallet:2500}),{method:'bank_deposit',
  quantity:1000,target:1500,committed:1000});
 assert.equal(plan({wallet:1500}),null,'exact working target needs no transfer');
 assert.deepEqual(plan({bankGold:200}),{method:'bank_withdraw',
  quantity:200,target:1500,committed:1000});
});

test('W03 malformed bids fail closed, rather than silently erasing gold commitments',()=>{
 const corrupt=[
  {price:'250',q:4},{price:250,q:'4'},{price:null,q:4},
  {price:0,q:4},{price:0.5,q:4},{price:-250,q:4},
  {price:250,q:0},{price:250,q:-1},{price:250,q:1.1},
  {price:Number.MAX_SAFE_INTEGER,q:2}
 ];
 for(const bid of corrupt)
  assert.equal(plan({slots:{trade1:{b:true,...bid}}}),null,
   'invalid trade bid must prevent a money transfer: '+JSON.stringify(bid));
 for(const key of ['wallet','bankGold','goldTarget','goldReserve','characterReserve'])
  for(const invalid of [-1,0.5,NaN,Infinity,'100'])
   assert.equal(plan({[key]:invalid}),null,key+' invalid='+invalid);
 assert.equal(plan({slots:null}),null);
 assert.equal(plan({slots:[]}),null);
});

test('W03 sixteen legal bid slots accumulate safely and only buy offers reserve cash',()=>{
 const slots=Object.fromEntries(Array.from({length:16},(_,n)=>
  ['trade'+(n+1),{b:true,price:10,q:2}]));
 slots.trade9={b:false,price:1000000,q:10};
 slots.inventory={b:true,price:1000000,q:10};
 const result=plan({slots});
 assert.equal(result.committed,300);
 assert.equal(result.target,800);
 assert.equal(result.quantity,200);
 assert.equal(result.method,'bank_deposit');
 assert.equal(plan({slots:{trade16:{b:true,price:Number.MAX_SAFE_INTEGER,q:1}},
  goldTarget:10,goldReserve:0,characterReserve:0}),null,
  'a mathematically overflowed cash target must not be used');
});

function fixture({map='bank',wallet=1000,bankGold=8000,slots}={}){
 const calls=[],api=[],items=Array(42).fill(null),packs=Array(42).fill(null);
 const c={map,name:'M',gold:wallet,items,bank:{gold:bankGold,items0:packs},
  slots:slots??{trade1:{b:true,price:250,q:4}}};
 const p={c,G:{items:{}},realm:()=> 'EUI',read:()=>null,
  write:()=>true,call:(method,quantity)=>{api.push({method,quantity});
   return Promise.resolve({success:true});}};
 const bot={p,me:{name:'M',role:'merchant',goldReserve:150},
  cfg:{party:{merchant:'M'},merchant:{bank:true,bankGold:true,
   goldTarget:500,goldReserve:200}},session:'M:1',running:true,
  inventoryBlocked:false,journal:null,logistics:{reserved:false},
  economy:{safe:()=>true,note:()=>{},
   perform:(kind,params)=>{calls.push({kind,params});return true;}},
  exec:{busy:()=>false},free:()=>42};
 bot.bank=createBank(bot);
 return {bot,p,c,calls,api};
}

test('W03 actual bank gold dispatch and confirmation are tied to exact observed balances',async()=>{
 const {bot,c,calls,api}=fixture();
 assert.equal(bot.bank.gold(),true);
 assert.equal(calls.length,1);
 assert.equal(calls[0].kind,'bank.gold');
 const params=calls[0].params;
 assert.equal(params.guard(),true);
 await params.call();
 assert.deepEqual(api,[{method:'bank_withdraw',quantity:500}]);
 c.gold+=500;c.bank.gold-=500;
 assert.equal(params.observe(),true);
 assert.equal(bot.bank.gold(),false,'no duplicate transfer after observed target');
});

test('W03 late bid increase, cancellation, changed balance or bank map revoke dispatch',()=>{
 for(const change of [
  c=>{c.slots.trade1.price=300;},
  c=>{c.slots.trade1=null;},
  c=>{c.slots.trade1.q=5;},
  c=>{c.gold+=1;},
  c=>{c.bank.gold-=1;},
  c=>{c.map='main';},
  c=>{c.bank.items0=null;}
 ]){
  const {bot,c,calls,api}=fixture();
  assert.equal(bot.bank.gold(),true);
  change(c);
  assert.equal(calls[0].params.guard(),false,
   'late drift must stop the bank value action');
  assert.deepEqual(api,[]);
 }
});

test('W03 off-map cached bank balance, corrupt bank gold or inactive owner never dispatch',()=>{
 for(const opts of [{map:'main'},{bankGold:10.5},{wallet:NaN}]){
  const {bot,calls}=fixture(opts);
  assert.equal(bot.bank.gold(),false);
  assert.equal(calls.length,0);
 }
 const other=fixture();other.bot.cfg.party.merchant='SomeoneElse';
 assert.equal(other.bot.bank.gold(),false);
 const disabled=fixture();disabled.bot.cfg.merchant.bankGold=false;
 assert.equal(disabled.bot.bank.gold(),false);
});
