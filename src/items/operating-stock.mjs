import {boundedStockVariantAllowed,localVariantQuantity,boundedStockSurplus} from './stock-policy.mjs';
import {defaultsFor} from '../../editor/lib/contract.mjs';
import {ITEM_RULE} from '../../editor/lib/schema.mjs';
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
function operatingStockBaseRule(bot,item){
 const {cfg,p,me}=bot,e=bot.economy;
 if(me.role!=='merchant'||!cfg.merchant?.enabled||
    cfg.production?.enabled!==true||cfg.production?.autoDisposition!==true||
    cfg.merchant.preventiveStorage!==true||!e||!e.safe(item)||
    !boundedStockVariantAllowed(p.G,item)||(item.level??0)!==0||
    ['inventory','production','acquisition'].some(phase=>e.explicit(item,phase)))
  return null;
 const meta=p.G.items?.[item.name],floor=operatingStockFloor(item.name,cfg,
  new Set(bot.farmers??[]).size);
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
 const held=localVariantQuantity(bot.p.c.items,item),
  reserved=bot.production?.reservedQuantity?.(item)??0;
 if(!Number.isSafeInteger(held)||!Number.isSafeInteger(reserved)||reserved<0||
    !Number.isSafeInteger(rule.keep+reserved)||held<=rule.keep+reserved)return null;
 return {...rule,batch:Math.min(9999,item.q??1,held-rule.keep-reserved)};
}
// Whole bank-stack disposition is authorized only when the FULL floor is
// already physically carried. Retained bank stock is NEVER sale backing.
// The existing bank reclaim journal still proves the exact withdrawal.
export function bankOperatingStockRule(bot,item,{carried=false}={}){
 const {p}=bot,e=bot.economy,meta=p.G.items?.[item?.name],q=item?.q??1;
 if(bot.me.role!=='merchant'||!e?.safe(item)||
    !boundedStockVariantAllowed(p.G,item)||!meta||(item.level??0)!==0||
    !Number.isSafeInteger(q)||q<1||q>9999)return null;
 if(meta.quest||meta.q||meta.e||meta.exchange||meta.event||meta.cash||meta.cash_item||
    meta.soulbound||meta.compound||meta.upgrade||meta.rare||meta.rarity||meta.action||
    meta.onclick||meta.offering||meta.throw||meta.ignore||meta.wtype||meta.class||
    meta.grades||meta.tier)return null;
 const source=e.explicit(item,'inventory');
 let rule,floor;
 const held=localVariantQuantity(p.c.items,item),backing=held-(carried?q:0),
  reserved=bot.production?.reservedQuantity?.(item)??0;
 if(!Number.isSafeInteger(held)||!Number.isSafeInteger(reserved)||reserved<0)return null;
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
