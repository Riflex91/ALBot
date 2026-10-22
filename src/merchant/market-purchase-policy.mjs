// One explicit, currently enabled acquisition rule is the sole authority for
// market purchases. Autonomous production and old funding snapshots do not
// create purchase permission.
export function marketRuleApproved(rule){
 return !!rule&&rule.enabled===true&&rule.action==='marketBuy';
}
// Purchase price cap: no validated independent market reference means NO BUY.
// The absolute maxPrice remains a hard ceiling even at >100% of the median.
export function marketPurchaseCeiling(rule,marketMedian){
 if(!marketRuleApproved(rule)||!Number.isSafeInteger(rule.maxPrice)||rule.maxPrice<1)return null;
 if(rule.priceSource!=='marketRatio')return rule.maxPrice;
 if(!Number.isSafeInteger(rule.marketPercent)||rule.marketPercent<10||rule.marketPercent>150||
    !Number.isSafeInteger(marketMedian)||marketMedian<1)return null;
 const cap=Math.floor(marketMedian*rule.marketPercent/100);
 return Number.isSafeInteger(cap)&&cap>=1?Math.min(rule.maxPrice,cap):null;
}
// One current observation per independently named seller; a seller cannot
// make a reference price by publishing many historical offers.
export function independentSellerMedian(rows,minimum=3){
 if(!Array.isArray(rows)||!Number.isSafeInteger(minimum)||minimum<3)return null;
 const bySeller=new Map();
 for(const r of rows){
  if(typeof r?.seller!=='string'||!r.seller||
     !Number.isSafeInteger(r.price)||r.price<1||
     !Number.isFinite(r.at??0))continue;
  const old=bySeller.get(r.seller);
  if(!old||(r.at??0)>=(old.at??0))bySeller.set(r.seller,r);
 }
 if(bySeller.size<minimum)return null;
 const prices=[...bySeller.values()].map(r=>r.price).sort((a,b)=>a-b);
 return prices[Math.floor(prices.length/2)];
}
