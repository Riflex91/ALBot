import {identity,protectedItem} from '../core/policy.mjs';
import {itemPurposes} from './purposes.mjs';
import {isAchievementCarrier} from './achievement-utility.mjs';

// W02. Physical quantities and independent gross claims stay separate.
// A maximum is a local post-disposition floor, NOT a permission to consume
// reserved stock. No account-wide inference from stale/offline bank packs.
export function boundedStockSurplus({held,reserved=0,keep=0,teamReserve=0,maximum}={}){
 const values=[held,reserved,keep,teamReserve,maximum];
 if(!values.every(x=>Number.isSafeInteger(x)&&x>=0))
  return {valid:false,reason:'invalid-or-unknown-stock',excess:0,protectedFloor:null};
 const committed=reserved+keep+teamReserve;
 if(!Number.isSafeInteger(committed))
  return {valid:false,reason:'reservation-overflow',excess:0,protectedFloor:null};
 const protectedFloor=Math.max(maximum,committed);
 return {valid:true,reason:held>protectedFloor?'bounded-excess':'no-bounded-excess',
  held,reserved,keep,teamReserve,maximum,protectedFloor,
  excess:Math.max(0,held-protectedFloor)};
}
export function boundedStockVariantAllowed(G,item){
 if(!item||protectedItem(item)||isAchievementCarrier(item)||
    item.data!==undefined||item.acc||item.rid||item.p||
    item.title||item.stat_type||item.skin||item.expires||item.special)return false;
 const purposes=itemPurposes(G,item);
 if(!purposes.known)return false;
 // Valuable / special / operating gear must not enter an automatic sale
 // merely because a generic keep rule happens to specify a quantity cap.
 return !purposes.tags.some(tag=>[
  'equipment','skillEquipment','skillConsumable','tokenCurrency','instanceKey',
  'utility','quest','unreviewed'
 ].includes(tag));
}
export function localVariantQuantity(inventory,item){
 if(!Array.isArray(inventory)||!item?.name)return null;
 let count=0;
 const key=identity(item);
 for(const stock of inventory){
  if(!stock||identity(stock)!==key)continue;
  const q=stock.q??1;
  if(!Number.isSafeInteger(q)||q<1||!Number.isSafeInteger(count+q))
   return null;
  count+=q;
 }
 return count;
}
export function boundedExcessSaleRule({item,inventory,G,rule,reserved=0}={}){
 if(!rule?.enabled||rule.action!=='keep'||rule.excessAction!=='sell'||
    rule.item!==item?.name||!boundedStockVariantAllowed(G,item))
  return null;
 const held=localVariantQuantity(inventory,item);
 const policy=boundedStockSurplus({held,reserved,keep:rule.keep,
  teamReserve:rule.teamReserve,maximum:rule.maxCount});
 if(!policy.valid||policy.excess<1||
    !Number.isSafeInteger(rule.batch)||rule.batch<1)return null;
 return {...rule,action:'sell',_autoBoundedExcess:true,
  _boundedSource:rule,batch:Math.min(rule.batch,policy.excess)};
}
