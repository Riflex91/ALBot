import {identity,fingerprint,variantCount,samePlace,distance} from '../core/policy.mjs';
import {capacityAfterConsumption} from '../items/physical-capacity.mjs';

// G09 first executable increment: take an explicitly approved 1-for-1
// non-stackable offer. No inferred selling of production inputs, no speculative
// travel, no own-account swaps and no stand posting.
const G09_SLOT=/^trade([1-9]|1[0-6])$/;
const G09_EXACT=v=>({
 name:v?.name,level:v?.level??0,stat_type:v?.stat_type??'',
 p:v?.p??'',title:v?.title??'',acc:v?.acc??'',data:v?.data
});
const G09_SAFE_SINGLE=(item,meta,e,listing=false)=>!!item&&
 e?.safe?.(item)===true&&!!meta&&!meta.s&&(item.q??1)===1&&
 !item.acl&&!item.v&&!item.giveaway&&!item.bound&&
 !item.data&&!item.acc&&(!item.rid||listing)&&!item.src;

export function singleSwapOpportunity(bot,slot){
 const {p,cfg,me}=bot,e=bot.economy,item=p.c.items?.[slot];
 if(me.role!=='merchant'||!cfg.merchant?.enabled||
    !bot.running||bot.inventoryBlocked||bot.journal||
    !p.has?.('trade_swap')||!Array.isArray(cfg.items)||
    !p.G?.items||!Number.isSafeInteger(slot)||slot<0||
    !Array.isArray(p.c.items)||slot>=p.c.items.length)return null;
 const r=e?.explicit?.(item,'inventory');
 if(!r||!r.enabled||r.action!=='swap'||r.role!=='merchant'||
    r.character!==me.name||!e.remaining?.(r)||
    !Number.isSafeInteger(r.maxActions)||r.maxActions<1||r.maxActions>5||
    r.minLevel!==(item?.level??0)||r.maxLevel!==(item?.level??0)||
    r.statType!==(item?.stat_type??'')||
    (r.property??'')!==(item?.p??'')||
    (r.title??'')!==(item?.title??'')||
    !Number.isSafeInteger(r.keep)||r.keep<1||
    !Number.isSafeInteger(r.teamReserve)||r.teamReserve<0||
    !Number.isSafeInteger(r.batch)||r.batch!==1||
    !Number.isSafeInteger(r.wantQuantity)||r.wantQuantity!==1||
    !Number.isSafeInteger(r.wantLevel)||r.wantLevel<0||
    !Number.isSafeInteger(r.wantTargetCount)||r.wantTargetCount<1||
    typeof r.wantItem!=='string'||!r.wantItem||
    typeof r.wantStatType!=='string'||typeof r.wantProperty!=='string'||
    typeof r.wantTitle!=='string'||!Number.isFinite(r.lossBudget)||
    r.lossBudget<0||!G09_SAFE_SINGLE(item,p.G.items[item?.name],e)||
    e.rules?.(item,'inventory')!==r||e.spare?.(slot,r)<1)
  return null;
 const wanted={name:r.wantItem,level:r.wantLevel,
  stat_type:r.wantStatType,p:r.wantProperty,title:r.wantTitle};
 const wantedDef=p.G.items[wanted.name];
 if(!wantedDef||wantedDef.s||wanted.name===item.name&&
    identity(wanted)===identity(item)||
    e.count?.(wanted)>=r.wantTargetCount)return null;
 const paymentBefore=variantCount(p.c.items,item),
  receiveBefore=variantCount(p.c.items,wanted);
 if(!Number.isSafeInteger(paymentBefore)||paymentBefore<2||
    !Number.isSafeInteger(receiveBefore)||receiveBefore<0)return null;
 const room=capacityAfterConsumption(p.c.items,[{slot,quantity:1}],
  wanted,wantedDef,{inventorySize:p.c.isize});
 if(!room||room.units<1)return null;
 const payValue=e.value?.(item),receiveValue=e.value?.(wanted);
 if(!Number.isFinite(payValue)||payValue<0||
    !Number.isFinite(receiveValue)||receiveValue<0)return null;
 const loss=Math.max(0,payValue-receiveValue);
 if(!Number.isSafeInteger(loss)||loss>r.lossBudget)return null;
 const seen=new Set();
 for(const player of Object.values(p.entities??{})){
  const id=player?.id??player?.name;
  if(!id||seen.has(id)||player?.type!=='character'||
     !player.stand||player.name===me.name||!player.name||
     !samePlace(p.c,player)||distance(p.c,player)>300)continue;
  seen.add(id);
  for(const [tradeSlot,listing] of Object.entries(player.slots??{})){
   if(!G09_SLOT.test(tradeSlot)||!listing||!listing.want||
      typeof listing.rid!=='string'||!listing.rid||
      listing.b||listing.giveaway||listing.v||listing.l||listing.acl||
      !G09_SAFE_SINGLE(listing,wantedDef,e,true)||
      identity(G09_EXACT(listing))!==identity(wanted)||
      listing.want.name!==item.name||
      (listing.want.level??0)!==(item.level??0)||
      (listing.want.p??'')!==(item.p??'')||
      (listing.want.q??1)!==1)continue;
   return {slot,item:{...item},itemPrint:fingerprint(item),
    tradeSlot,listingPrint:fingerprint(listing),rid:listing.rid,
    sellerId:id,seller:player.name,wanted,loss,
    paymentBefore,receiveBefore,rule:r};
  }
 }
 return null;
}
export function createSingleSwap(bot){
 const {p}=bot;
 function tick(slot,rule){
  const candidate=singleSwapOpportunity(bot,slot);
  if(!candidate||candidate.rule!==rule)return false;
  const at=Date.now();
  const live=()=>{const seller=bot.entity?.(candidate.sellerId);
   return seller?.type==='character'&&seller.stand&&
    samePlace(p.c,seller)&&distance(p.c,seller)<=300&&
    seller.slots?.[candidate.tradeSlot]?.rid===candidate.rid&&
    fingerprint(seller.slots[candidate.tradeSlot])===candidate.listingPrint?
    seller:null;};
  const admitted=()=>{
   if(Date.now()-at>10000||!live())return false;
   const next=singleSwapOpportunity(bot,slot);
   return !!next&&next.rule===rule&&
    next.sellerId===candidate.sellerId&&next.rid===candidate.rid&&
    next.tradeSlot===candidate.tradeSlot&&
    next.itemPrint===candidate.itemPrint&&
    next.listingPrint===candidate.listingPrint&&
    next.loss===candidate.loss&&
    next.paymentBefore===candidate.paymentBefore&&
    next.receiveBefore===candidate.receiveBefore;
  };
  let receipt=null;
  return bot.economy.perform('market.swap',{
   slots:[slot],loss:candidate.loss,rule,
   guard:admitted,
   call:()=>Promise.resolve(p.call('trade_swap',live(),
     candidate.tradeSlot,slot)).then(result=>{receipt=result;return result;}),
   observe:()=>{
    const num=receipt?.num,received=p.c.items?.[num];
    return receipt?.success!==false&&!receipt?.failed&&
     Number.isSafeInteger(num)&&num>=0&&
     fingerprint(received)===fingerprint(candidate.wanted)&&
     variantCount(p.c.items,candidate.item)===candidate.paymentBefore-1&&
     variantCount(p.c.items,candidate.wanted)===candidate.receiveBefore+1;
   },
   details:{item:candidate.item.name,variant:identity(candidate.item),
    quantity:1,expectedItem:candidate.wanted.name,
    expectedVariant:identity(candidate.wanted),
    seller:candidate.seller,tradeSlot:candidate.tradeSlot,
    listingRid:candidate.rid,before:candidate.paymentBefore,
    riskVariant:identity(candidate.item)},
   timeout:30000
  });
 }
 return {tick,status:()=>({mode:'explicit-single-item-swap-only',
  enabled:bot.cfg.items.some(r=>r.enabled&&r.action==='swap'),
  noSpeculativeTravel:true,noAutoPosting:true})};
}
