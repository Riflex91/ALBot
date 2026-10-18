import test from 'node:test';
import assert from 'node:assert/strict';
import {createBank} from '../src/merchant/bank.mjs';
import {fingerprint} from '../src/core/policy.mjs';
const owner='M',realm='EU:I',key='albot:bank-single:M',ore={name:'ore',q:9};
const blank=()=>Array(42).fill(null);
function fixture(saved=null,{write=true,enqueue=true}={}){
 const inv=blank(),bank=blank(),db=new Map(),jobs=[],calls=[],notes=[];
 inv[1]={name:'ore',q:10};bank[7]={...ore};
 if(saved)db.set(key,saved);
 const p={c:{name:'M',map:'bank',in:'bank',items:inv,bank:{items0:bank}},
  G:{items:{ore:{type:'material',s:9999}},bank_packs:{items0:['bank',0,0]}},
  realm:()=>realm,read:k=>db.get(k)??null,
  write:(k,v)=>{if(!write)return false;db.set(k,v);return true;},
  call:(...args)=>{calls.push(args);return true;}};
 const e={safe:i=>!!i&&!i.l&&!i.b,
  count:i=>inv.reduce((n,x)=>n+(x?.name===i?.name?(x.q??1):0),0),
  travel:()=>true,
  note:s=>notes.push(s),explicit:()=>null,
  perform:(kind,params)=>{jobs.push({kind,params});return enqueue;}};
 const bot={p,economy:e,me:{name:'M'},session:'session-2',running:true,
  inventoryBlocked:false,journal:null,logistics:{reserved:false},
  cfg:{merchant:{bank:true,consolidate:true},party:{merchant:'M'},
   production:{autoDisposition:false}},exec:{busy:()=>false},free:()=>20};
 bot.bank=createBank(bot);
 return {bot,inv,bank,db,jobs,calls,notes};
}
function receipt(){
 const at=Date.now(),sourcePrint=fingerprint(ore);
 return {version:1,owner,realm,at,pack:'items0',slot:7,dest:0,
  item:{...ore},sourcePrint,quantity:9,before:10,bankBefore:9,
  prepared:{kind:'bank.retrieve',session:'session-1',at,realm,
   pack:'items0',slot:7,dest:0,sourcePrint}};
}
const dispatched=r=>({...r,dispatch:{...r.prepared,session:'session-2',at:Date.now()}});
test('W03 cross-pack merge reuses durable full-stack bank journal before server API',()=>{
 const f=fixture();
 assert.equal(f.bot.bank.consolidateAcross(),true);
 assert.equal(f.jobs.length,1);
 assert.equal(f.jobs[0].kind,'bank.merge.retrieve');
 assert.equal(f.db.get(key).dispatch,undefined);
 assert.equal(f.jobs[0].params.guard(),true);
 assert.equal(f.calls.length,0);
 assert.equal(f.jobs[0].params.call(),true);
 assert.deepEqual(f.calls,[['bank_retrieve','items0',7,0]]);
 assert.ok(f.db.get(key).dispatch);
 assert.equal(f.bot.bank.recoveryStatus().single.phase,'dispatched-unchanged');
 assert.equal(f.bot.bank.consolidateAcross(),false);
 assert.equal(f.jobs.length,1,'no duplicate while dispatched');
});
test('W03 confirmed cross-pack withdrawal requires exact physical effect',()=>{
 const f=fixture();f.bot.bank.consolidateAcross();f.jobs[0].params.call();
 f.inv[0]={...ore};f.bank[7]=null;
 assert.equal(f.jobs[0].params.observe(),true);
 assert.equal(f.jobs[0].params.onConfirmed(),true);
 assert.equal(f.db.get(key),null);
 assert.equal(f.bot.bank.pending,false);
});
test('W03 cross-pack bank action rejects missing preparation or dispatch persistence',()=>{
 const f=fixture(null,{write:false});
 assert.equal(f.bot.bank.consolidateAcross(),false);
 assert.equal(f.calls.length,0);assert.equal(f.jobs.length,0);
 assert.equal(f.bot.inventoryBlocked,true);
 const g=fixture();g.bot.bank.consolidateAcross();
 g.bot.p.write=(k,v)=>v?.dispatch?false:(g.db.set(k,v),true);
 assert.throws(()=>g.jobs[0].params.call(),/Dispatchbeleg/);
 assert.equal(g.calls.length,0);
 assert.equal(g.bot.inventoryBlocked,true);
});
test('W03 restart does not replay a sent cross-pack retrieval',()=>{
 const f=fixture(dispatched(receipt()));
 assert.equal(f.bot.bank.recoveryStatus().single.phase,'dispatched-unchanged');
 assert.equal(f.bot.bank.recover(),true);
 assert.equal(f.bot.inventoryBlocked,true);
 assert.ok(f.db.get(key).dispatch);
 assert.equal(f.calls.length,0);
 assert.equal(f.bot.bank.consolidateAcross(),false);
});
test('W03 restart clears only unqueued before image or proven effect',()=>{
 const unsent=fixture(receipt());
 assert.equal(unsent.bot.bank.recover(),true);
 assert.equal(unsent.db.get(key),null);
 const completed=fixture(dispatched(receipt()));
 completed.inv[0]={...ore};completed.bank[7]=null;
 assert.equal(completed.bot.bank.recover(),true);
 assert.equal(completed.db.get(key),null);
});
test('W03 merge retrieval refuses unsafe bank map, no partner and source drift',()=>{
 const away=fixture();away.bot.p.c.map='main';
 assert.equal(away.bot.bank.consolidateAcross(),false);
 assert.equal(away.calls.length,0);
 const alone=fixture();alone.inv[1]=null;
 assert.equal(alone.bot.bank.consolidateAcross(),false);
 const changed=fixture();changed.bot.bank.consolidateAcross();
 changed.bank[7]={name:'ore',q:8};
 assert.equal(changed.jobs[0].params.guard(),false);
 assert.equal(changed.calls.length,0);
});
test('W03 merge dispatch revalidates merge capacity and configured permission',()=>{
 const f=fixture();f.bot.bank.consolidateAcross();
 const job=f.jobs[0].params;
 f.bot.cfg.merchant.consolidate=false;
 assert.equal(job.guard(),false);
 f.bot.cfg.merchant.consolidate=true;
 f.bot.p.G.items.ore.s=18;
 assert.equal(job.guard(),false);
 assert.equal(f.calls.length,0);
});
test('W03 cross-pack merge keeps other bank operation journals mutually exclusive',()=>{
 const f=fixture();f.db.set('albot:bank-swap:M',{version:0});
 f.bot.bank=createBank(f.bot);
 assert.equal(f.bot.inventoryBlocked,true);
 assert.equal(f.bot.bank.consolidateAcross(),false);
 assert.equal(f.jobs.length,0);
});
