import test from 'node:test';
import assert from 'node:assert/strict';
import {scanBankDispositionWindow} from '../src/merchant/bank-disposition.mjs';
import {createBank} from '../src/merchant/bank.mjs';
import {createEconomy} from '../src/merchant/economy.mjs';
import {ITEM_RULE} from '../editor/lib/schema.mjs';
import {defaultsFor} from '../editor/lib/contract.mjs';

const ring={name:'ore',level:0,q:10};
const blank=()=>Array.from({length:42},()=>null);
const packMap=name=>name==='items2'?'bank_b':'bank';

test('W04 bank scan advances in finite windows without skipping pack boundaries',()=>{
 const a=blank(),b=blank(),remote=blank();
 a[25]={...ring,q:2};b[0]={...ring,q:3};remote[0]={...ring,q:4};
 const packs=[['items0',a],['items1',b],['items2',remote]];
 const seen=[];
 let scan=scanBankDispositionWindow(packs,{map:'bank',packMap,
  cursor:0,limit:24,admit:(item,pack,slot)=>{
   seen.push([pack,slot]);return {price:1};
  }});
 assert.equal(scan.valid,true);
 assert.equal(scan.total,84);
 assert.equal(scan.nextCursor,24);
 assert.equal(scan.candidates.length,0);
 scan=scanBankDispositionWindow(packs,{map:'bank',packMap,
  cursor:scan.nextCursor,limit:24,admit:(item,pack,slot)=>{
   seen.push([pack,slot]);return {price:1};
  }});
 assert.deepEqual(scan.candidates.map(x=>[x.pack,x.slot]),
  [['items0',25],['items1',0]]);
 scan=scanBankDispositionWindow(packs,{map:'bank',packMap,
  cursor:scan.nextCursor,limit:36,admit:()=>null});
 assert.equal(scan.complete,true);
 assert.equal(scan.nextCursor,84);
 assert.deepEqual(seen,[['items0',25],['items1',0]]);
});
test('W04 empty newly opened pack still has 42 logical scan positions',()=>{
 const scan=scanBankDispositionWindow([['items0',[]]],{map:'bank',packMap,
  limit:42});
 assert.equal(scan.valid,true);
 assert.equal(scan.total,42);
 assert.equal(scan.complete,true);
 assert.equal(scan.scanned,42);
});
test('W04 remote bank packs never contribute an actionable local candidate',()=>{
 const remote=blank();remote[0]=ring;
 const result=scanBankDispositionWindow([['items2',remote]],{
  map:'bank',packMap,admit:()=>{throw Error('remote candidate evaluated');}
 });
 assert.equal(result.valid,false);
 assert.equal(result.reason,'no-observed-local-packs');
});
test('W04 malformed bank packs or scan bounds fail closed',()=>{
 const bad=[
  [[['items0',blank()],['items0',blank()]],'invalid-bank-pack'],
  [[['items0',Array(43).fill(null)]],'invalid-bank-pack'],
  [[['not-a-pack',blank()]],'invalid-bank-pack']
 ];
 for(const [rows,reason] of bad){
  const result=scanBankDispositionWindow(rows,{map:'bank',packMap});
  assert.equal(result.valid,false);
  assert.equal(result.reason,reason);
 }
 assert.equal(scanBankDispositionWindow([['items0',blank()]],{
  map:'bank',packMap,cursor:43}).valid,false);
 assert.equal(scanBankDispositionWindow([['items0',blank()]],{
  map:'bank',packMap,limit:65}).valid,false);
 assert.equal(scanBankDispositionWindow([['items0',blank()]],{
  map:'bank',packMap:()=>null}).valid,false);
});

function fixture({item={...ring},enabled=true,explicit=true,stored=true,
 map='bank',write=true}={}){
 const inv=blank(),bankPack=blank();
 bankPack[27]=item;
 const sell={enabled:true,action:'sell',item:'ore',batch:99,maxCount:9999,
  keep:0,teamReserve:0,minPrice:0,maxActions:0};
 let rule=explicit?sell:null;
 const calls=[],writes=[],sales=[];
 const bot={
  p:{c:{items:inv,map,bank:{items0:bankPack},gold:100000,slots:{}},
    G:{items:{ore:{type:'material',g:2,s:9999}}},
    realm:()=> 'EU:I',read:()=>null,
    write:(key,value)=>{writes.push([key,value]);return write;}},
  cfg:{merchant:{bank:true,bankReclaim:true,preventiveStorage:enabled,
    bankWorkspace:2},party:{merchant:'M'},production:{
    goals:[],gearTargets:[],autoDisposition:false}},
  me:{name:'M'},
  economy:{
   safe:i=>!!i&&!i.l&&!i.b&&!i.locked,
   value:()=>2,explicit:()=>rule,rules:()=>rule,
   remaining:()=>true,count:item=>inv.reduce((n,i)=>n+(i?.name===item?.name?(i.q??1):0),0),spare:()=>99,
   note:()=>{},npcSell:(slot,rule)=>{sales.push({slot,rule});return true;},
   perform:(kind,params)=>{calls.push({kind,params});return true;}
  },
  exec:{busy:()=>false},
  logistics:{reserved:false},running:true,inventoryBlocked:false,
  journal:null,free:()=>inv.filter(i=>!i).length,
  session:'m-01'
 };
 bot.bank=createBank(bot);
 return {bot,calls,writes,sales,setRule:r=>{rule=r;},bankPack,inv,sell};
}
test('W04 only explicit currently permitted plain bank assets enter preventive reclaim',()=>{
 const {bot,calls,bankPack}=fixture();
 assert.equal(bot.bank.preventiveDisposition(),false);
 assert.equal(bot.bank.preventiveStatus().checked,24);
 assert.equal(calls.length,0,'a partial scan never authorizes withdrawal');
 assert.equal(bot.bank.preventiveDisposition(),true,JSON.stringify(bot.bank.preventiveStatus()));
 assert.equal(bot.bank.preventiveStatus().checked,42);
 assert.equal(bot.bank.preventiveStatus().complete,true);
 assert.equal(bot.bank.pending,true,'a durable reclaim state prevents parallel work');
 assert.equal(calls.length,1);
 assert.equal(calls[0].kind,'bank.reclaim');
 assert.equal(calls[0].params.guard(),true);
 assert.equal(calls[0].params.details.reason,
  'Vorbeugend: explizite Bank-Verkaufsregel');
 assert.equal(bankPack[27].name,'ore','preview/dispatch does not invent success');
});
test('W04 late sell-rule revocation blocks already staged withdrawal dispatch',()=>{
 const {bot,calls,setRule}=fixture();
 bot.bank.preventiveDisposition();
 assert.equal(bot.bank.preventiveDisposition(),true,JSON.stringify(bot.bank.preventiveStatus()));
 setRule(null);
 assert.equal(calls[0].params.guard(),false);
});
test('W04 never auto-sells without explicit rule or when protected',()=>{
 for(const options of [{explicit:false},{item:{...ring,l:true}},
  {item:{...ring,stat_type:'int'}},{enabled:false}]){
  const {bot,calls}=fixture(options);
  for(let i=0;i<4;i++)bot.bank.preventiveDisposition();
  assert.equal(calls.length,0);
  assert.equal(bot.bank.pending,false);
 }
});
test('W04 a retained off-map bank object is not fresh sale authority',()=>{
 const {bot,calls}=fixture({map:'main'});
 for(let i=0;i<4;i++)bot.bank.preventiveDisposition();
 assert.equal(calls.length,0);
 assert.equal(bot.bank.pending,false);
});
test('W04 a failed durable pre-withdraw record cannot trigger a bank operation',()=>{
 const {bot,calls}=fixture({write:false});
 bot.bank.preventiveDisposition();
 assert.equal(bot.bank.preventiveDisposition(),false);
 assert.equal(calls.length,0);
 assert.equal(bot.bank.pending,false);
});

test('W04 a revoked explicit bank sale does not resume via emergency auto-sale',()=>{
 const {bot,inv,bankPack,setRule,sales}=fixture();
 bot.bank.preventiveDisposition();
 assert.equal(bot.bank.preventiveDisposition(),true);
 inv[0]={...ring};bankPack[27]=null;setRule(null);
 bot.cfg.production.autoDisposition=true;
 bot.cfg.production.autoSellMaxValue=100;
 assert.equal(bot.bank.recoverCapacity(),true);
 assert.equal(sales.length,0,'recovery must not downgrade to autogenerated sale');
 assert.equal(bot.bank.pending,true,'unconfirmed value path stays blocked');
});
test('W04 the observed bank receipt retains explicit provenance for NPC sale',()=>{
 const {bot,inv,bankPack,sales,sell}=fixture();
 bot.bank.preventiveDisposition();
 assert.equal(bot.bank.preventiveDisposition(),true);
 inv[0]={...ring};bankPack[27]=null;
 assert.equal(bot.bank.recoverCapacity(),true);
 assert.equal(sales.length,1);
 assert.equal(sales[0].rule._bankExplicitSource,sell);
});
test('W04 final economy guard cancels queued NPC sale after rule revocation',()=>{
 const source={...defaultsFor(ITEM_RULE),enabled:true,
  name:'User rule',item:'ore',role:'all',action:'sell',
  minLevel:0,maxLevel:99,batch:10,keep:0,teamReserve:0};
 const inv=[{name:'ore',level:0,q:10}],cfg={
  items:[source],merchant:{maxSpendPerHour:100000,budgetMode:'bounded'},
  production:{lossBudget:100000}};
 const p={c:{items:inv,map:'bank',gold:10000},read:()=>null,
  G:{items:{ore:{g:2,type:'material',s:9999}}},realm:()=> 'EU:I'};
 const bot={p,cfg,me:{name:'M',role:'merchant'},task:()=> 'supply'};
 const economy=createEconomy(bot);
 const staged={...source,_bankExplicitSource:source};
 assert.equal(economy.spare(0,staged),10);
 cfg.items=[];
 assert.equal(economy.spare(0,staged),0);
});

function operatingBankFixture(){
 const f=fixture({item:{name:'scroll0',q:20},explicit:false});
 const {bot,inv,bankPack}=f;
 bot.me.role='merchant';bot.farmers=['A','B','C'];
 bot.cfg.merchant.enabled=true;bot.cfg.production.enabled=true;
 bot.cfg.production.autoDisposition=true;
 bot.p.G.items.scroll0={type:'uscroll',g:1000,s:9999};
 bot.economy.npcFor=()=>({map:'main',x:0,y:0});
 bot.economy.travel=()=>true;
 inv[1]={name:'scroll0',q:100};
 bot.p.call=(name,pack,slot,dest)=>{
  assert.equal(name,'bank_retrieve');inv[dest]=bankPack[slot];bankPack[slot]=null;
  return Promise.resolve({success:true});
 };
 return f;
}
test('W04 regular bank scan stages NPC-replaceable excess only against a carried reserve',()=>{
 const {bot,calls,inv}=operatingBankFixture();
 bot.bank.preventiveDisposition();
 assert.equal(bot.bank.preventiveDisposition(),true);
 assert.equal(calls[0].kind,'bank.reclaim');
 assert.equal(calls[0].params.guard(),true);
 inv[1].q=99;
 assert.equal(calls[0].params.guard(),false,'late reserve drift blocks withdrawal');
});
test('W04 staged operating stock keeps the physical floor through withdrawal and NPC continuation',async()=>{
 const {bot,calls,sales,inv}=operatingBankFixture();
 bot.bank.preventiveDisposition();bot.bank.preventiveDisposition();
 await calls[0].params.call();
 assert.equal(inv[0].q,20);assert.equal(inv[1].q,100);
 assert.equal(bot.bank.recoverCapacity(),true);
 assert.equal(sales.length,1);assert.equal(sales[0].rule._bankOperatingStock,true);
 assert.equal(sales[0].rule.keep,100);
});
test('W04 new reservation after withdrawal rolls back instead of selling against cached bank copies',async()=>{
 const {bot,calls,sales,inv}=operatingBankFixture();
 bot.bank.preventiveDisposition();bot.bank.preventiveDisposition();
 await calls[0].params.call();bot.production={reservedQuantity:()=>1,reserved:()=>true};
 bot.bank.recoverCapacity();
 assert.equal(sales.length,0);
 assert.equal(calls.at(-1).kind,'bank.store');
 assert.equal(calls.at(-1).params.guard(),true);
});

test('W04 unexplained reserve-stock drift after withdrawal remains quarantined instead of guessing a rollback',async()=>{
 const {bot,calls,sales,inv}=operatingBankFixture();
 bot.bank.preventiveDisposition();bot.bank.preventiveDisposition();
 await calls[0].params.call();inv[1].q=99;
 bot.bank.recoverCapacity();
 assert.equal(sales.length,0);assert.equal(calls.length,1);
 assert.equal(bot.bank.pending,true);
 assert.equal(bot.bank.recoveryStatus().requiresManualReview,true);
});


test('W04 reserve staging withdraws a protected full stack before a separate bank sale',async()=>{
 const {bot,calls,inv,bankPack,sales}=operatingBankFixture();
 inv[1].q=20;
 bankPack[26]={name:'scroll0',q:80};
 // First scan must prefer the 80-unit floor restoration, not the 20-unit sale.
 assert.equal(bot.bank.preventiveDisposition(),false);
 assert.equal(bot.bank.preventiveDisposition(),true);
 assert.equal(calls[0].kind,'bank.retrieve');
 assert.equal(bot.bank.recoveryStatus().single.reserveStage.floor,100);
 assert.equal(calls[0].params.guard(),true);
 await calls[0].params.call();
 assert.equal(bot.bank.recover(),true);
 assert.equal(bot.bank.pending,false);
 // The remaining bank stack is now saleable only because 100 units are
 // physically present in the inventory, not because a bank catalog says so.
 assert.equal(inv[1].q,20);
 assert.equal(inv[0].q,80);
 assert.equal(bankPack[26],null);
 assert.equal(bot.bank.preventiveDisposition(),false);
 assert.equal(bot.bank.preventiveDisposition(),true);
 assert.equal(calls.at(-1).kind,'bank.reclaim');
 assert.equal(calls.at(-1).params.guard(),true);
 assert.equal(sales.length,0,'no NPC sale before observed sale withdrawal');
});
test('W04 reserve staging cannot dispatch after late physical-floor drift',()=>{
 const {bot,calls,inv,bankPack}=operatingBankFixture();
 inv[1].q=20;
 bankPack[26]={name:'scroll0',q:80};
 bot.bank.preventiveDisposition();
 assert.equal(bot.bank.preventiveDisposition(),true);
 assert.equal(calls[0].kind,'bank.retrieve');
 inv[1].q=100;
 assert.equal(calls[0].params.guard(),false);
});
test('W04 reserve staging never relocates the last protected bank stack',()=>{
 const {bot,calls,inv,bankPack}=operatingBankFixture();
 inv[1].q=20;bankPack[27]={name:'scroll0',q:80};
 for(let n=0;n<4;n++)bot.bank.preventiveDisposition();
 assert.equal(calls.length,0);
});


// W04 remaining reserve case: a single oversized bank stack must use the
// ALREADY journaled retrieve -> split -> return route, never sell it directly.
function partialReserveFixture(){
 const f=operatingBankFixture(),{bot,inv,bankPack}=f;
 bot.cfg.merchant.partialBank=true;
 bot.cfg.merchant.partialBankMaxStack=9999;
 inv[1]={name:'scroll0',q:20};
 bankPack[27]={name:'scroll0',q:200};
 const api=[];
 bot.p.call=(method,...args)=>{
  api.push([method,...args]);
  if(method==='bank_retrieve'){
   const [pack,slot,dest]=args;
   assert.equal(pack,'items0');
   assert.equal(inv[dest],null);
   inv[dest]={...bankPack[slot]};bankPack[slot]=null;
  }else if(method==='split'){
   const [slot,q]=args;
   const dest=inv.findIndex(i=>!i);
   assert.ok(dest>=0);
   inv[dest]={...inv[slot],q};
   inv[slot]={...inv[slot],q:inv[slot].q-q};
  }else if(method==='bank_store'){
   const [slot,pack,dest]=args;
   assert.equal(pack,'items0');
   assert.equal(bankPack[dest],null);
   bankPack[dest]={...inv[slot]};inv[slot]=null;
  }else throw Error('unexpected API '+method);
  return Promise.resolve({success:true});
 };
 return {...f,api};
}
test('W04 partial reserve stages only missing units and restores bank remainder',async()=>{
 const {bot,calls,inv,bankPack,sales,api}=partialReserveFixture();
 assert.equal(bot.bank.preventiveDisposition(),false);
 assert.equal(bot.bank.preventiveDisposition(),true);
 assert.equal(calls[0].kind,'bank.partial.retrieve');
 assert.equal(calls[0].params.guard(),true);
 assert.equal(bot.bank.recoveryStatus().partial.quantity,80);
 await calls[0].params.call();
 assert.equal(bot.bank.recover(),true);
 assert.equal(calls.at(-1).kind,'bank.partial.split');
 assert.equal(calls.at(-1).params.guard(),true);
 await calls.at(-1).params.call();
 assert.equal(bot.bank.recover(),true);
 assert.equal(calls.at(-1).kind,'bank.partial.return');
 assert.equal(calls.at(-1).params.guard(),true);
 await calls.at(-1).params.call();
 assert.equal(bot.bank.recover(),true);
 assert.equal(bot.bank.pending,false);
 assert.deepEqual(api.map(c=>c[0]),['bank_retrieve','split','bank_store']);
 assert.equal(inv[1].q,20);
 assert.equal(inv[2].q,80);
 assert.equal(bankPack[27].q,120);
 assert.equal(sales.length,0,'partial reserve staging never performs an NPC sale');
 // Separate new scan, using current physical reserve and live bank state.
 assert.equal(bot.bank.preventiveDisposition(),false);
 assert.equal(bot.bank.preventiveDisposition(),true);
 assert.equal(calls.at(-1).kind,'bank.reclaim');
 assert.equal(calls.at(-1).params.guard(),true);
});
test('W04 partial staging cancels a prepared un-dispatched intent on revocation',()=>{
 const {bot,calls,bankPack,api}=partialReserveFixture();
 bot.bank.preventiveDisposition();
 assert.equal(bot.bank.preventiveDisposition(),true);
 bot.cfg.production.autoDisposition=false;
 assert.equal(calls[0].params.guard(),false);
 assert.equal(bot.bank.recover(),true);
 assert.equal(bot.bank.pending,false);
 assert.equal(bot.inventoryBlocked,false);
 assert.equal(bankPack[27].q,200);
 assert.equal(api.length,0);
});
test('W04 partial staging refuses one workspace slot, disabled split or stale source',()=>{
 for(const restriction of ['one-slot','no-partial','source-drift']){
  const {bot,calls,inv,bankPack,api}=partialReserveFixture();
  if(restriction==='one-slot')
   for(let i=2;i<inv.length;i++)inv[i]={name:'filler'+i,q:1};
  if(restriction==='no-partial')bot.cfg.merchant.partialBank=false;
  for(let n=0;n<3;n++)bot.bank.preventiveDisposition();
  if(restriction==='source-drift'){
   assert.equal(calls[0]?.kind,'bank.partial.retrieve');
   bankPack[27].q=199;
   assert.equal(calls[0].params.guard(),false);
  }else assert.equal(calls.length,0,restriction);
  assert.equal(api.length,0,restriction);
 }
});

test('W04 full reserve stage rejects cross-pack surplus disappearing before dispatch',()=>{
 const {bot,calls,inv,bankPack}=operatingBankFixture();
 inv[1].q=20;
 bankPack[27]={name:'scroll0',q:80};
 const second=blank();
 second[26]={name:'scroll0',q:20};
 bot.p.c.bank.items1=second;
 for(let i=0;i<3;i++)assert.equal(bot.bank.preventiveDisposition(),false);
 assert.equal(bot.bank.preventiveDisposition(),true);
 assert.equal(calls[0].kind,'bank.retrieve');
 assert.equal(calls[0].params.guard(),true);
 // The source pack itself remains byte-identical: its single-retrieve
 // journal cannot detect that the other local pack's excess vanished.
 second[26]=null;
 assert.equal(calls[0].params.guard(),false,
  'a prepared bank reserve is never executable after cross-pack backing shrinks');
});

test('W04 malformed same-variant bank quantities cannot authorize reserve relocation',()=>{
 const {bot,calls,inv,bankPack}=operatingBankFixture();
 inv[1].q=20;
 bankPack[27]={name:'scroll0',q:80};
 const second=blank();
 second[26]={name:'scroll0',q:10000}; // above the server stack limit
 bot.p.c.bank.items1=second;
 for(let n=0;n<4;n++)bot.bank.preventiveDisposition();
 assert.equal(calls.length,0,'malformed matching stock is not usable backing');
 second[26]={name:'scroll0',q:20};
 for(let i=0;i<3;i++)assert.equal(bot.bank.preventiveDisposition(),false);
 assert.equal(bot.bank.preventiveDisposition(),true);
 assert.equal(calls[0].kind,'bank.retrieve');
});
