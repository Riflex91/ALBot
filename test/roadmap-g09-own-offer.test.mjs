import test from 'node:test';
import assert from 'node:assert/strict';
import {createOwnTradeOffer,ownTradeOfferPlan} from '../src/merchant/trade-offer.mjs';
import {identity,variantCount,surplusQuantity} from '../src/core/policy.mjs';
import {phaseOf} from '../editor/lib/contract.mjs';
import {createPorts} from '../src/runtime/ports.mjs';

function fixture(seed=null){
 const slots={trade3:null},inventory=[{name:'sword',level:0},
   {name:'sword',level:0},null],writes=new Map();
 if(seed)writes.set('albot:trade-offer:v1:M',seed);
 const rule={enabled:true,action:'tradeOffer',role:'merchant',character:'M',
  item:'sword',minLevel:0,maxLevel:0,statType:'',property:'',title:'',
  batch:1,maxActions:1,keep:1,teamReserve:0,slot:'trade3',
  wantItem:'wand',wantLevel:0,wantQuantity:1,wantStatType:'',
  wantProperty:'',wantTitle:'',wantTargetCount:1,lossBudget:1200};
 const calls=[],G={items:{sword:{type:'weapon',wtype:'sword'},
  wand:{type:'weapon',wtype:'wand'}}};
 let reserved=0,allow=true,pending=null;
 const p={G,c:{name:'M',items:inventory,isize:3,slots,
   map:'main',stand:true},has:n=>n==='trade_offer',
   realm:()=> 'EUI',read:k=>writes.get(k)??null,
   write:(k,v)=>{writes.set(k,structuredClone(v));return true;},
   call:(name,...args)=>{
    calls.push({name,args});
    if(name!=='trade_offer')throw Error('unexpected API');
    assert.equal(args[0],0);assert.equal(args[1],'trade3');
    assert.deepEqual(args[2],{name:'wand'});assert.equal(args[3],1);
    slots.trade3={...inventory[0],rid:'R001',want:{name:'wand'}};
    inventory[0]=null;
    return Promise.resolve({success:true});
   }};
 const e={explicit:()=>rule,rules:()=>rule,remaining:()=>allow,
  safe:i=>!!i&&!i.l&&!i.b&&!i.locked&&!i.bound,
  value:i=>i.name==='sword'?1100:i.name==='wand'?1400:Infinity,
  count:i=>variantCount(inventory,i),
  spare:(slot,r)=>Math.min(inventory[slot]?.q??1,r.batch,
   surplusQuantity(variantCount(inventory,inventory[slot]),reserved,
    r.keep,r.teamReserve)),
  perform:(name,options)=>{pending={kind:name,...options};return true}};
 const bot={p,cfg:{merchant:{enabled:true,stand:true},items:[rule]},
  me:{name:'M',role:'merchant'},session:'test-session',running:true,
  inventoryBlocked:false,journal:null,economy:e,
  production:{reservedQuantity:()=>reserved},movement:{order:null},
  merchant:{activateStand:()=>true}};
 const maker=createOwnTradeOffer(bot);
 return {bot,p,e,rule,calls,inventory,slots,writes,maker,
  setReserved:x=>reserved=x,setAllowed:x=>allow=x,
  get pending(){return pending;}};
}
test('G09 tradeOffer is explicit inventory permission, old swap cannot post a listing',()=>{
 assert.equal(phaseOf('tradeOffer'),'inventory');
 const f=fixture();assert.ok(ownTradeOfferPlan(f.bot,0));
 f.rule.action='swap';assert.equal(ownTradeOfferPlan(f.bot,0),null);
 f.rule.action='tradeOffer';f.rule.character='';
 assert.equal(ownTradeOfferPlan(f.bot,0),null);
 f.rule.character='M';f.rule.maxActions=2;
 assert.equal(ownTradeOfferPlan(f.bot,0),null);
 f.rule.maxActions=1;f.rule.keep=0;
 assert.equal(ownTradeOfferPlan(f.bot,0),null);
});
test('G09 posting holds full physical reserve and full outgoing value exposure',()=>{
 const f=fixture();
 f.setReserved(1);assert.equal(ownTradeOfferPlan(f.bot,0),null);
 f.setReserved(0);f.inventory[1].stat_type='str';
 assert.equal(ownTradeOfferPlan(f.bot,0),null);
 f.inventory[1]={name:'sword',level:0};
 f.rule.lossBudget=1099;assert.equal(ownTradeOfferPlan(f.bot,0),null);
 f.rule.lossBudget=1100;assert.equal(ownTradeOfferPlan(f.bot,0)?.payValue,1100);
 f.inventory[0].l=true;
 assert.equal(ownTradeOfferPlan(f.bot,0),null);
});
test('G09 offer posting accepts only fixed unstackable unmodifiable target',()=>{
 for(const edit of [
  f=>{f.p.G.items.wand.s=999;},
  f=>{f.p.G.items.wand.upgrade=true;},
  f=>{f.p.G.items.wand.stat=true;},
  f=>{f.p.G.items.wand.compound=true;},
  f=>{f.rule.wantLevel=1;},
  f=>{f.rule.wantTitle='shiny';},
  f=>{f.rule.wantStatType='dex';},
  f=>{f.rule.wantProperty='shiny';},
  f=>{f.rule.wantQuantity=2;},
  f=>{f.rule.wantItem='sword';},
  f=>{f.rule.slot='trade17';},
  f=>{f.p.c.slots.trade3={name:'other'};},
  f=>{f.p.c.isize=0;}
 ]){const f=fixture();edit(f);assert.equal(ownTradeOfferPlan(f.bot,0),null);}
});
test('G09 one approved listing uses trade_offer wrapper and confirms own inventory/stand effect',async()=>{
 const f=fixture();
 assert.equal(f.maker.post(0,f.rule),true);
 assert.equal(f.pending.kind,'market.tradeOffer');
 assert.equal(f.pending.loss,1100,'posting exposes full item value until later settlement');
 assert.equal(f.pending.guard(),true);
 assert.equal(f.pending.observe(),false);
 await f.pending.call();
 assert.equal(f.pending.observe(),true);
 assert.equal(f.pending.onConfirmed(),true);
 const record=f.writes.get('albot:trade-offer:v1:M');
 assert.equal(record?.rid,'R001');
 assert.equal(record?.offerSlot,'trade3');
 assert.equal(f.maker.status().state,'listing-still-present');
 assert.equal(f.maker.post(1,f.rule),false,'never republish even when another spare item exists');
 f.slots.trade3=null;
 assert.equal(f.maker.status().state,'listing-absent-outcome-unverified');
 assert.equal(f.maker.post(1,f.rule),false,'absence is not a confirmed successful barter');
 const reloaded=fixture(record);
 assert.equal(reloaded.maker.post(0,reloaded.rule),false);
});
test('G09 late rule, stock, reserve, realm and stand drift revoke offer before dispatch',()=>{
 for(const edit of [
  f=>{f.rule.action='sell';},
  f=>{f.rule.wantItem='staff';},
  f=>{f.setAllowed(false);},
  f=>{f.setReserved(1);},
  f=>{f.inventory[1]=null;},
  f=>{f.p.c.stand=false;},
  f=>{f.p.c.slots.trade3={name:'other'};},
  f=>{f.bot.movement.order={owner:'economy'};},
  f=>{f.bot.session='different';}
 ]){const f=fixture();assert.equal(f.maker.post(0,f.rule),true);
  edit(f);assert.equal(f.pending.guard(),false);
  assert.equal(f.calls.length,0);}
});
test('G09 lack of server effect or persistence confirmation leaves item journal unresolved',async()=>{
 const f=fixture();f.p.call=()=>Promise.resolve({success:true});
 assert.equal(f.maker.post(0,f.rule),true);
 await f.pending.call();
 assert.equal(f.pending.observe(),false);
 assert.equal(f.calls.length,0);
 const g=fixture();g.p.write=()=>false;
 g.maker.post(0,g.rule);
 await assert.rejects(async()=>g.pending.call(),/intent persistence failed/);
 assert.equal(g.calls.length,0,'server API must not be touched before durable intent');
 assert.equal(g.pending.observe(),false);
});
test('G09 may request existing stand but never executes trade_offer while stand is down',()=>{
 const f=fixture();f.p.c.stand=false;
 assert.equal(f.maker.post(0,f.rule),true);
 assert.equal(f.calls.length,0);
});

test('G09 own trade intent is durably written BEFORE any uncertain server action',async()=>{
 const f=fixture();
 f.p.call=()=>Promise.reject(Error('server timed out after possible mutation'));
 assert.equal(f.maker.post(0,f.rule),true);
 await assert.rejects(f.pending.call(),/timed out/);
 const saved=f.writes.get('albot:trade-offer:v1:M');
 assert.equal(saved?.state,'dispatch-intent-unverified');
 assert.equal(saved?.offerSlot,'trade3');
 assert.equal(saved?.receiveBefore,0);
 assert.equal(f.maker.post(1,f.rule),false,'unknown effects never authorize second listing');
 assert.equal(f.maker.status().state,'dispatch-intent-unverified');
 assert.equal(fixture(saved).maker.post(0,f.rule),false,'restart cannot erase potential posting');
});
test('G09 official seller swap UI plus physical inventory can confirm one old listing',async()=>{
 const f=fixture();f.maker.post(0,f.rule);await f.pending.call();
 assert.equal(f.pending.observe(),true);assert.equal(f.pending.onConfirmed(),true);
 const evt={type:'swap',event:true,seller:'M',buyer:'Other',
  slot:'trade3',item:{name:'sword',level:0,src:'ts'},
  received:{name:'wand',level:0,src:'ts'},snum:2};
 assert.equal(f.maker.observeSwap(evt),true);
 assert.equal(f.maker.status().observedSwapPending,true);
 assert.equal(f.maker.sample(),false,'listing still physically advertised');
 f.slots.trade3=null;
 assert.equal(f.maker.sample(),false,'receipt event alone without inventory is not settlement');
 f.inventory[2]={name:'wand',level:0,src:'ts'};
 assert.equal(f.maker.sample(),true);
 assert.equal(f.maker.status().state,'swap-receipt-verified-no-repost');
 assert.equal(f.maker.status().pendingReconciliation,false);
 assert.equal(f.maker.status().receipt.buyer,'Other');
 const saved=f.writes.get('albot:trade-offer:v1:M');
 assert.equal(saved?.state,'swap-receipt-verified-no-repost');
 assert.equal(fixture(saved).maker.status().state,'swap-receipt-verified-no-repost');
 assert.equal(f.maker.post(1,f.rule),false,'receipt still cannot silently re-authorize outgoing items');
});
test('G09 mismatched seller/slot/item/recipient or non-server UI cannot close an offer',async()=>{
 const valid={type:'swap',event:true,seller:'M',buyer:'Other',
  slot:'trade3',item:{name:'sword',level:0},
  received:{name:'wand',level:0},snum:2};
 for(const change of [
  e=>{e.event=false;},e=>{e.type='trade';},
  e=>{e.seller='Wrong';},e=>{e.buyer='M';},
  e=>{e.slot='trade4';},e=>{e.item.name='other';},
  e=>{e.received.level=2;},e=>{e.snum=-1;},
  e=>{e.snum=100;},e=>{e.buyer='';}
 ]){
  const f=fixture();f.maker.post(0,f.rule);
  await f.pending.call();assert.equal(f.pending.observe(),true);f.pending.onConfirmed();
  const event=structuredClone(valid);change(event);
  assert.equal(f.maker.observeSwap(event),false);
  f.slots.trade3=null;f.inventory[2]={name:'wand'};
  assert.equal(f.maker.sample(),false);
  assert.equal(f.maker.status().state,'listing-absent-outcome-unverified');
 }
});
test('G09 matching goods without official UI receipt cannot confirm a vanished listing',async()=>{
 const f=fixture();f.maker.post(0,f.rule);
 await f.pending.call();assert.equal(f.pending.observe(),true);f.pending.onConfirmed();
 f.slots.trade3=null;f.inventory[2]={name:'wand'};
 assert.equal(f.maker.sample(),false);
 assert.equal(f.maker.status().receipt,null);
 const older=fixture({version:1,owner:'M',realm:'EUI',
  offerSlot:'trade3',rid:'R001',outgoing:identity({name:'sword',level:0}),
  incoming:identity({name:'wand',level:0}),
  state:'listing-confirmed-post-trade-unverified'});
 assert.equal(older.maker.observeSwap({type:'swap',event:true,seller:'M',
  buyer:'Other',slot:'trade3',item:{name:'sword',level:0},
  received:{name:'wand',level:0},snum:2}),false,
 'older marker missing an actual baseline cannot become a fabricated receipt');
});
test('G09 failed settlement checkpoint preserves unknown instead of claiming completion',async()=>{
 const f=fixture();f.maker.post(0,f.rule);
 await f.pending.call();assert.equal(f.pending.observe(),true);f.pending.onConfirmed();
 f.maker.observeSwap({type:'swap',event:true,seller:'M',buyer:'Other',
  slot:'trade3',item:{name:'sword'},received:{name:'wand'},snum:2});
 f.slots.trade3=null;f.inventory[2]={name:'wand'};
 f.p.write=()=>false;
 assert.equal(f.maker.sample(),false);
 assert.equal(f.maker.status().state,'listing-absent-outcome-unverified');
});
test('G09 only paused operator may clear EXACT verified receipt marker',async()=>{
 const f=fixture();f.maker.post(0,f.rule);
 await f.pending.call();assert.equal(f.pending.observe(),true);f.pending.onConfirmed();
 const event={type:'swap',event:true,seller:'M',buyer:'Other',
  slot:'trade3',item:{name:'sword'},received:{name:'wand'},snum:2};
 f.maker.observeSwap(event);f.slots.trade3=null;f.inventory[2]={name:'wand'};
 assert.equal(f.maker.sample(),true);
 assert.equal(f.maker.acknowledgeVerified('R001'),false,'bot must be paused');
 f.bot.running=false;
 assert.equal(f.maker.acknowledgeVerified('different'),false);
 assert.equal(f.maker.status().state,'swap-receipt-verified-no-repost');
 assert.equal(f.maker.acknowledgeVerified('R001'),true);
 assert.equal(f.writes.get('albot:trade-offer:v1:M'),null);
 assert.equal(f.maker.status().state,'not-posted');
});

test('G09 read-only socket UI listener detaches and never interferes with unrelated events',()=>{
 const rows=[],handlers=new Set();
 const socket={on:(event,fn)=>{assert.equal(event,'ui');handlers.add(fn);},
  off:(event,fn)=>{assert.equal(event,'ui');handlers.delete(fn);}};
 const p=createPorts({parent:{socket}});
 const cleanup=p.watchOwnTradeSwaps(evt=>rows.push(evt));
 assert.equal(typeof cleanup,'function');
 for(const fn of handlers)fn({type:'gold',event:true});
 assert.equal(rows.length,0);
 for(const fn of handlers)fn({type:'swap',event:true,seller:'M'});
 assert.equal(rows.length,1);
 cleanup();
 assert.equal(handlers.size,0);
 const noSocket=createPorts({parent:{}});
 assert.equal(noSocket.watchOwnTradeSwaps(()=>{}),null);
});

test('G09 own barter intent persists outgoing baseline before server-side posting',async()=>{
 const f=fixture();assert.equal(f.maker.post(0,f.rule),true);
 await f.pending.call();
 const intent=f.writes.get('albot:trade-offer:v1:M');
 assert.equal(intent.outgoingBefore,2);
 assert.equal(intent.receiveBefore,0);
 assert.equal(intent.state,'dispatch-intent-unverified');
 assert.equal(f.pending.observe(),true);
 assert.equal(f.pending.onConfirmed(),true);
 assert.equal(f.writes.get('albot:trade-offer:v1:M').outgoingBefore,2);
});
test('G09 returned outgoing item blocks inferred swap settlement despite exact incoming receipt',async()=>{
 const f=fixture();f.maker.post(0,f.rule);
 await f.pending.call();assert.equal(f.pending.observe(),true);f.pending.onConfirmed();
 const evt={type:'swap',event:true,seller:'M',buyer:'Other',
  slot:'trade3',item:{name:'sword'},received:{name:'wand'},snum:2};
 assert.equal(f.maker.observeSwap(evt),true);
 f.slots.trade3=null;
 f.inventory[0]={name:'sword',level:0};
 f.inventory[2]={name:'wand',level:0};
 assert.equal(f.maker.sample(),false);
 assert.equal(f.maker.status().state,'listing-absent-outcome-unverified');
 assert.equal(f.maker.status().receipt,null);
 f.inventory[0]=null;
 assert.equal(f.maker.sample(),true,
  'stable outgoing post-listing stock and incoming receipt can complete checkpoint');
});
test('G09 missing outgoing copy blocks a false swap receipt',async()=>{
 const f=fixture();f.maker.post(0,f.rule);
 await f.pending.call();assert.equal(f.pending.observe(),true);f.pending.onConfirmed();
 assert.equal(f.maker.observeSwap({type:'swap',event:true,seller:'M',buyer:'Other',
  slot:'trade3',item:{name:'sword'},received:{name:'wand'},snum:2}),true);
 f.slots.trade3=null;f.inventory[2]={name:'wand'};
 f.inventory[1]=null;
 assert.equal(f.maker.sample(),false,
  'unrelated outgoing inventory loss cannot be attributed to this swap');
 assert.equal(f.maker.status().state,'listing-absent-outcome-unverified');
});
test('G09 old saved listing without outgoing physical baseline stays unknown after matching swap UI',async()=>{
 const f=fixture();f.maker.post(0,f.rule);
 await f.pending.call();assert.equal(f.pending.observe(),true);f.pending.onConfirmed();
 const legacy=structuredClone(f.writes.get('albot:trade-offer:v1:M'));
 delete legacy.outgoingBefore;
 const older=fixture(legacy);
 const evt={type:'swap',event:true,seller:'M',buyer:'Other',
  slot:'trade3',item:{name:'sword'},received:{name:'wand'},snum:2};
 assert.equal(older.maker.observeSwap(evt),false);
 older.slots.trade3=null;older.inventory[2]={name:'wand'};
 assert.equal(older.maker.sample(),false);
 assert.equal(older.maker.status().state,'listing-absent-outcome-unverified');
 assert.equal(older.maker.post(0,older.rule),false);
});

test('G09 previously verified swap receipt remains manually acknowledgeable without new baseline field',async()=>{
 const f=fixture();f.maker.post(0,f.rule);
 await f.pending.call();assert.equal(f.pending.observe(),true);f.pending.onConfirmed();
 assert.equal(f.maker.observeSwap({type:'swap',event:true,seller:'M',buyer:'Other',
  slot:'trade3',item:{name:'sword'},received:{name:'wand'},snum:2}),true);
 f.slots.trade3=null;f.inventory[2]={name:'wand'};
 assert.equal(f.maker.sample(),true);
 const prior=structuredClone(f.writes.get('albot:trade-offer:v1:M'));
 delete prior.outgoingBefore;
 const old=fixture(prior);
 assert.equal(old.maker.status().state,'swap-receipt-verified-no-repost');
 assert.equal(old.maker.acknowledgeVerified('R001'),false,'running bot never auto-clears');
 old.bot.running=false;
 assert.equal(old.maker.acknowledgeVerified('R001'),true,
  'new extra evidence requirement must not strand previously completed records');
});

test('G09 verified stand RID cannot change between observation and durable posting',async()=>{
 const f=fixture();
 assert.equal(f.maker.post(0,f.rule),true);
 await f.pending.call();
 assert.equal(f.pending.observe(),true);
 const original=f.slots.trade3;
 f.slots.trade3={...original,rid:'REPLACED-RID'};
 assert.equal(f.pending.observe(),false);
 assert.equal(f.pending.onConfirmed(),false);
 assert.equal(f.writes.get('albot:trade-offer:v1:M')?.state,
  'dispatch-intent-unverified');
 assert.equal(f.maker.post(1,f.rule),false,'unknown trade outcome never authorizes repost');
});
test('G09 positive server result, verified physical listing and observer are all required',async()=>{
 const f=fixture();
 assert.equal(f.maker.post(0,f.rule),true);
 await f.pending.call();
 assert.equal(f.pending.onConfirmed(),false,'onConfirmed cannot bypass read-only observation');
 assert.equal(f.pending.observe(),true);
 assert.equal(f.pending.onConfirmed(),true);
 assert.equal(f.writes.get('albot:trade-offer:v1:M')?.rid,'R001');
});
test('G09 own offer cannot confirm a mutated requested receiving variant',async()=>{
 for(const mutate of [
  want=>{want.p='special';},
  want=>{want.title='modified';},
  want=>{want.stat_type='int';},
  want=>{want.q=2;}
 ]){
  const f=fixture();f.maker.post(0,f.rule);
  await f.pending.call();
  mutate(f.slots.trade3.want);
  assert.equal(f.pending.observe(),false);
  assert.equal(f.pending.onConfirmed(),false);
  assert.equal(f.writes.get('albot:trade-offer:v1:M').state,
   'dispatch-intent-unverified');
 }
});
test('G09 no official promise result means physical listing alone cannot confirm',async()=>{
 const f=fixture();f.maker.post(0,f.rule);
 f.p.call=(name,...args)=>{
  assert.equal(name,'trade_offer');
  f.slots.trade3={name:'sword',level:0,rid:'R001',want:{name:'wand'}};
  f.inventory[0]=null;
  return Promise.resolve(undefined);
 };
 await f.pending.call();
 assert.equal(f.pending.observe(),false);
 assert.equal(f.pending.onConfirmed(),false);
 assert.equal(f.writes.get('albot:trade-offer:v1:M').state,
  'dispatch-intent-unverified');
});
test('G09 failed durable listing checkpoint cannot be treated as confirmed',async()=>{
 const f=fixture();f.maker.post(0,f.rule);
 await f.pending.call();
 assert.equal(f.pending.observe(),true);
 f.p.write=()=>false;
 assert.equal(f.pending.onConfirmed(),false);
 assert.equal(f.maker.status().state,'dispatch-intent-unverified');
 assert.equal(f.maker.post(1,f.rule),false);
});

test('G09 swap UI evidence does not cross a merchant session restart',async()=>{
 const f=fixture();f.maker.post(0,f.rule);
 await f.pending.call();assert.equal(f.pending.observe(),true);
 assert.equal(f.pending.onConfirmed(),true);
 const evt={type:'swap',event:true,seller:'M',buyer:'Other',
  slot:'trade3',item:{name:'sword'},received:{name:'wand'},snum:2};
 assert.equal(f.maker.observeSwap(evt),true);
 f.slots.trade3=null;f.inventory[2]={name:'wand'};
 f.bot.session='restarted-session';
 assert.equal(f.maker.sample(),false);
 assert.equal(f.maker.status().observedSwapPending,false);
 f.bot.session='test-session';
 assert.equal(f.maker.sample(),false,'old session proof must not revive');
 assert.equal(f.maker.status().state,'listing-absent-outcome-unverified');
 assert.equal(f.maker.status().receipt,null);
});
test('G09 swap evidence cannot complete after a realm switch and return',async()=>{
 const f=fixture();f.maker.post(0,f.rule);
 await f.pending.call();assert.equal(f.pending.observe(),true);
 assert.equal(f.pending.onConfirmed(),true);
 const evt={type:'swap',event:true,seller:'M',buyer:'Other',
  slot:'trade3',item:{name:'sword'},received:{name:'wand'},snum:2};
 assert.equal(f.maker.observeSwap(evt),true);
 f.slots.trade3=null;f.inventory[2]={name:'wand'};
 f.p.realm=()=> 'USI';
 assert.equal(f.maker.sample(),false);
 f.p.realm=()=> 'EUI';
 assert.equal(f.maker.sample(),false);
 assert.equal(f.maker.status().state,'listing-absent-outcome-unverified');
});
test('G09 a missing merchant session cannot accept new server swap evidence',async()=>{
 const f=fixture();f.maker.post(0,f.rule);
 await f.pending.call();assert.equal(f.pending.observe(),true);
 assert.equal(f.pending.onConfirmed(),true);
 f.bot.session='';
 assert.equal(f.maker.observeSwap({type:'swap',event:true,seller:'M',
  buyer:'Other',slot:'trade3',item:{name:'sword'},
  received:{name:'wand'},snum:2}),false);
 assert.equal(f.maker.status().observedSwapPending,false);
});
