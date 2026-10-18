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
export function createOwnTradeOffer(bot){
 const {p,me}=bot,key='albot:trade-offer:v1:'+me.name;
 // Treat unknown/corrupt persisted data as an unverified former posting,
 // never as authorization to publish another payment item.
 let saved=p.read?.(key),posted=!!saved;
 const record=plan=>{
  const listing=p.c.slots?.[plan.offerSlot],at=Date.now();
  if(!listing||typeof listing.rid!=='string'||!listing.rid||
     !p.write?.(key,{version:1,owner:me.name,realm:plan.realm,
      offerSlot:plan.offerSlot,rid:listing.rid,at,
      outgoing:identity(plan.item),incoming:identity(plan.wanted),
      state:'listing-confirmed-post-trade-unverified'}))return false;
  posted=true;saved={version:1,owner:me.name,offerSlot:plan.offerSlot,
   rid:listing.rid,at};
  return true;
 };
 function post(slot,rule){
  if(posted)return false;
  const plan=ownTradeOfferPlan(bot,slot);
  if(!plan||plan.rule!==rule)return false;
  if(!p.c.stand)return bot.merchant?.activateStand?.()??false;
  const ready=()=>{
   if(posted||!p.c.stand||bot.movement?.order||
      p.realm()!==plan.realm||bot.session!==plan.session)return false;
   const next=ownTradeOfferPlan(bot,slot);
   return !!next&&next.rule===rule&&next.offerSlot===plan.offerSlot&&
    next.itemPrint===plan.itemPrint&&next.payValue===plan.payValue&&
    next.before===plan.before&&next.receiveBefore===plan.receiveBefore;
  };
  let response=null;
  return bot.economy.perform('market.tradeOffer',{
   slots:[slot],loss:plan.payValue,rule,
   guard:ready,
   call:()=>Promise.resolve(p.call('trade_offer',slot,plan.offerSlot,
    plan.request,1)).then(x=>{response=x;return x;}),
   observe:()=>{
    const listing=p.c.slots?.[plan.offerSlot];
    return response?.success!==false&&!response?.failed&&
     !!listing&&typeof listing.rid==='string'&&!!listing.rid&&
     listing.name===plan.item.name&&
     (listing.level??0)===(plan.item.level??0)&&
     (listing.stat_type??'')===(plan.item.stat_type??'')&&
     (listing.p??'')===(plan.item.p??'')&&
     (listing.title??'')===(plan.item.title??'')&&
     (listing.q??1)===1&&!listing.b&&!listing.giveaway&&
     listing.want?.name===plan.wanted.name&&
     (listing.want.level??0)===0&&
     (listing.want.q??1)===1&&
     variantCount(p.c.items,plan.item)===plan.before-1;
   },
   onConfirmed:()=>record(plan),
   details:{item:plan.item.name,variant:identity(plan.item),
    quantity:1,before:plan.before,wanted:identity(plan.wanted),
    offerSlot:plan.offerSlot,riskVariant:identity(plan.item)},
   timeout:30000
  });
 }
 function status(){
  const listing=saved&&p.c.slots?.[saved.offerSlot];
  return {mode:'explicit-once-only-posting',pendingReconciliation:posted,
   state:posted?listing?.rid===saved.rid?
    'listing-still-present':'listing-absent-outcome-unverified':'not-posted',
   noAutomaticRepost:true,offerSlot:saved?.offerSlot??null};
 }
 return {post,status};
}
