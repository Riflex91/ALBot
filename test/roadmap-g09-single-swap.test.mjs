import test from 'node:test';
import assert from 'node:assert/strict';
import {singleSwapOpportunity,createSingleSwap} from '../src/merchant/single-swap.mjs';
import {fingerprint,identity,variantCount,surplusQuantity} from '../src/core/policy.mjs';
import {ITEM_RULE} from '../editor/lib/schema.mjs';
import {phaseOf} from '../editor/lib/contract.mjs';

function fixture(){
 const pay={name:'sword',level:0},receive={name:'wand',level:0};
 const listing={name:'wand',level:0,q:1,rid:'Aa01',
  want:{name:'sword',q:1}};
 const seller={id:'S',name:'Seller',type:'character',stand:true,
  map:'main',x:60,y:0,slots:{trade3:listing}};
 const items=[{...pay},{...pay},null],sellerRecord={S:seller};
 let realm='EUI';
 const r={enabled:true,action:'swap',role:'merchant',character:'M',
  item:'sword',statType:'',property:'',title:'',
  minLevel:0,maxLevel:0,keep:1,teamReserve:0,batch:1,
  maxActions:1,wantItem:'wand',wantLevel:0,wantQuantity:1,
  wantStatType:'',wantProperty:'',wantTitle:'',wantTargetCount:1,
  lossBudget:200,goldBudget:0};
 const p={c:{name:'M',items,isize:3,map:'main',x:0,y:0},
  G:{items:{sword:{type:'weapon',wtype:'sword'},
   wand:{type:'weapon',wtype:'wand'}}},
  entities:sellerRecord,realm:()=>realm,
  has:name=>name==='trade_swap',call:null};
 const calls=[];p.call=(name,...args)=>{calls.push({name,args});
  if(name!=='trade_swap')throw Error('unexpected method');
  const [target,tradeSlot,slot]=args;
  assert.equal(target?.id,'S');assert.equal(tradeSlot,'trade3');
  assert.equal(slot,0);
  items[slot]={name:'wand',level:0};
  seller.slots[tradeSlot]=null;
  return Promise.resolve({num:slot,success:true});
 };
 let pending=null,authorized=true,reserved=0;
 const e={safe:i=>!!i&&!i.l&&!i.b&&!i.bound,
  explicit:()=>r,rules:()=>r,remaining:()=>authorized,
  value:i=>i?.name==='sword'?1200:i?.name==='wand'?1600:Infinity,
  count:i=>variantCount(items,i),
  spare:(slot,rule)=>Math.min(items[slot]?.q??1,rule.batch,
   surplusQuantity(variantCount(items,items[slot]),reserved,
    rule.keep,rule.teamReserve)),
  perform:(name,opts)=>{pending={kind:name,...opts};return true}};
 const bot={p,cfg:{merchant:{enabled:true},items:[r]},
  me:{name:'M',role:'merchant'},running:true,
  session:'merchant-session',farmers:[],teamNames:['M'],
  economy:e,entity:id=>sellerRecord[id],inventoryBlocked:false,journal:null};
 return {bot,p,e,r,pay,receive,listing,seller,items,calls,
  setAuthorized:x=>authorized=x,setReserved:n=>reserved=n,
  setRealm:x=>realm=x,
  get pending(){return pending;},swaps:createSingleSwap(bot)};
}
test('G09 swap is an optional, explicit inventory action, not inferred from marketBuy',()=>{
 assert.equal(phaseOf('swap'),'inventory');
 assert.equal(ITEM_RULE.required.includes('wantItem'),false);
 assert.equal(ITEM_RULE.required.includes('wantTargetCount'),false);
 const f=fixture();assert.ok(singleSwapOpportunity(f.bot,0));
 f.r.action='marketBuy';assert.equal(singleSwapOpportunity(f.bot,0),null);
 f.r.action='swap';f.r.character='';assert.equal(singleSwapOpportunity(f.bot,0),null);
 f.r.character='M';f.r.maxActions=0;
 assert.equal(singleSwapOpportunity(f.bot,0),null);
 f.r.maxActions=1;f.r.keep=0;
 assert.equal(singleSwapOpportunity(f.bot,0),null);
});
test('G09 single swap honors physical gross reserves and only one precise stock variant',()=>{
 const f=fixture();
 f.setReserved(1);assert.equal(singleSwapOpportunity(f.bot,0),null);
 f.setReserved(0);f.items[1].stat_type='str';
 assert.equal(singleSwapOpportunity(f.bot,0),null,'wrong variant never covers reserve');
 f.items[1]={name:'sword',level:0};f.items[0].l=true;
 assert.equal(singleSwapOpportunity(f.bot,0),null);
 f.items[0].l=false;f.r.statType='str';
 assert.equal(singleSwapOpportunity(f.bot,0),null,'payment must match exact explicit rule');
});
test('G09 listing rid, wanted payment, opposite item variant, quantity and stand must match',()=>{
 for(const change of [
  f=>{f.listing.rid='';},
  f=>{f.listing.want.name='staff';},
  f=>{f.listing.want.q=2;},
  f=>{f.listing.name='sword';},
  f=>{f.listing.level=1;},
  f=>{f.listing.stat_type='int';},
  f=>{f.listing.p='shiny';},
  f=>{f.listing.q=2;},
  f=>{f.seller.stand=false;},
  f=>{f.seller.x=400;},
  f=>{f.seller.type='monster';},
  f=>{f.seller.slots.trade3.b=true;}
 ]){const f=fixture();change(f);assert.equal(singleSwapOpportunity(f.bot,0),null);}
});
test('G09 no speculative travel, no auto-posting, no trade without the official CODE method',()=>{
 const f=fixture();
 f.p.has=()=>false;
 assert.equal(singleSwapOpportunity(f.bot,0),null);
 assert.equal(f.swaps.tick(0,f.r),false);
 assert.equal(f.calls.length,0);
 assert.equal(f.swaps.status().noSpeculativeTravel,true);
 assert.equal(f.swaps.status().noAutoPosting,true);
});
test('G09 accepted trade requires fresh live listing and confirmed item effects',async()=>{
 const f=fixture();
 assert.equal(f.swaps.tick(0,f.r),true);
 assert.equal(f.pending.kind,'market.swap');
 assert.equal(f.pending.loss,0);
 assert.equal(f.pending.rule,f.r);
 assert.equal(f.pending.guard(),true);
 assert.equal(f.pending.observe(),false);
 await f.pending.call();
 assert.equal(f.pending.observe(),true);
 assert.equal(f.calls.length,1);
 assert.equal(f.items[0].name,'wand');
 assert.equal(f.seller.slots.trade3,null);
});
test('G09 stale live rid, quantity, reserve, price risk and authorization reject dispatch',()=>{
 for(const edit of [
  f=>{f.listing.rid='new';},
  f=>{f.listing.want.level=5;},
  f=>{f.listing.level=1;},
  f=>{f.seller.stand=false;},
  f=>{f.items[0].level=1;},
  f=>{f.items[1]=null;},
  f=>{f.setReserved(1);},
  f=>{f.setAuthorized(false);},
  f=>{f.r.lossBudget=-1;},
  f=>{f.r.wantItem='staff';}
 ]){const f=fixture();assert.equal(f.swaps.tick(0,f.r),true);
  edit(f);assert.equal(f.pending.guard(),false);
  assert.equal(f.calls.length,0);}
});
test('G09 insufficient observed receive value or quota blocks paying',()=>{
 const f=fixture();
 f.e.value=i=>i?.name==='sword'?1200:800;
 assert.equal(singleSwapOpportunity(f.bot,0),null,'loss over 200 refused');
 f.r.lossBudget=450;
 const plan=singleSwapOpportunity(f.bot,0);
 assert.equal(plan?.loss,400);
 f.items[2]={name:'wand',level:0};
 assert.equal(singleSwapOpportunity(f.bot,0),null,'target quantity already held');
 f.items[2]=null;f.p.c.isize=0;
 assert.equal(singleSwapOpportunity(f.bot,0),null,'no real room even after payment');
});
test('G09 successful API result without physical item receipt remains unresolved',async()=>{
 const f=fixture();f.p.call=(name,target,slot,num)=>
  Promise.resolve({num,success:true});
 assert.equal(f.swaps.tick(0,f.r),true);
 await f.pending.call();
 assert.equal(f.pending.observe(),false,'server success alone cannot settle value journal');
});

test('G09 seller payment selectors are fully verified against the actual outgoing item',()=>{
 for(const change of [
  f=>{f.listing.want.stat_type='dex';},
  f=>{f.listing.want.title='rare';},
  f=>{f.listing.want.p='glow';},
  f=>{f.listing.want.acc='account';},
  f=>{f.listing.want.data={extra:1};},
  f=>{f.listing.want.owner='someone';},
  f=>{f.listing.want.src='server-drift';},
  f=>{f.listing.want.q=2;},
  f=>{f.listing.want.level=1;}
 ]){
  const f=fixture();change(f);
  assert.equal(singleSwapOpportunity(f.bot,0),null,
   'an unsupported or different requested payment is not an exact match');
  assert.equal(f.swaps.tick(0,f.r),false);
  assert.equal(f.calls.length,0);
 }
});

test('G09 exact authorized payment stat and title match a matching advertised want',async()=>{
 const f=fixture();
 for(const pay of [f.items[0],f.items[1]]){
  pay.stat_type='dex';pay.title='Rare';
 }
 f.r.statType='dex';f.r.title='Rare';
 f.listing.want.stat_type='dex';f.listing.want.title='Rare';
 assert.ok(singleSwapOpportunity(f.bot,0));
 assert.equal(f.swaps.tick(0,f.r),true);
 assert.equal(f.pending.guard(),true);
 await f.pending.call();
 assert.equal(f.pending.observe(),true);
 assert.equal(f.calls.length,1);
});

test('G09 a different realm or process session revokes a queued trade',async()=>{
 for(const change of [
  f=>{f.setRealm('USIV');},
  f=>{f.bot.session='merchant-restarted';},
  f=>{f.bot.session='';},
  f=>{f.seller.name='Changed Seller';}
 ]){
  const f=fixture();assert.equal(f.swaps.tick(0,f.r),true);
  change(f);
  assert.equal(f.pending.guard(),false);
  await assert.rejects(f.pending.call(),/swap-proof-expired-before-call/);
  assert.equal(f.calls.length,0,
   'no live API call after realm/session/seller drift');
 }
});

test('G09 changes between last arbitration and trade_swap call cannot use stale listing',async()=>{
 for(const change of [
  f=>{f.listing.want.title='suspicious';},
  f=>{f.listing.want.stat_type='dex';},
  f=>{f.listing.want.q=2;},
  f=>{f.listing.rid='replaced';},
  f=>{f.seller.x=400;},
  f=>{f.setAuthorized(false);},
  f=>{f.items[1]=null;},
  f=>{f.setReserved(1);}
 ]){
  const f=fixture();assert.equal(f.swaps.tick(0,f.r),true);
  assert.equal(f.pending.guard(),true);
  change(f);
  await assert.rejects(f.pending.call(),/swap-proof-expired-before-call/);
  assert.equal(f.calls.length,0,
   'the server cannot be called after a revoked second-side proof');
 }
});

test('G09 never consumes an offer from a known own-account teammate',()=>{
 for(const known of ['farmer','team']){
  const f=fixture();
  f.seller.name='Ranger1';
  if(known==='farmer')f.bot.farmers=['Ranger1'];
  else f.bot.teamNames=['M','Ranger1'];
  assert.equal(singleSwapOpportunity(f.bot,0),null);
  assert.equal(f.swaps.tick(0,f.r),false);
  assert.equal(f.calls.length,0);
 }
});

test('G09 malformed unrelated inventory identity cannot crash the trade planner',()=>{
 const f=fixture(),cycle={p:3};
 cycle.self=cycle;
 f.items[2]={name:'malformed',data:cycle};
 assert.doesNotThrow(()=>singleSwapOpportunity(f.bot,0));
 assert.equal(singleSwapOpportunity(f.bot,0),null);
 assert.equal(f.swaps.tick(0,f.r),false);
 assert.equal(f.calls.length,0);
});

test('G09 unverified quota callbacks fail closed instead of minting spare stock',()=>{
 for(const failure of [
  f=>{f.e.count=()=>{throw Error('broken inventory query');};},
  f=>{f.e.count=()=>NaN;},
  f=>{f.e.count=()=>-1;},
  f=>{f.e.spare=()=>{throw Error('unknown reserve');};},
  f=>{f.e.spare=()=>NaN;},
  f=>{f.e.spare=()=>0.5;}
 ]){
  const f=fixture();
  failure(f);
  assert.doesNotThrow(()=>singleSwapOpportunity(f.bot,0));
  assert.equal(singleSwapOpportunity(f.bot,0),null);
  assert.equal(f.swaps.tick(0,f.r),false);
 }
});

test('G09 malformed explicit q never proves payment or advertised singleton',()=>{
 for(const invalid of [null,0,-1,0.5,2,NaN,Infinity]){
  for(const field of ['payment','spare','listing','want']){
   const f=fixture();
   if(field==='payment')f.items[0].q=invalid;
   if(field==='spare')f.items[1].q=invalid;
   if(field==='listing')f.listing.q=invalid;
   if(field==='want')f.listing.want.q=invalid;
   assert.equal(singleSwapOpportunity(f.bot,0),null,
    field+':'+String(invalid));
   assert.equal(f.swaps.tick(0,f.r),false);
   assert.equal(f.calls.length,0);
  }
 }
 const f=fixture();
 f.items[0].q=1;f.items[1].q=1;f.listing.q=1;f.listing.want.q=1;
 assert.ok(singleSwapOpportunity(f.bot,0),
  'physical singleton q=1 remains a valid exact exchange');
});

test('G09 late quantity drift revokes a queued swap before API call',async()=>{
 for(const change of [
  f=>{f.items[1].q=null;},
  f=>{f.listing.q=null;},
  f=>{f.listing.want.q=null;}
 ]){
  const f=fixture();
  assert.equal(f.swaps.tick(0,f.r),true);
  assert.equal(f.pending.guard(),true);
  change(f);
  assert.equal(f.pending.guard(),false);
  await assert.rejects(f.pending.call(),/swap-proof-expired-before-call/);
  assert.equal(f.calls.length,0);
 }
});
