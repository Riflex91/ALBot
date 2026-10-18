import test from 'node:test';
import assert from 'node:assert/strict';
import {scanBankDispositionWindow} from '../src/merchant/bank-disposition.mjs';
import {createBank} from '../src/merchant/bank.mjs';

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
 const calls=[],writes=[];
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
   remaining:()=>true,count:()=>0,spare:()=>99,
   perform:(kind,params)=>{calls.push({kind,params});return true;}
  },
  exec:{busy:()=>false},
  logistics:{reserved:false},running:true,inventoryBlocked:false,
  journal:null,free:()=>inv.filter(i=>!i).length,
  session:'m-01'
 };
 bot.bank=createBank(bot);
 return {bot,calls,writes,setRule:r=>{rule=r;},bankPack,inv,sell};
}
test('W04 only explicit currently permitted plain bank assets enter preventive reclaim',()=>{
 const {bot,calls,bankPack}=fixture();
 assert.equal(bot.bank.preventiveDisposition(),false);
 assert.equal(bot.bank.preventiveStatus().checked,24);
 assert.equal(calls.length,0,'a partial scan never authorizes withdrawal');
 assert.equal(bot.bank.preventiveDisposition(),true);
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
 assert.equal(bot.bank.preventiveDisposition(),true);
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
