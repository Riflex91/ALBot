import {identity,fingerprint,distance} from '../core/policy.mjs';
export function createMarket(bot){
 const {p,cfg,exec}=bot,e=bot.economy;let secondhand=[],lastScan=0,scanGeneration=0;
 const variant=(a,b)=>a&&b&&a.name===b.name&&(a.level??0)===(b.level??0)&&['stat_type','p','title'].every(k=>(a[k]??'')===(b[k]??''));
 const historyKey='albot:market:'+bot.me.name+':offers';let history=[],lastObserve=0;
 const cached=cfg.merchant.marketHistory?p.read(historyKey):null;if(Array.isArray(cached))history=cached.filter(x=>x&&typeof x.item?.name==='string'&&Number.isFinite(x.price)&&x.price>0&&Number.isFinite(x.at)&&x.at<=Date.now()&&Date.now()-x.at<(cfg.merchant.marketHistoryTtlMs??21600000)).slice(-64);
 function observe(){if(!cfg.merchant.marketHistory||Date.now()-lastObserve<10000)return;lastObserve=Date.now();history=history.filter(x=>Date.now()-x.at<cfg.merchant.marketHistoryTtlMs);
  for(const player of Object.values(p.entities))if(player.name!==p.c.name)for(const [slot,i] of Object.entries(player.slots??{}))if(slot.startsWith('trade')&&i?.name&&!i.b&&!i.giveaway&&Number.isFinite(i.price)&&i.price>0){const item={name:i.name,level:i.level??0,stat_type:i.stat_type??'',p:i.p??'',title:i.title??''},seller=player.name??player.id,old=history.find(x=>x.seller===seller&&variant(x.item,item));if(old){old.price=i.price;old.at=Date.now();}else history.push({item,price:i.price,at:Date.now(),seller});}
  history=history.slice(-64);p.write(historyKey,history);
 }
 function quote(item){observe();const rows=history.filter(x=>Date.now()-x.at<(cfg.merchant.marketHistoryTtlMs??21600000)&&variant(x.item,item)).map(x=>x.price);if(!cfg.merchant.marketHistory)for(const player of Object.values(p.entities))if(player.name!==p.c.name)for(const [slot,i] of Object.entries(player.slots??{}))if(slot.startsWith('trade')&&variant(i,item)&&!i.b&&!i.giveaway&&Number.isFinite(i.price)&&i.price>0)rows.push(i.price);rows.sort((a,b)=>a-b);return rows.length?rows[Math.floor(rows.length/2)]:null;}
 function price(item,r,sell=false){
  let result=sell?r.minPrice:r.maxPrice;
  if(r.priceSource==='npc')result=e.value(item);
  if(r.priceSource==='market'){const values=[];for(const player of Object.values(p.entities))if(player.name!==p.c.name)for(const [slot,i] of Object.entries(player.slots??{}))if(slot.startsWith('trade')&&variant(i,item)&&!i.b&&!i.giveaway&&Number.isFinite(i.price)&&i.price>0)values.push(i.price);if(!values.length){result=quote(item);if(!result)return null;}else{values.sort((a,b)=>a-b);result=values[Math.floor(values.length/2)];}}
  return Number.isFinite(result)&&result>0?Math.floor(sell?Math.max(r.minPrice,result):Math.min(r.maxPrice,result)):null;
 }
 function listing(slot,r){
  const item=p.c.items[slot],q=e.spare(slot,r),before=e.count(item),unitPrice=price(item,r,true);if(!q||!unitPrice||!p.c.stand||!/^trade([1-9]|1[0-6])$/.test(r.slot)||p.c.slots[r.slot])return false;
  return e.perform('market.list',{slots:[slot],rule:r,guard:()=>!!p.c.stand&&!p.c.slots[r.slot]&&e.spare(slot,r)>=q,call:()=>p.call('trade',slot,r.slot,unitPrice,q),observe:()=>{const x=p.c.slots[r.slot];return x&&variant(x,item)&&x.price===unitPrice&&e.count(item)<=before-q;},details:{item:item.name,quantity:q,before}});
 }
 function buy(item,r){
  for(const player of Object.values(p.entities)){
   if(player.name===p.c.name||player.type!=='character'||!player.stand||distance(p.c,player)>300)continue;
   for(const [slot,offer] of Object.entries(player.slots??{})){
    const ceiling=price(item,r);if(!slot.startsWith('trade')||!offer||offer.b||offer.giveaway||offer.buy||!offer.rid||!variant(offer,item)||!Number.isFinite(offer.price)||offer.price<=0||!ceiling||offer.price>ceiling)continue;
    const before=e.count(item),q=Math.floor(Math.min(offer.q??1,r.batch,r.targetCount-before,r.maxCount-before)),unitPrice=offer.price,cost=q*unitPrice,rid=offer.rid;
    if(q<=0||bot.free()<=cfg.merchant.minFreeSlots)continue;
    return e.perform('market.buy',{cost,rule:r,guard:()=>{const live=bot.entity(player.id??player.name),current=live?.slots?.[slot];return live&&distance(p.c,live)<=300&&current?.rid===rid&&current.price===unitPrice&&variant(current,item)&&(current.q??1)>=q&&!current.b&&!current.giveaway;},call:()=>p.call('trade_buy',bot.entity(player.id??player.name),slot,q),observe:()=>e.count(item)>=before+q,details:{item:item.name,quantity:q,before}});
   }
  }const d=cfg.merchant.position.enabled?{...cfg.merchant.position,in:cfg.merchant.position.map}:e.destination('citizen22');if(d&&!e.at(d)){e.travel(d,'Marktsuche');return true;}return false;
 }
 function wishlist(item,r){
  const unitPrice=price(item,r),q=Math.floor(Math.min(r.batch,r.targetCount-e.count(item),r.maxCount-e.count(item))),cost=q*unitPrice;if(!unitPrice||q<=0||!p.c.stand||!/^trade([1-9]|1[0-6])$/.test(r.slot)||p.c.slots[r.slot])return false;
  // Reserve full maximum exposure when publishing a passive purchase order.
  return e.perform('market.wishlist',{cost,rule:r,guard:()=>!!p.c.stand&&!p.c.slots[r.slot],call:()=>p.call('wishlist',r.slot,item.name,unitPrice,item.level??0,q),observe:()=>{const x=p.c.slots[r.slot];return x?.name===item.name&&x.b&&x.price===unitPrice;},details:{item:item.name,quantity:q}});
 }
 function background(){
  observe();
  if(cfg.merchant.giveaways)for(const player of Object.values(p.entities))for(const [slot,offer] of Object.entries(player.slots??{})){
   if(!offer?.giveaway||!offer.rid||distance(p.c,player)>300||offer.list?.includes(p.c.name))continue;
   if(exec.run('giveaway',['social'],()=>bot.running,()=>p.call('join_giveaway',player.name,slot,offer.rid),{delay:60000}))return true;
  }
  if(!cfg.merchant.ponty)return false;
  const d=e.destination('secondhands');if(!d)return false;
  if(Date.now()-lastScan>60000){if(!e.travel(d,'Ponty'))return true;const token=++scanGeneration;
   const accepted=exec.run('ponty.scan',['economy'],()=>bot.running,()=>Promise.resolve(p.call('get_secondhands',10000)).then(x=>{if(bot.running&&token===scanGeneration)secondhand=Array.isArray(x?.items)?x.items.slice(0,100):[];}),{delay:60000});if(accepted)lastScan=Date.now();return accepted;}
  for(const i of secondhand){const item={...i};delete item.rid;const r=e.rules(item,'acquisition');if(r?.action!=='marketBuy'||!e.remaining(r)||!i.rid||!e.safe(i))continue;
   const factor=p.G.multipliers?.[p.G.items[i.name]?.cash?'secondhands_cash_mult':'secondhands_mult']??(p.G.items[i.name]?.cash?3:2);
   const price=Math.ceil(e.value(i)*factor*(i.q??1)),q=i.q??1,before=e.count(item),reference=thisReference(item,r);
   if(!Number.isFinite(price)||price<=0||!reference||price>Math.min(r.maxPrice*q,cfg.merchant.pontyMaxSpend)||price>reference*q*cfg.merchant.bargainRatio||before+q>Math.min(r.targetCount,r.maxCount)||q>r.batch||bot.free()<=cfg.merchant.minFreeSlots)continue;
   if(!e.travel(d,'Ponty-Kauf'))return true;
   const accepted=e.perform('ponty.buy',{cost:price,rule:r,guard:()=>e.at(d)&&e.count(item)===before,call:()=>p.call('buy_secondhand',i.rid,10000),observe:()=>e.count(item)>=before+q,details:{item:i.name,quantity:q,before}});if(accepted)secondhand=secondhand.filter(x=>x.rid!==i.rid);return accepted;
  }return false;
 }
 function thisReference(item,r){if(r.priceSource==='fixed')return r.maxPrice;if(r.priceSource==='npc')return e.value(item);return price(item,r);}
 return {listing,buy,wishlist,background,quote,status:()=>({observedOffers:history.length,kind:'asking-price',ttlMs:cfg.merchant.marketHistoryTtlMs??21600000}),close(){scanGeneration++;secondhand=[];}};
}
