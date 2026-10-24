import {boundedStockVariantAllowed,boundedStockSurplus,verifiedProductionStockQuantity} from './stock-policy.mjs';
import {defaultsFor} from '../../editor/lib/contract.mjs';
import {ITEM_RULE} from '../../editor/lib/schema.mjs';
import {identity,protectedItem} from '../core/policy.mjs';
// W02/W04: quantity may only back a bank reserve or a sale if it is
// physically representable by this item's actual game stack contract.
// In particular q:null is NOT the absent-q singleton convention.
const physicalSourceQuantity=(G,item)=>{
 const q=item?.q===undefined?1:item?.q;
 return Number.isSafeInteger(q)&&q>0&&
  verifiedProductionStockQuantity(G,[item],item)===q?q:null;
};
// W02/W04: Only *unencumbered* local physical copies may fulfill a
// merchant working reserve or back an autonomous sale. A reserved/locked
// stack may have the same inventory variant as an ordinary one: neither the
// variant identity nor an aggregate physical count proves it is available.
// Validate ALL matching quantities first, including blocked ones, rather
// than silently skipping malformed protected stacks.
export function verifiedAvailableOperatingStockQuantity(G,items,item){
 const total=verifiedProductionStockQuantity(G,items,item);
 if(!Number.isSafeInteger(total))return null;
 let unavailable=0;
 try{
  const variant=identity(item);
  for(const stock of items){
   if(!stock||identity(stock)!==variant||!protectedItem(stock))continue;
   const q=stock.q===undefined?1:stock.q;
   if(!Number.isSafeInteger(q)||q<1||
      !Number.isSafeInteger(unavailable+q))return null;
   unavailable+=q;
  }
 }catch{return null;}
 return unavailable<=total?total-unavailable:null;
}
// Finite, replaceable working stock, not a generic liquidation allowlist.
// Account inventory snapshots cannot authorize a sale: a local reserve
// covers the WHOLE configured squad even if peers or bank are unavailable.
export function operatingStockFloor(name,cfg,farmers=0){
 if(!Number.isSafeInteger(farmers)||farmers<0||farmers>128)return null;
 if(/^(c?scroll)[01]$/.test(name))return 100;
 if(['elixirstr0','elixirint0','elixirdex0','elixirvit0'].includes(name))
  return Math.max(10,4*(farmers+1));
 const hp=['hpot0','hpot1'].includes(name),mp=['mpot0','mpot1'].includes(name);
 if(!hp&&!mp)return null;
 const target=hp?cfg.merchant?.hpPotionTarget??3000:cfg.merchant?.mpPotionTarget??300;
 if(!Number.isSafeInteger(target)||target<0||target>100000)return null;
 return Math.max(hp?1000:300,target*Math.max(1,farmers));
}
// W02: selected party members are not the entire configured account need.
// Offline but enabled OWN farmers still require replenishable working stock.
// Only the local, validated configuration increases the floor; remote
// inventory or stale heartbeat estimates never authorize liquidation.
export function operatingReserveCohort(bot){
 const selected=bot?.farmers??[];
 if(!Array.isArray(selected)||selected.length>128||
    selected.some(name=>typeof name!=='string'||!name||name.length>100))
  return null;
 const configured=bot?.cfg?.characters;
 if(configured===undefined||configured===null)return new Set(selected).size;
 if(!Array.isArray(configured)||configured.length>128)return null;
 const names=[...selected];
 for(const member of configured){
  if(!member||typeof member!=='object'||Array.isArray(member)||
     typeof member.name!=='string'||!member.name||member.name.length>100||
     typeof member.role!=='string'||typeof member.enabled!=='boolean')
   return null;
  if(member.enabled&&member.role==='farmer')names.push(member.name);
 }
 const cohort=new Set(names);
 return cohort.size<=128?cohort.size:null;
}
function operatingStockBaseRule(bot,item){
 const {cfg,p,me}=bot,e=bot.economy;
 if(me.role!=='merchant'||!cfg.merchant?.enabled||
    cfg.production?.enabled!==true||cfg.production?.autoDisposition!==true||
    cfg.merchant.preventiveStorage!==true||!e||!e.safe(item)||
    !boundedStockVariantAllowed(p.G,item)||(item.level??0)!==0||
    ['inventory','production','acquisition'].some(phase=>e.explicit(item,phase)))
  return null;
 const meta=p.G.items?.[item.name],cohort=operatingReserveCohort(bot),
  floor=cohort===null?null:operatingStockFloor(item.name,cfg,cohort);
 if(floor===null||!meta||meta.cash||meta.cash_item||meta.exclusive||meta.rare||
    meta.rarity||meta.quest||meta.event||meta.action||meta.onclick||
    !Number.isFinite(meta.g)||meta.g<=0||!e.npcFor(item.name))return null;
 const price=e.value(item);if(!Number.isFinite(price)||price<0)return null;
 return {...defaultsFor(ITEM_RULE),name:'Betriebsvorrat '+item.name,
  enabled:true,item:item.name,role:me.role,character:me.name,action:'sell',
  minLevel:0,maxLevel:0,priority:-350,keep:floor,teamReserve:0,
  batch:9999,maxCount:1000000000,minPrice:Math.floor(price),
  _autoDisposition:true,_autoOperatingStock:true};
}
export function automaticOperatingStockRule(bot,item){
 const rule=operatingStockBaseRule(bot,item);if(!rule)return null;
 const held=verifiedAvailableOperatingStockQuantity(bot.p.G,bot.p.c.items,item),
  source=physicalSourceQuantity(bot.p.G,item),
  reserved=bot.production?.reservedQuantity?.(item)??0;
 if(source===null||!Number.isSafeInteger(held)||
    !Number.isSafeInteger(reserved)||reserved<0||
    !Number.isSafeInteger(rule.keep+reserved)||held<=rule.keep+reserved)return null;
 return {...rule,batch:Math.min(9999,item.q??1,held-rule.keep-reserved)};
}
// Whole bank-stack disposition is authorized only when the FULL floor is
// already physically carried. Retained bank stock is NEVER sale backing.
// The existing bank reclaim journal still proves the exact withdrawal.
export function bankOperatingStockRule(bot,item,{carried=false}={}){
 const {p}=bot,e=bot.economy,meta=p.G.items?.[item?.name],
  q=item?.q===undefined?1:item.q;
 if(bot.me.role!=='merchant'||!e?.safe(item)||
    !boundedStockVariantAllowed(p.G,item)||!meta||(item.level??0)!==0||
    physicalSourceQuantity(p.G,item)===null)return null;
 if(meta.quest||meta.q||meta.e||meta.exchange||meta.event||meta.cash||meta.cash_item||
    meta.soulbound||meta.compound||meta.upgrade||meta.rare||meta.rarity||meta.action||
    meta.onclick||meta.offering||meta.throw||meta.ignore||meta.wtype||meta.class||
    meta.grades||meta.tier)return null;
 const source=e.explicit(item,'inventory');
 let rule,floor;
 const held=verifiedAvailableOperatingStockQuantity(p.G,p.c.items,item),
  reserved=bot.production?.reservedQuantity?.(item)??0;
 if(!Number.isSafeInteger(held)||!Number.isSafeInteger(reserved)||reserved<0||
    carried&&held<q)return null;
 const backing=held-(carried?q:0);
 if(source){
  if(source.enabled!==true||source.action!=='keep'||source.excessAction!=='sell'||
     !Number.isSafeInteger(source.batch)||source.batch<q)return null;
  const policy=boundedStockSurplus({held:Math.max(0,backing),reserved,
   keep:source.keep,teamReserve:source.teamReserve,maximum:source.maxCount});
  if(!policy.valid)return null;floor=policy.protectedFloor;
  rule={...source,action:'sell',_boundedSource:source,_autoDisposition:true};
 }else{
  rule=operatingStockBaseRule(bot,item);if(!rule)return null;
  floor=rule.keep+reserved;
 }
 const price=e.value(item);
 if(!Number.isSafeInteger(floor)||backing<floor||!Number.isFinite(price)||
    price<rule.minPrice||!e.remaining(rule))return null;
 return {...rule,batch:q,_bankOperatingStock:true,_carriedProtectedFloor:floor};
}


// W04: a protected operating floor may be staged from verified bank stock
// before a DIFFERENT bank stack is considered for sale. This is a
// read-only need, never an implicit permission to withdraw or liquidate.
// Only full, ordinary stack variants qualify; unknown policy is fail-closed.
export function bankOperatingReserveNeed(bot,item){
 const {p,economy:e}=bot,meta=p.G.items?.[item?.name],
  q=item?.q===undefined?1:item.q;
 if(bot.me.role!=='merchant'||!e?.safe?.(item)||
    !boundedStockVariantAllowed(p.G,item)||!meta||(item.level??0)!==0||
    physicalSourceQuantity(p.G,item)===null||
    meta.quest||meta.q||meta.e||meta.exchange||meta.event||
    meta.cash||meta.cash_item||meta.soulbound||meta.compound||
    meta.upgrade||meta.rare||meta.rarity||meta.action||
    meta.onclick||meta.offering||meta.throw||meta.ignore||
    meta.wtype||meta.class||meta.grades||meta.tier)return null;
 const source=e.explicit(item,'inventory');
 let floor,maximum=0;
 if(source){
  if(source.enabled!==true||source.action!=='keep'||
     source.excessAction!=='sell'||!Number.isSafeInteger(source.batch)||
     source.batch<1||!Number.isSafeInteger(source.keep)||
     !Number.isSafeInteger(source.teamReserve)||
     !Number.isSafeInteger(source.maxCount)||
     source.keep<0||source.teamReserve<0||source.maxCount<0)return null;
  floor=source.keep+source.teamReserve;
  maximum=source.maxCount;
 }else{
  const rule=operatingStockBaseRule(bot,item);
  if(!rule)return null;
  floor=rule.keep;
 }
 const reserved=bot.production?.reservedQuantity?.(item)??0;
 const held=verifiedAvailableOperatingStockQuantity(p.G,p.c.items,item);
 if(!Number.isSafeInteger(reserved)||reserved<0||
    !Number.isSafeInteger(held)||held<0||
    !Number.isSafeInteger(floor+reserved))return null;
 // Explicit capped stock uses the SAME protected floor as the eventual
 // bounded surplus sale: max(maxCount, keep + teamReserve + reservations).
 // Staging only keep would move bank stock while leaving no sellable excess.
 floor=Math.max(maximum,floor+reserved);
 if(floor===0||held>=floor)return null;
 return {floor,held,missing:floor-held};
}
