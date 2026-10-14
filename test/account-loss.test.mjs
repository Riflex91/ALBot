import test from 'node:test';
import assert from 'node:assert/strict';
import {createAccountLossGuard} from '../src/merchant/account-loss.mjs';
import {createEconomy} from '../src/merchant/economy.mjs';
import {defaultsFor} from '../editor/lib/contract.mjs';
import {FULL_DESCRIPTOR} from '../src/config/full.mjs';
function fixture(){
 const store=new Map(),events=[],cfg=defaultsFor(FULL_DESCRIPTOR.schema);
 cfg.party.merchant='M';cfg.merchant.budgetMode='account-loss';cfg.merchant.offlineGoldBalances=[{name:'O',gold:0}];
 const peer={name:'F',goldBalance:100,running:true,received:Date.now()},rows=[{name:'M',online:1},{name:'F',online:1},{name:'O',online:0}];
 const bot={cfg,me:{name:'M',role:'merchant'},running:true,exec:{},p:{c:{gold:400,slots:{},items:[]},G:{items:{}},read:k=>store.get(k),write:(k,v)=>{store.set(k,structuredClone(v));return true;},call:id=>id==='get_characters'?rows:null},
  transport:{fresh:n=>n==='F'?peer:null},bank:{goldEvidence:()=>({gold:500,at:Date.now()})},event:(...a)=>events.push(a),report(){}};
 bot.lossGuard=createAccountLossGuard(bot);return {bot,peer,store,rows,events};
}
function clock(fn){const original=Date.now;let time=10000000;Date.now=()=>time;try{return fn(ms=>time+=ms);}finally{Date.now=original;}}
test('85 percent of complete account monetary gold trips only after two observations',()=>clock(advance=>{
 const {bot,peer,store}=fixture();bot.lossGuard.sample(true);assert.equal(bot.lossGuard.status().snapshot.total,1000);
 bot.bank.goldEvidence=()=>({gold:50,at:Date.now()});bot.p.c.gold=50;peer.goldBalance=50;
 advance(2000);bot.lossGuard.sample(true);assert.equal(bot.lossGuard.blocked,false);
 advance(2000);bot.lossGuard.sample(true);assert.equal(bot.lossGuard.blocked,true);
 assert.equal(bot.lossGuard.status().trip.peak,1000);assert.equal(store.get('albot:account-loss:M').blocked,true);
 assert.equal(createAccountLossGuard(bot).blocked,true,'reload does not erase the latch');
}));
test('84.9 percent loss and old exposure counters do not trip the cash guard',()=>clock(advance=>{
 const {bot,peer}=fixture();bot.lossGuard.sample(true);bot.bank.goldEvidence=()=>({gold:51,at:Date.now()});bot.p.c.gold=50;peer.goldBalance=50;
 advance(2000);bot.lossGuard.sample(true);advance(2000);bot.lossGuard.sample(true);assert.equal(bot.lossGuard.blocked,false);
}));
test('cash peak expires outside rolling fifteen minute window',()=>clock(advance=>{
 const {bot,peer}=fixture();bot.lossGuard.sample(true);advance(900001);bot.p.c.gold=0;peer.goldBalance=0;bot.bank.goldEvidence=()=>({gold:0,at:Date.now()});
 bot.lossGuard.sample(true);advance(2000);bot.lossGuard.sample(true);assert.equal(bot.lossGuard.blocked,false);
}));
test('unknown offline gold, missing online peer and stale bank are not zeros',()=>clock(()=>{
 for(const missing of ['offline','online','bank','roster']){const {bot}=fixture();if(missing==='offline')bot.cfg.merchant.offlineGoldBalances=[];if(missing==='online')bot.transport.fresh=()=>null;if(missing==='bank')bot.bank.goldEvidence=()=>({gold:0,at:Date.now()-120001});if(missing==='roster')bot.p.call=()=>[{name:'M'},{name:null}];
  bot.lossGuard.sample(true);assert.equal(bot.lossGuard.status().snapshot.complete,false,missing);assert.equal(bot.lossGuard.blocked,false,missing);}
}));
test('internal transfers skip inconsistent balances and cannot manufacture a peak',()=>clock(advance=>{
 const {bot,peer}=fixture();bot.lossGuard.sample(true);peer.goldTransferPending=true;bot.p.c.gold=500;bot.lossGuard.sample(true);assert.equal(bot.lossGuard.status().snapshot.reason,'value-transfer-in-flight');
 peer.goldTransferPending=false;peer.goldTransferAt=Date.now();peer.goldBalance=0;advance(2000);bot.lossGuard.sample(true);assert.equal(bot.lossGuard.status().snapshot.complete,false);
 advance(30001);bot.lossGuard.sample(true);assert.equal(bot.lossGuard.status().snapshot.total,1000);assert.equal(bot.lossGuard.blocked,false);
}));
test('last observed offline balance supersedes initial zero seed after logout',()=>clock(advance=>{
 const {bot,peer,rows}=fixture();rows[2].online=1;bot.transport.fresh=n=>n==='F'?peer:n==='O'?{goldBalance:200,running:true}:null;
 bot.lossGuard.sample(true);assert.equal(bot.lossGuard.status().snapshot.total,1200);rows[2].online=0;bot.transport.fresh=n=>n==='F'?peer:null;advance(2000);bot.lossGuard.sample(true);assert.equal(bot.lossGuard.status().snapshot.total,1200);
}));
test('paused peers still provide cash evidence for a manual release',()=>clock(advance=>{
 const {bot,peer}=fixture();bot.lossGuard.sample(true);bot.p.c.gold=0;peer.goldBalance=0;bot.bank.goldEvidence=()=>({gold:0,at:Date.now()});advance(2000);bot.lossGuard.sample(true);advance(2000);bot.lossGuard.sample(true);
 assert.throws(()=>bot.lossGuard.reset(),/pausierten/);bot.running=false;peer.running=false;advance(2000);assert.equal(bot.lossGuard.reset(),true);assert.equal(bot.lossGuard.blocked,false);
}));
test('farmer latch propagates and can only be cleared by an explicit newer owner reset',()=>clock(advance=>{
 const {bot}=fixture();bot.me.name='F';let g={blocked:true,trip:{at:Date.now()}};bot.transport.fresh=()=>({accountLossGuard:g});bot.lossGuard=createAccountLossGuard(bot);bot.lossGuard.sample();assert.equal(bot.lossGuard.blocked,true);
 g={blocked:false,resetAt:0};bot.lossGuard.sample();assert.equal(bot.lossGuard.blocked,true);advance(2000);g.resetAt=Date.now();bot.lossGuard.sample();assert.equal(bot.lossGuard.blocked,false);
}));
test('account-loss mode bypasses hourly, item, account share and goal money caps but requires payable cash',()=>{
 const {bot,store}=fixture();store.set('albot:economy:M:budget',{hour:Date.now(),spent:999999999,loss:999999999,goals:{},productionExposure:999999999});
 bot.account={spendAllowed:()=>false};bot.production={activeGoal:{name:'G',budget:0}};const e=createEconomy(bot),r={goldBudget:0,lossBudget:0,_autoProduction:true};
 assert.equal(e.budget(100,500000,r),true);assert.equal(e.budget(401,0,r),false);assert.equal(e.budget(0,0,r),true);
 bot.p.c.slots.trade1={b:true,price:350,q:1};assert.equal(e.budget(100,0,r),false);
});
test('bounded mode preserves the previous hourly budgets',()=>{
 const {bot}=fixture();bot.cfg.merchant.budgetMode='bounded';bot.cfg.merchant.maxSpendPerHour=0;assert.equal(createEconomy(bot).budget(1,0),false);
});
test('actual irreversible dispatch bypasses exhausted goal and legacy variant ledger',()=>{
 const {bot,store}=fixture();store.set('albot:economy:M:budget',{hour:Date.now(),spent:999999,loss:999999,productionExposure:999999,goals:{},itemRisk:Object.fromEntries(Array.from({length:128},(_,i)=>['old'+i,1])),riskStart:Date.now()});
 bot.checkpoint={durable:true};bot.logistics={reserved:false};bot.production={activeGoal:{name:'G',item:'ring',level:1,quantity:1,recipient:'',budget:0},owns:()=>true};bot.beginValue=j=>{bot.journal=j;};bot.endValue=()=>{};
 let dispatched=0;bot.exec={busy:()=>false,run:(key,res,guard,call)=>{if(!guard())return false;call();return true;}};
 const e=createEconomy(bot);assert.equal(e.perform('compound',{cost:10,loss:500000,rule:{name:'R',_autoProduction:true,goldBudget:0,lossBudget:0},details:{item:'ring',riskVariant:'new'},call:()=>dispatched++}),true);
 assert.equal(dispatched,1);assert.equal(bot.journal.kind,'compound');assert.equal(e.ledger.productionExposure,1500009);
});
test('equip and other value actions cannot cancel Town before enqueue or at final dispatch',()=>{
 const {bot}=fixture();bot.movement={townActive:true};bot.exec={pending:new Map()};const e=createEconomy(bot);
 assert.equal(e.perform('gear.equip',{call:()=>assert.fail('Town would be cancelled')}),false);
 bot.movement.townActive=false;bot.checkpoint={durable:true};bot.logistics={reserved:false};let finalGuard;
 bot.exec.busy=()=>false;bot.exec.run=(key,res,guard)=>{finalGuard=guard;return true;};
 assert.equal(e.perform('gear.equip',{call:()=>assert.fail('must remain queued')}),true);
 bot.movement.townActive=true;assert.equal(finalGuard(),false);
});
