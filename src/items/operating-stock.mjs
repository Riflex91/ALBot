import {boundedStockVariantAllowed,localVariantQuantity} from './stock-policy.mjs';
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
export function automaticOperatingStockRule(bot,item){
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
 const held=localVariantQuantity(p.c.items,item),
  reserved=bot.production?.reservedQuantity?.(item)??0;
 if(!Number.isSafeInteger(held)||!Number.isSafeInteger(reserved)||reserved<0||
    !Number.isSafeInteger(floor+reserved)||held<=floor+reserved)return null;
 const price=e.value(item);if(!Number.isFinite(price)||price<0)return null;
 const excess=held-floor-reserved;
 return {...defaultsFor(ITEM_RULE),name:'Betriebsvorrat '+item.name,
  enabled:true,item:item.name,role:me.role,character:me.name,action:'sell',
  minLevel:0,maxLevel:0,priority:-350,keep:floor,teamReserve:0,
  batch:Math.min(9999,item.q??1,excess),maxCount:1000000000,minPrice:Math.floor(price),
  _autoDisposition:true,_autoOperatingStock:true};
}
