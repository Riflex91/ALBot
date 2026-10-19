import {fingerprint,identity,variantCount,samePlace} from '../core/policy.mjs';
import {capacityAfterConsumption} from '../items/physical-capacity.mjs';

// G09: an explicitly authorized, single-use own barter listing. A server
// trade_offer only guarantees wanted NAME, MINIMUM level, optional p and q.
// No automatic repost or presumption that an absent listing was filled.
const G09_OFFER_SLOT=/^trade([1-9]|1[0-6])$/;
export function ownTradeOfferPlan(bot,slot){
 const {p,cfg,me}=bot,e=bot.economy,item=p.c.items?.[slot];
 if(me?.role!=='merchant'||!cfg.merchant?.enabled||
    cfg.merchant.stand!==true||!bot.running||bot.journal||
    bot.inventoryBlocked||!p.has?.('trade_offer')||
    !Array.isArray(p.c.items)||!Array.isArray(cfg.items)||
    !Number.isSafeInteger(slot)||slot<0||slot>=p.c.items.length||
    !p.G?.items||!item||!e?.safe?.(item))return null;
 const rule=e.explicit?.(item,'inventory');
 if(!rule||rule.action!=='tradeOffer'||rule.enabled!==true||
    rule.role!=='merchant'||rule.character!==me.name||
    e.rules?.(item,'inventory')!==rule||!e.remaining?.(rule)||
    !G09_OFFER_SLOT.test(rule.slot)||!p.c.slots||p.c.slots[rule.slot]||
    rule.minLevel!==(item.level??0)||rule.maxLevel!==(item.level??0)||
    (rule.statType??'')!==(item.stat_type??'')||
    (rule.property??'')!==(item.p??'')||
    (rule.title??'')!==(item.title??'')||
    !Number.isSafeInteger(rule.keep)||rule.keep<1||
    !Number.isSafeInteger(rule.teamReserve)||rule.teamReserve<0||
    rule.batch!==1||rule.wantQuantity!==1||rule.wantLevel!==0||
    rule.wantStatType!==''||rule.wantTitle!==''||
    rule.wantProperty!==''||!rule.wantItem||
    rule.maxActions!==1||!Number.isFinite(rule.lossBudget)||
    rule.lossBudget<0||!Number.isSafeInteger(rule.wantTargetCount)||
    rule.wantTargetCount<1)return null;
 const payMeta=p.G.items[item.name],wantMeta=p.G.items[rule.wantItem];
 // Server offers cannot enforce all receiver variant properties. Restrict
 // initial support to fixed non-mutatable and non-stackable item definitions.
 if(!payMeta||payMeta.s||!wantMeta||wantMeta.s||
    wantMeta.upgrade||wantMeta.compound||wantMeta.stat||
    (item.q??1)!==1||item.data||item.acc||item.src||
    item.acl||item.v||item.rid||item.giveaway||
    rule.wantItem===item.name||e.spare?.(slot,rule)<1||
    e.count?.({name:rule.wantItem,level:0})>=rule.wantTargetCount)
   return null;
 const reserved=bot.production?.reservedQuantity?.(item);
 if(!Number.isSafeInteger(reserved)||reserved<0)return null;
 const available=p.c.items.filter(x=>
  x&&identity(x)===identity(item)&&e.safe(x)&&
  !x.data&&!x.acc&&!x.src&&!x.acl&&!x.v&&!x.rid).length;
 if(available<rule.keep+rule.teamReserve+reserved+1)return null;
 const before=variantCount(p.c.items,item);
 const wanted={name:rule.wantItem,level:0};
 const receiveBefore=variantCount(p.c.items,wanted);
 if(!Number.isSafeInteger(before)||before<1||
    !Number.isSafeInteger(receiveBefore)||receiveBefore<0)return null;
 const room=capacityAfterConsumption(p.c.items,[{slot,quantity:1}],
  wanted,wantMeta,{inventorySize:p.c.isize});
 if(!room||room.units<1)return null;
 const payValue=e.value?.(item),receiveValue=e.value?.(wanted);
 if(!Number.isFinite(payValue)||payValue<=0||
    !Number.isFinite(receiveValue)||receiveValue<=0||
    payValue>rule.lossBudget)return null;
 return {rule,slot,offerSlot:rule.slot,item:{...item},itemPrint:fingerprint(item),
  wanted,request:{name:rule.wantItem},before,receiveBefore,payValue,
  realm:p.realm(),session:bot.session};
}
export function createOwnTradeOffer(bot,{now=()=>Date.now()}={}){
 const {p,me}=bot,key='albot:trade-offer:v1:'+me.name;
 // Even an invalid/legacy marker is evidence of a possibly live offer:
 // never overwrite it or infer safe re-posting from a missing listing.
 let saved=p.read?.(key),posted=saved!==null&&saved!==undefined;
 let swapEvidence=null;
 const accurateRecord=()=>saved&&saved.version===1&&saved.owner===me.name&&
  saved.realm===p.realm()&&/^trade([1-9]|1[0-6])$/.test(saved.offerSlot)&&
  typeof saved.rid==='string'&&!!saved.rid&&
  typeof saved.outgoing==='string'&&typeof saved.incoming==='string'&&
  Number.isSafeInteger(saved.receiveBefore)&&saved.receiveBefore>=0;
 const hasOutgoingBaseline=()=>Number.isSafeInteger(saved?.outgoingBefore)&&
  saved.outgoingBefore>=1;
 function postIntent(plan){
  const intent={version:1,owner:me.name,realm:plan.realm,
   offerSlot:plan.offerSlot,at:now(),state:'dispatch-intent-unverified',
   outgoing:identity(plan.item),incoming:identity(plan.wanted),
   receiveBefore:plan.receiveBefore,
   outgoingBefore:plan.before};
  // Persist BEFORE the external side effect. If write or server call fails
  // the possible offer remains unknown and cannot be retried automatically.
  if(!p.write?.(key,intent))throw Error('Barter intent persistence failed');
  saved=intent;posted=true;
 }
 function record(plan,observedRid){
  const listing=p.c.slots?.[plan.offerSlot];
  // Never persist a different trade RID merely because the slot was reused
  // between the observer's positive sample and onConfirmed().
  if(saved?.state!=='dispatch-intent-unverified'||
     typeof observedRid!=='string'||!observedRid||
     listing?.rid!==observedRid||
     saved.outgoing!==identity(plan.item)||
     saved.incoming!==identity(plan.wanted)||
     saved.outgoingBefore!==plan.before||
     saved.receiveBefore!==plan.receiveBefore)return false;
  const confirmed={...saved,rid:observedRid,at:now(),
   state:'listing-confirmed-post-trade-unverified'};
  if(!p.write?.(key,confirmed))return false;
  saved=confirmed;return true;
 }
 function post(slot,rule){
  if(posted)return false;
  const plan=ownTradeOfferPlan(bot,slot);
  if(!plan||plan.rule!==rule)return false;
  if(!p.c.stand)return bot.merchant?.activateStand?.()??false;
  const at=now();
  const ready=()=>{
   if(posted||now()-at>10000||!p.c.stand||bot.movement?.order||
      p.realm()!==plan.realm||bot.session!==plan.session)return false;
   const next=ownTradeOfferPlan(bot,slot);
   return !!next&&next.rule===rule&&next.offerSlot===plan.offerSlot&&
    next.itemPrint===plan.itemPrint&&next.payValue===plan.payValue&&
    next.before===plan.before&&next.receiveBefore===plan.receiveBefore;
  };
  let response=null,observedRid=null;
  const postedRid=()=>{
   const listing=p.c.slots?.[plan.offerSlot];
   // A fulfilled server promise is necessary but never sufficient.
   // Physical source depletion and this exact own stand entry are required.
   if(!response||typeof response!=='object'||response.failed||
      response.success===false||
      saved?.state!=='dispatch-intent-unverified'||
      saved.outgoing!==identity(plan.item)||
      saved.incoming!==identity(plan.wanted)||
      saved.receiveBefore!==plan.receiveBefore||
      saved.outgoingBefore!==plan.before||
      !listing||typeof listing.rid!=='string'||!listing.rid||
      listing.name!==plan.item.name||
      (listing.level??0)!==(plan.item.level??0)||
      (listing.stat_type??'')!==(plan.item.stat_type??'')||
      (listing.p??'')!==(plan.item.p??'')||
      (listing.title??'')!==(plan.item.title??'')||
      (listing.acc??'')!==(plan.item.acc??'')||
      JSON.stringify(listing.data)!==JSON.stringify(plan.item.data)||
      (listing.q??1)!==1||listing.b||listing.giveaway||
      listing.want?.name!==plan.wanted.name||
      (listing.want.level??0)!==0||
      (listing.want.q??1)!==1||
      (listing.want.p??'')!==''||
      (listing.want.stat_type??'')!==''||
      (listing.want.title??'')!==''||
      variantCount(p.c.items,plan.item)!==plan.before-1)return null;
   return listing.rid;
  };
  return bot.economy.perform('market.tradeOffer',{
   slots:[slot],loss:plan.payValue,rule,
   guard:ready,
   call:()=>{
    postIntent(plan);
    return Promise.resolve(p.call('trade_offer',slot,plan.offerSlot,
     plan.request,1)).then(x=>{response=x;return x;});
   },
   observe:()=>{
    const rid=postedRid();
    if(!rid||observedRid&&rid!==observedRid)return false;
    observedRid=rid;
    return true;
   },
   onConfirmed:()=>{
    const rid=postedRid();
    return !!observedRid&&rid===observedRid&&record(plan,observedRid);
   },
   details:{item:plan.item.name,variant:identity(plan.item),
    quantity:1,before:plan.before,wanted:identity(plan.wanted),
    offerSlot:plan.offerSlot,riskVariant:identity(plan.item)},
   timeout:30000
  });
 }
 // The server UI swap event carries no listing RID. An observed
 // replacement or mutation of the known stand entry contradicts its proof,
 // even if that replacement disappears before physical inventory settles.
 function matchingRecordedListing(listing){
  if(!listing)return true; // server may already have removed this entry
  return listing.rid===saved?.rid&&
   identity({...listing,rid:undefined})===saved.outgoing&&
   identity(listing.want)===saved.incoming&&
   (listing.q??1)===1&&(listing.want?.q??1)===1&&
   !listing.b&&!listing.giveaway;
 }
 function observeSwap(data){
  // Official server emits UI {type:'swap',event:true,seller,buyer,
  // item,received,slot,snum}. It has no RID. The RID must already have
  // been observed and durably tied to this merchant's own stand slot.
  if(!posted||!accurateRecord()||!hasOutgoingBaseline()||
     typeof bot.session!=='string'||!bot.session||
     saved.state!=='listing-confirmed-post-trade-unverified'||
     data?.type!=='swap'||data.event!==true||
     data.seller!==me.name||typeof data.buyer!=='string'||
     !data.buyer||data.buyer===me.name||data.buyer.length>100||
     data.slot!==saved.offerSlot||
     !Number.isSafeInteger(data.snum)||data.snum<0||
     data.snum>=p.c.isize||
     identity(data.item)!==saved.outgoing||
     identity(data.received)!==saved.incoming||
     !matchingRecordedListing(p.c.slots?.[saved.offerSlot]))return false;
  // The seller's actual inventory refresh may follow the event.
  swapEvidence={at:now(),buyer:data.buyer,snum:data.snum,
   rid:saved.rid,offerSlot:saved.offerSlot,
   ownerSession:bot.session,realm:p.realm()};
  return true;
 }
 function sample(){
  if(!swapEvidence||now()-swapEvidence.at>30000){
   swapEvidence=null;return false;
  }
  // A volatile UI event from an old bot session or another server realm
  // cannot authorize a new session's physical inventory snapshot. Discard
  // the old evidence rather than reviving it if the session changes back.
  if(!swapEvidence.ownerSession||swapEvidence.ownerSession!==bot.session||
     swapEvidence.realm!==p.realm()){
   swapEvidence=null;return false;
  }
  // Invalidate the volatile UI proof on the FIRST observed stand drift.
  // A later empty slot is not enough to make that old event valid again.
  if(!matchingRecordedListing(p.c.slots?.[swapEvidence.offerSlot])){
   swapEvidence=null;return false;
  }
  if(!accurateRecord()||!hasOutgoingBaseline()||
     saved.state!=='listing-confirmed-post-trade-unverified'||
     saved.rid!==swapEvidence.rid||
     saved.offerSlot!==swapEvidence.offerSlot||
     !Array.isArray(p.c.items)||
     p.c.slots?.[saved.offerSlot]||
     identity(p.c.items[swapEvidence.snum])!==saved.incoming)return false;
  // The listed outgoing unit left the inventory when trade_offer posted.
  // A vanished listing plus matching incoming item is not proof of a swap
  // if the original outgoing stock has returned or drifted since posting.
  // Missing/unsafe old baselines remain unresolved, never backfilled.
  const countUnits=variant=>{
   let count=0;
   for(const item of p.c.items){
    if(!item||identity(item)!==variant)continue;
    const quantity=item.q??1;
    if(!Number.isSafeInteger(quantity)||quantity<1||
       !Number.isSafeInteger(count+quantity))return null;
    count+=quantity;
   }
   return count;
  };
  const incoming=countUnits(saved.incoming),outgoing=countUnits(saved.outgoing);
  if(!Number.isSafeInteger(saved.receiveBefore+1)||
     incoming!==saved.receiveBefore+1||
     outgoing!==saved.outgoingBefore-1)return false;
  const next={...saved,state:'swap-receipt-verified-no-repost',
   receipt:{buyer:swapEvidence.buyer,snum:swapEvidence.snum,
    at:now(),rid:swapEvidence.rid}};
  if(!p.write?.(key,next))return false;
  saved=next;swapEvidence=null;return true;
 }
 function acknowledgeVerified(rid){
  // Explicit manual acknowledgement, never called by the scheduler.
  // An operator must inspect the exact receipt and pause the bot.
  if(bot.running||!accurateRecord()||
     saved.state!=='swap-receipt-verified-no-repost'||
     !saved.receipt||rid!==saved.rid||
     typeof rid!=='string'||!rid||
     !p.write?.(key,null))return false;
  saved=null;posted=false;swapEvidence=null;return true;
 }
 function status(){
  const listing=saved&&p.c.slots?.[saved.offerSlot];
  return {mode:'explicit-once-only-posting',pendingReconciliation:posted&&
   saved?.state!=='swap-receipt-verified-no-repost',
   state:!posted?'not-posted':
    saved?.state==='swap-receipt-verified-no-repost'?
     'swap-receipt-verified-no-repost':
    saved?.state==='dispatch-intent-unverified'?
     'dispatch-intent-unverified':
    saved?.state==='listing-confirmed-post-trade-unverified'?
     listing?.rid===saved.rid?'listing-still-present':
      'listing-absent-outcome-unverified':'historical-or-unknown-blocked',
   noAutomaticRepost:true,offerSlot:saved?.offerSlot??null,
   receipt:saved?.state==='swap-receipt-verified-no-repost'?
    {...saved.receipt}:null,
   observedSwapPending:!!swapEvidence};
 }
 return {post,observeSwap,sample,acknowledgeVerified,status};
}
