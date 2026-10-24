import test from 'node:test';
import assert from 'node:assert/strict';
import {fingerprint} from '../src/core/policy.mjs';
import {createBank} from '../src/merchant/bank.mjs';

const wing={name:'beewing',q:131},ore={name:'ore',q:10};
const blank=()=>Array(42).fill(null);
const partial=()=>{
 const at=Date.now();
 return {version:2,owner:'M',realm:'EU:I',at,
  pack:'items0',bankSlot:7,dest:0,splitSlot:1,
  item:{...wing},sourcePrint:fingerprint(wing),
  total:131,take:100,before:0,bankBefore:131,
  prepared:{at,session:'collision-test',realm:'EU:I',
   pack:'items0',bankSlot:7,dest:0,splitSlot:1,
   sourcePrint:fingerprint(wing)},dispatches:[]};
};
const reclaim=()=>{
 const at=Date.now();
 return {version:2,owner:'M',realm:'EU:I',at,
  pack:'items0',slot:27,dest:2,item:{...ore},
  sourcePrint:fingerprint(ore),quantity:10,before:0,
  bankBefore:10,gold:1000,expectedSaleGold:20,explicitOnly:true,
  prepared:{at,session:'original-test-session',kind:'bank.reclaim',
   realm:'EU:I',pack:'items0',slot:27,dest:2,
   sourcePrint:fingerprint(ore)}};
};

function fixture({part=null,sale=null,map='bank'}={}){
 const keyPartial='albot:bank-partial:M',keyReclaim='albot:bank-reclaim:M',
  store=new Map([[keyPartial,part],[keyReclaim,sale]]);
 const inventory=blank(),pack=blank(),notes=[],writes=[],calls=[],travels=[];
 pack[7]={...wing};pack[27]={...ore};
 const p={c:{items:inventory,bank:{items0:pack},map,
   gold:1000,isize:42,slots:{}},
  G:{items:{ore:{type:'material',s:9999,g:2},
   beewing:{type:'material',s:9999,g:2}},
   bank_packs:{items0:['bank',0,0]}},realm:()=> 'EU:I',
  read:k=>store.get(k)??null,
  write:(k,v)=>{writes.push([k,v]);store.set(k,v);return true;},
  call:(...args)=>{calls.push(['game',...args]);return true;}};
 const economy={safe:i=>!!i&&!i.l&&!i.b,
  note:s=>notes.push(s),travel:(...args)=>{travels.push(args);return true;},
  count:i=>inventory.reduce((n,x)=>n+(x?.name===i?.name?(x.q??1):0),0),
  value:()=>2,spare:()=>99,explicit:()=>null,rules:()=>null,
  remaining:()=>true,
  perform:(kind,options)=>{calls.push([kind,options]);return true;},
  npcSell:(...args)=>{calls.push(['sell',...args]);return true;}};
 const bot={p,economy,me:{name:'M',role:'merchant'},session:'M-session',
  cfg:{party:{merchant:'M'},merchant:{
   bank:true,partialBank:true,partialBankMaxStack:9999,
   bankReclaim:true,preventiveStorage:true,bankWorkspace:2},
   production:{autoDisposition:false,goals:[],gearTargets:[]}},
  journal:null,inventoryBlocked:false,running:true,
  logistics:{reserved:false},exec:{busy:()=>false},
  free:()=>inventory.filter(i=>!i).length,
  event:()=>calls.push(['event'])};
 bot.bank=createBank(bot);
 return {bot,notes,writes,calls,travels,inventory,pack,store};
}

test('W03/W04 two individually valid bank journals are quarantined on startup',()=>{
 const f=fixture({part:partial(),sale:reclaim()});
 assert.equal(f.bot.inventoryBlocked,true);
 assert.equal(f.bot.bank.pending,true);
 assert.ok(f.notes.some(x=>x.includes('Bankkonflikt')));
 const s=f.bot.bank.recoveryStatus();
 assert.equal(s.mode,'read-only-no-authorization');
 assert.equal(s.executable,false);
 assert.equal(s.conflict,'simultaneous-bank-value-journals');
 assert.equal(s.requiresManualReview,true);
 assert.equal(s.partial.phase,'conflict');
 assert.equal(s.reclaim.phase,'conflict');
 assert.equal(s.partial.sourceSlot,7);
 assert.equal(s.reclaim.sourceSlot,27);
 assert.equal(f.bot.bank.recoverCapacity(),true);
 assert.equal(f.bot.bank.recover(),true);
 assert.equal(f.calls.length,0);
 assert.equal(f.writes.length,0,'neither durable journal may be silently deleted');
});

test('W03/W04 clearing an in-memory block does not permit concurrent recovery',()=>{
 const f=fixture({part:partial(),sale:reclaim()});
 f.bot.inventoryBlocked=false;
 assert.equal(f.bot.bank.recover(),true);
 assert.equal(f.bot.inventoryBlocked,true);
 f.bot.inventoryBlocked=false;
 assert.equal(f.bot.bank.recoverCapacity(),true);
 assert.equal(f.bot.inventoryBlocked,true);
 assert.equal(f.calls.length,0);
});

test('W03/W04 stand-alone partial and reclaim checkpoints diagnose their actual phase',()=>{
 const p=fixture({part:partial()});
 const q=fixture({sale:reclaim()});
 const ps=p.bot.bank.recoveryStatus(),qs=q.bot.bank.recoveryStatus();
 assert.equal(ps.conflict,null);
 assert.equal(ps.partial.phase,'original');
 assert.equal(ps.reclaim,null);
 assert.equal(ps.requiresManualReview,false);
 assert.equal(qs.conflict,null);
 assert.equal(qs.reclaim.phase,'unchanged');
 assert.equal(qs.partial,null);
 assert.equal(qs.requiresManualReview,false);
 assert.equal(p.calls.length+q.calls.length,0);
 assert.equal(p.writes.length+q.writes.length,0);
});

test('W03/W04 status is read-only, and off-map packs are not current bank receipts',()=>{
 const f=fixture({part:partial(),map:'main'});
 const first=f.bot.bank.recoveryStatus(),second=f.bot.bank.recoveryStatus();
 assert.deepEqual(first,second);
 assert.equal(first.partial.phase,'unobserved');
 assert.equal(first.blocked,false);
 assert.equal(f.writes.length,0);
 assert.equal(f.calls.length,0);
 assert.equal(f.travels.length,0);
 const r=fixture({sale:reclaim(),map:'main'}).bot.bank.recoveryStatus();
 assert.equal(r.reclaim.phase,'unobserved');
 assert.equal(r.reclaim.offsiteEligible,false);
 assert.equal(r.reclaim.offsiteReason,'durable-withdrawal-or-inventory-missing');
});

test('W03/W04 malformed partial journal is identified without mutating evidence',()=>{
 const invalid={...partial(),sourcePrint:'wrong'};
 const f=fixture({part:invalid});
 assert.equal(f.bot.inventoryBlocked,true);
 const report=f.bot.bank.recoveryStatus();
 assert.equal(report.partial.phase,'invalid');
 assert.equal(report.requiresManualReview,true);
 assert.equal(report.executable,false);
 assert.equal(f.writes.length,0);
});

test('W03/W04 absence of both journals is an inert read-only status',()=>{
 const f=fixture();
 assert.deepEqual(f.bot.bank.recoveryStatus(),{
  mode:'read-only-no-authorization',executable:false,blocked:false,
  conflict:null,requiresManualReview:false,reserveChain:null,swap:null,store:null,single:null,partial:null,reclaim:null
 });
 assert.equal(f.writes.length,0);
});

test('W03 no new partial journal may be persisted while a reclaim exists',()=>{
 const f=fixture({sale:reclaim()});
 const rule={pack:'items0',batch:4,maxCount:100,
  action:'store'};
 const result=f.bot.bank.retrieve({name:'beewing',q:1},rule,4);
 assert.equal(result,false);
 assert.equal(f.bot.inventoryBlocked,true);
 assert.equal(f.store.get('albot:bank-partial:M'),null);
 assert.equal(f.calls.length,0);
 assert.ok(f.notes.some(x=>x.includes('Bankkonflikt')));
});
