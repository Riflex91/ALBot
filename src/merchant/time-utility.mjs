import {distance,samePlace} from '../core/policy.mjs';

// This model ranks opportunities, NEVER authorizes an item/gold mutation.
// Only same-map distance/speed supplies a measurable travel lower bound.
// Cross-map smart_move latency is intentionally unknown, not invented.
export function travelLowerBoundMs(character,destination){
 if(!character||!destination||!samePlace(character,destination)||
    !Number.isFinite(character.speed)||character.speed<=0||
    ![character.x,character.y,destination.x,destination.y].every(Number.isFinite))
  return null;
 return Math.max(0,Math.floor(1000*distance(character,destination)/character.speed));
}

export function exchangeWorksiteValue({
 character,destination,item,unit,confirmed=0,observedBatchMs=null,now=Date.now(),
 lastConfirmed=0
}={}){
 const quantity=item?.q??(item?1:0);
 const remainingBatches=Number.isSafeInteger(quantity)&&quantity>0&&
  Number.isSafeInteger(unit)&&unit>0?Math.floor(quantity/unit):0;
 const commuteLowerBoundMs=travelLowerBoundMs(character,destination);
 const local=commuteLowerBoundMs!==null&&commuteLowerBoundMs<=110000/
  Math.max(1,Number(character?.speed)||1)*1000;
 const sampled=Number.isFinite(observedBatchMs)&&observedBatchMs>=250&&observedBatchMs<=60000;
 return {remainingBatches,local,
  travelLowerBoundMs:commuteLowerBoundMs,
  observedBatchMs:sampled?Math.round(observedBatchMs):null,
  remainingWorkMs:sampled?Math.min(Number.MAX_SAFE_INTEGER,
   Math.round(remainingBatches*observedBatchMs)):null,
  confirmed,
  freshnessMs:Number.isFinite(now)&&Number.isFinite(lastConfirmed)&&lastConfirmed<=now?
   now-lastConfirmed:null};
}

// A bounded locality bonus only adjusts automatic, noncritical merchant work.
// Explicitly authored priority, high-priority rescue work and value guards
// retain their original ordering. The waiting-age scheduler still prevents
// permanently losing a runnable task to locality.
export function timeAdjustedMerchantPriority({
 base,automatic=false,critical=false,character,destination,
 units=1,perAction=1
}={}){
 if(!Number.isFinite(base))return -100;
 if(critical||!automatic)return base;
 const lower=travelLowerBoundMs(character,destination);
 if(lower===null)return base;
 const actions=Math.max(1,Math.floor((Number(units)||1)/Math.max(1,Number(perAction)||1)));
 if(lower<=3000)return base+Math.min(12,3+Math.floor(Math.log2(actions+1))*2);
 return base-Math.min(8,Math.floor(lower/12000));
}
