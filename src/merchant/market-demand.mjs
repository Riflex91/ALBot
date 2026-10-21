import {identity,fingerprint} from '../core/policy.mjs';
export function createMarketDemand(bot){
 const {p,cfg}=bot,key='albot:sales:v1:'+bot.me.name,e=bot.economy;
 // A market observation is useful for auto-listing only when its recorded
 // item quantity can physically exist in ONE game trade stack. Explicit
 // q:null is not a singleton and cannot increase estimated market demand.
 const stackLimit=name=>{
  if(typeof name!=='string'||!name||!p.G?.items?.[name])return null;
  const s=p.G.items[name].s;
  return s===true?9999:Number.isSafeInteger(s)&&s>1?s:1;
 };
 const physicalUnits=item=>{
  if(!item||typeof item!=='object'||Array.isArray(item))return null;
  const max=stackLimit(item.name),q=item.q===undefined?1:item.q;
  return max!==null&&Number.isSafeInteger(q)&&q>=1&&q<=max?q:null;
 };
 const storedSaleValid=row=>{
  if(!row||typeof row.variant!=='string'||row.variant.length>2048||
     !Number.isSafeInteger(row.price)||row.price<1||
     !Number.isSafeInteger(row.quantity)||row.quantity<1||
     !Number.isSafeInteger(row.at)||row.at>Date.now()||
     Date.now()-row.at>=604800000)return false;
  let variant;
  try{variant=JSON.parse(row.variant);}catch{return false;}
  if(!Array.isArray(variant)||(variant.length!==9&&variant.length!==10)||
     !Number.isSafeInteger(variant[1])||variant[1]<0)return false;
  const max=stackLimit(variant[0]);
  return max!==null&&row.quantity<=max;
 };
 const saved=p.read(key);let sales=Array.isArray(saved?.sales)?
  saved.sales.filter(storedSaleValid).slice(-128):[];
 let listed=Array.isArray(saved?.listed)?saved.listed.filter(r=>r&&/^trade([1-9]|1[0-6])$/.test(r.slot)&&Number.isFinite(r.at)&&r.item).slice(0,16):[],cooldowns=saved?.cooldowns??{},seen=new Map();
 const save=()=>p.write(key,{version:1,sales,listed,cooldowns});
 const normalized=i=>({name:i.name,level:i.level??0,stat_type:i.stat_type,p:i.p,title:i.title,data:i.data});
 const listingProof=i=>JSON.stringify([fingerprint(i),i?.price,i?.b,i?.giveaway]);
 function sale(d){
  const i=d?.item,q=physicalUnits(i);
  if(q===null||!Number.isSafeInteger(i.price)||i.price<1||
     typeof d.seller!=='string'||!d.seller||
     typeof d.buyer!=='string'||!d.buyer||
     d.seller===d.buyer)return false;
  let variant;
  try{variant=identity(normalized(i));}
  catch{return false;}
  if(typeof variant!=='string'||variant.length>2048)return false;
  const now=Date.now(),
   id=JSON.stringify([d.seller,d.buyer,variant,i.price,q,d.slot]);
  for(const [k,t] of seen)if(now-t>2000)seen.delete(k);if(seen.has(id))return false;seen.set(id,now);if(seen.size>128)seen.delete(seen.keys().next().value);
  sales.push({variant,price:i.price,quantity:q,at:now});sales=sales.filter(r=>now-r.at<604800000).slice(-128);save();return true;
 }
 function proposal(item,r){
  if(!cfg.merchant.autoMarket||!r?._autoDisposition||
     r.action!=='sell'||physicalUnits(item)===null||
     e.explicit(item)||bot.production.reservedQuantity(item)>0)return null;
  const k=identity(normalized(item)),rows=sales.filter(x=>x.variant===k&&Date.now()-x.at<604800000);
  if(rows.length<3||cooldowns[k]>Date.now()||!Number.isFinite(p.c.tax)||p.c.tax<0||p.c.tax>=1)return null;
  const prices=rows.map(x=>x.price).sort((a,b)=>a-b),price=Math.floor(prices[Math.floor(prices.length/2)]*.95);
  const observedHours=Math.max(1,(Date.now()-Math.min(...rows.map(x=>x.at)))/3600000);
  const rate=rows.reduce((n,x)=>n+x.quantity,0)/observedHours;
  const hours=cfg.merchant.listingTtlMs/3600000,probability=Math.min(.8,1-Math.exp(-rate*hours));
  const opportunity=(cfg.production.goldPerHour??0)*hours/16;
  const npc=e.value(item),net=price*(1-p.c.tax),gain=probability*(net-npc)-opportunity;
  const slot=Array.from({length:16},(_,n)=>'trade'+(n+1)).find(s=>!p.c.slots[s]);
  if(!slot||!Number.isFinite(gain)||gain<=npc*cfg.production.minImprovement||price<r.minPrice)return null;
  return {...r,action:'list',slot,priceSource:'fixed',minPrice:price,maxPrice:price,batch:1,_autoMarket:true};
 }
 function posted(slot,item,rule){if(!rule._autoMarket)return true;
  const row={slot,item:normalized(item),fingerprint:listingProof(p.c.slots[slot]),at:Date.now()};
  const previous=listed;listed=[...listed.filter(r=>r.slot!==slot),row];if(!save()){listed=previous;return false;}return true;
 }
 function expire(){
  if(!cfg.merchant.autoMarket||!p.has('unequip'))return false;
  for(const row of [...listed]){
   const current=p.c.slots[row.slot];
   if(!current){listed=listed.filter(r=>r!==row);save();continue;}
   if(Date.now()-row.at<cfg.merchant.listingTtlMs||listingProof(current)!==row.fingerprint||bot.free()<=cfg.merchant.minFreeSlots)continue;
   const before=e.count(row.item),quantity=physicalUnits(current);
   if(quantity===null||!Number.isSafeInteger(before)||before<0||
      !Number.isSafeInteger(before+quantity))continue;
   return e.perform('market.expire',{guard:()=>
    listingProof(p.c.slots[row.slot])===row.fingerprint&&
    physicalUnits(p.c.slots[row.slot])===quantity&&
    bot.free()>cfg.merchant.minFreeSlots,
    call:()=>p.call('unequip',row.slot),observe:()=>!p.c.slots[row.slot]&&
     e.count(row.item)>=before+quantity,
    onConfirmed:()=>{listed=listed.filter(r=>r!==row);cooldowns=Object.fromEntries(Object.entries(cooldowns).filter(([,until])=>until>Date.now()).slice(-127));cooldowns[identity(row.item)]=Date.now()+cfg.merchant.listingTtlMs;return save();},
    details:{item:row.item.name,slot:row.slot,quantity,before}});
  }return false;
 }
 return {sale,proposal,posted,expire,status:()=>({confirmedTrades:sales.length,ownedListings:listed.length})};
}
