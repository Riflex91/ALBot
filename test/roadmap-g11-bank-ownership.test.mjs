import test from 'node:test';
import assert from 'node:assert/strict';
import {bankOwnershipConflict} from '../src/core/bank-ownership.mjs';
import {createRecovery} from '../src/core/recovery.mjs';
import {createEconomy} from '../src/merchant/economy.mjs';
import {fitHeartbeat} from '../src/party/transport.mjs';

const now=1700000000000;
const owner='Merchant',session='owner-session',realm='EU:I',ttlMs=12000;
const validClaim={owner:'Other',session:'other-session',realm:'EU:I',
 purpose:'bank.retrieve',epoch:now-1000,expires:now+9000};
const peer=(bankOwner=validClaim,overrides={})=>({
 name:'Other',session:'other-session',realm:'EU:I',running:true,
 received:now-50,bankOwner,...overrides
});
const check=(peers,context={})=>bankOwnershipConflict(peers,{
 owner,session,realm,now,ttlMs,...context});
test('G11 active matching authenticated peer claim blocks local bank use',()=>{
 const result=check(new Map([['Other',peer()]]));
 assert.deepEqual([result.allowed,result.conflict,result.reason],
  [false,'Other','active-peer-bank-claim']);
});
test('G11 even a different realm cannot silently permit concurrent account bank access',()=>{
 const claim={...validClaim,realm:'US:I'};
 const result=check(new Map([['Other',peer(claim,{realm:'US:I'})]]));
 assert.equal(result.allowed,false);
});
test('G11 stale peer heartbeats and independently expired claims do not block forever',()=>{
 const stale=peer(validClaim,{received:now-ttlMs-1});
 const expired=peer({...validClaim,expires:now-1});
 assert.equal(check(new Map([['Other',stale]])).allowed,true);
 assert.equal(check(new Map([['Other',expired]])).allowed,true);
});
test('G11 ambiguous claims from fresh peers fail closed',()=>{
 for(const claim of [true,'busy',{},null===0?null:{...validClaim,expires:'soon'},
  {...validClaim,owner:'Third'}, {...validClaim,session:'previous'},
  {...validClaim,realm:'other'}, {...validClaim,purpose:'quest'},
  {...validClaim,expires:now+200001}]){
  const result=check(new Map([['Other',peer(claim)]]));
  assert.equal(result.allowed,false,JSON.stringify(claim));
 }
});
test('G11 no claim, same owner identity and not-running peers do not invent contention',()=>{
 assert.equal(check(new Map([['Other',peer(null)]])).allowed,true);
 assert.equal(check(new Map([['Other',peer(validClaim,{running:false})]])).allowed,true);
 assert.equal(check(new Map([['Merchant',peer(validClaim)]])).allowed,true);
});
test('G11 malformed local context is not a bank authorization',()=>{
 assert.equal(check(new Map(),{ttlMs:0}).allowed,false);
 assert.equal(check(new Map(),{session:''}).allowed,false);
 assert.equal(check([false]).allowed,false);
});
test('G11 heartbeats never drop bankOwner to fit optional telemetry',()=>{
 const bankOwner={...validClaim};
 const h=fitHeartbeat({bankOwner,materials:[],items:[],
  performance:{sample:'x'.repeat(8000)},stock:{rows:'y'.repeat(2000)},
  name:'Other',map:'bank',realm:'EU:I'});
 assert.ok(h);
 assert.deepEqual(h.bankOwner,bankOwner);
 assert.equal(h.performance,undefined);
 assert.ok(JSON.stringify(h).length<=4200);
});
function fixture(){
 const reports=[],peers=new Map(),sends=[],nowLocal=Date.now();
 const p={
  c:{map:'bank',rip:false,items:[],gold:1000,slots:{}},
  G:{items:{}},realm:()=> 'EU:I',read:()=>null,write:()=>true
 };
 const cfg={general:{messageTtlMs:10000,economyTickMs:250},
  party:{merchant:'Merchant'},merchant:{budgetMode:'bounded',
   maxSpendPerHour:10000,goldReserve:0},production:{lossBudget:0},items:[]};
 const exec={busy:()=>false,pending:new Map(),
  run:(kind,resources,guard,invoke)=>{
   sends.push({kind,guard,invoke});return true;
  }};
 const bot={p,cfg,me:{name:'Merchant',role:'merchant'},
  transport:{peers},session:'merchant-current',running:true,
  inventoryBlocked:false,journal:null,logistics:{reserved:false},
  checkpoint:{durable:true},exec,
  report:s=>reports.push(s),task:()=> 'supply'};
 bot.recovery=createRecovery(bot);
 bot.economy=createEconomy(bot);
 const other=(overrides={})=>{
  const now=Date.now();
  peers.set('Other',{name:'Other',session:'other-session',realm:'EU:I',
   received:now-5,running:true,bankOwner:{
    owner:'Other',session:'other-session',realm:'EU:I',purpose:'bank.gold',
    epoch:now-500,expires:now+8000},...overrides});
 };
 return {bot,reports,peers,sends,other,nowLocal};
}
test('G11 bank action rechecks ownership at actual delayed dispatch',()=>{
 const {bot,sends,other}=fixture();
 assert.equal(bot.economy.perform('bank.gold',{
  call:()=>{throw Error('must never dispatch');},guard:()=>true}),true);
 assert.equal(sends.length,1);
 assert.equal(sends[0].guard(),true);
 other();
 assert.equal(sends[0].guard(),false,'late fresh peer defeats old admission');
 assert.equal(bot.recovery.bankDispatchAllowed('bank.gold'),false);
});
test('G11 plan-stage conflict does not schedule a bank value action',()=>{
 const {bot,sends,other}=fixture();
 other();
 assert.equal(bot.economy.perform('bank.gold',{
  call:()=>true,guard:()=>true}),false);
 assert.equal(sends.length,0);
});
test('G11 stale and mismatched local lease never passes dispatch guard',()=>{
 const {bot,sends}=fixture();
 assert.equal(bot.economy.perform('bank.gold',{
  call:()=>true,guard:()=>true}),true);
 assert.equal(bot.recovery.bankDispatchAllowed('bank.retrieve'),false);
 bot.session='new-session';
 assert.equal(sends[0].guard(),false);
});
