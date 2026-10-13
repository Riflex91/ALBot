import test from 'node:test';
import assert from 'node:assert/strict';
import {bankExpansionRemaining,createEconomy} from '../src/merchant/economy.mjs';
import {createBank} from '../src/merchant/bank.mjs';

function fixture({spent=0,bankBudget=150,costs=[100,100],ledgerHour=Date.now()}={}){
 const saved=new Map(),actions=[],notes=[];
 const me={name:'Merchant',role:'merchant',goldReserve:0};
 const c={name:'Merchant',map:'bank',in:'bank',items:Array(42).fill(null),
  slots:{},bank:{},gold:1000,rip:false};
 const G={items:{},bank_packs:Object.fromEntries(costs.map((cost,i)=>
  ['items'+i,['bank',cost]]))};
 const ledgerKey='albot:economy:Merchant:budget';
 saved.set(ledgerKey,{hour:ledgerHour,spent:0,loss:0,bankSpent:spent,goals:{}});
 const p={c,G,read:k=>saved.get(k)??null,write:(k,v)=>{saved.set(k,v);return true;},
  realm:()=> 'EU:II',call:(id,pack,currency)=>{
   if(id!=='open_bank_pack')return null;
   assert.equal(currency,'gold');
   const cost=G.bank_packs[pack][1];
   actions.push({pack,cost});
   c.bank[pack]=Array(42).fill(null);
   c.gold-=cost;
   return {success:true};
  }};
 const cfg={party:{merchant:'Merchant'},merchant:{
  enabled:true,bank:true,expandBank:true,bankBudget,maxSpendPerHour:10000,
  goldReserve:0,bankExpandGoldFraction:.75,bankWorkspace:2
 },general:{economyTickMs:1000},production:{lossBudget:10000,goals:[]},
 items:[]};
 const bot={p,cfg,me,running:true,checkpoint:{durable:true},journal:null,
  inventoryBlocked:false,logistics:{reserved:false},
  report:s=>notes.push(s),reason:'',recovery:{authorize:()=>true},
  content:{approve:()=>true},account:{spendAllowed:()=>true},
  beginValue(row){this.journal=row;},endValue(){this.journal=null;}};
 bot.exec={busy:()=>false,run:(kind,locks,guard,call,{onSettle}={})=>{
  if(!guard())return false;
  call();onSettle?.('confirmed');
  return true;
 }};
 function reload(){
  bot.economy=createEconomy(bot);
  bot.bank=createBank(bot);
 }
 reload();
 return {bot,c,G,saved,ledgerKey,actions,notes,reload};
}

test('remaining bank budget is cumulative, bounded and fails closed on corrupt ledger fields',()=>{
 assert.equal(bankExpansionRemaining(150,100),50);
 assert.equal(bankExpansionRemaining(150,150),0);
 assert.equal(bankExpansionRemaining(150,151),0);
 assert.equal(bankExpansionRemaining(150),150);
 assert.equal(bankExpansionRemaining(150,-1),0);
 assert.equal(bankExpansionRemaining(150,'100'),0);
 assert.equal(bankExpansionRemaining(Infinity,10),0);
 assert.equal(bankExpansionRemaining(10,NaN),0);
});

test('bank skips individually affordable pack when cumulative expansion budget is exhausted',()=>{
 const {bot,c,actions,saved,ledgerKey}=fixture({spent:100,bankBudget:150,costs:[100,120]});
 assert.equal(bot.economy.bankExpansionAvailable(100),false);
 assert.equal(bot.bank.expand(),false);
 assert.deepEqual(actions,[]);
 assert.deepEqual(Object.keys(c.bank),[]);
 assert.equal(saved.get(ledgerKey).bankSpent,100);
});

test('successful opening debits durable total once and never queues a second unaffordable pack',()=>{
 const f=fixture({bankBudget:150,costs:[100,100]});
 assert.equal(f.bot.bank.expand(),true);
 assert.deepEqual(f.actions,[{pack:'items0',cost:100}]);
 assert.equal(f.saved.get(f.ledgerKey).bankSpent,100);
 assert.equal(f.bot.bank.expand(),false,'a second 100g purchase would exceed the 150g total');
 assert.equal(f.actions.length,1);
 assert.ok(f.notes.some(note=>note.includes('kumulatives Goldbudget')));
 f.reload();
 assert.equal(f.bot.economy.bankExpansionAvailable(100),false);
 assert.equal(f.bot.bank.expand(),false,'reload may not reset expansion spending');
 assert.equal(f.actions.length,1);
});

test('ordinary hourly budget rollover preserves total bank expansion spending',()=>{
 const f=fixture({spent:110,bankBudget:150,ledgerHour:Date.now()-3600001,costs:[80]});
 assert.equal(f.bot.economy.bankExpansionAvailable(80),false);
 assert.equal(f.bot.economy.budget(0),true);
 assert.equal(f.bot.economy.ledger.bankSpent,110);
 assert.equal(f.saved.get(f.ledgerKey).bankSpent,110);
 assert.equal(f.bot.bank.expand(),false);
 assert.deepEqual(f.actions,[]);
});

test('bank pack cost/map drift between scheduling and dispatch fails closed',()=>{
 const f=fixture({bankBudget:300,costs:[100]});
 let pending=null;
 f.bot.exec.run=(kind,locks,guard,call,opts)=>{pending={kind,guard,call,opts};return true;};
 assert.equal(f.bot.bank.expand(),true);
 assert.equal(pending.kind,'bank.expand');
 f.G.bank_packs.items0[1]=200;
 assert.equal(pending.guard(),false);
 assert.deepEqual(f.actions,[]);
 assert.equal(f.saved.get(f.ledgerKey).bankSpent,0);
});
