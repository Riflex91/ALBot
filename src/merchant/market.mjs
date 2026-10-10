import {identity,fingerprint,distance,samePlace} from '../core/policy.mjs';
export function createMarket(bot){
 const {p,cfg,exec}=bot,e=bot.economy;let secondhand=[],lastScan=0,scanGeneration=0;
 const variant=(a,b)=>a&&b&&a.name===b.name&&(a.level??0)===(b.level??0)&&['stat_type','p','title'].every(k=>(a[k]??'')===(b[k]??''));
 const historyKey='albot:market:'+bot.me.name+':offers';let history=[],lastObserve=0;
 const cached=cfg.merchant.marketHistory?p.read(historyKey):null;if(Array.isArray(cached))history=cached.filter(x=>x&&typeof x.item?.name==='string'&&Number.isFinite(x.price)&&x.price>0&&Number.isFinite(x.at)&&x.at<=Date.now()&&Date.now()-x.at<(cfg.merchant.marketHistoryTtlMs??21600000)).slice(-128);
 function observe(){if(!cfg.merchant.marketHistory||Date.now()-lastObserve<10000)return;lastObserve=Date.now();history=history.filter(x=>Date.now()-x.at<cfg.merchant.marketHistoryTtlMs);
  for(const player of Object.values(p.entities))if(player.name!==p.c.name)for(const [slot,i] of Object.entries(player.slots??{}))if(slot.startsWith('trade')&&i?.name&&!i.giveaway&&Number.isFinite(i.price)&&i.price>0){const item={name:i.name,level:i.level??0,stat_type:i.stat_type??'',p:i.p??'',title:i.title??''},seller=player.name??player.id,side=i.b?'BUY':'SELL',old=history.find(x=>x.seller===seller&&x.side===side&&variant(x.item,item)&&x.price===i.price);if(old){old.at=Date.now();old.quantity=i.q??1;}else history.push({item,price:i.price,quantity:i.q??1,side,at:Date.now(),seller});}
  history=history.slice(-128);p.write(historyKey,history);
 }
 function quote(item){observe();const rows=[];if(cfg.merchant.marketHistory)rows.push(...history.filter(x=>Date.now()-x.at<(cfg.merchant.marketHistoryTtlMs??21600000)&&variant(x.item,item)&&(!x.side||x.side==='SELL')));
  else for(const player of Object.values(p.entities))if(player.name!==p.c.name)for(const [slot,i] of Object.entries(player.slots??{}))if(slot.startsWith('trade')&&variant(i,item)&&!i.b&&!i.giveaway&&Number.isFinite(i.price)&&i.price>0)rows.push({price:i.price,seller:player.name??player.id});
  if(cfg.general.testLogging!==undefined&&new Set(rows.map(x=>x.seller)).size<(cfg.merchant.marketMinSamples??3))return null;
  const values=rows.map(x=>x.price).sort((a,b)=>a-b);return values.length?values[Math.floor(values.length/2)]:null;}
 function price(item,r,sell=false){
  let result=sell?r.minPrice:r.maxPrice;
  if(r.priceSource==='npc')result=e.value(item);
  if(r.priceSource==='market'&&cfg.general.testLogging!==undefined){result=quote(item);if(!result)return null;}else if(r.priceSource==='market'){const values=[];for(const player of Object.values(p.entities))if(player.name!==p.c.name)for(const [slot,i] of Object.entries(player.slots??{}))if(slot.startsWith('trade')&&variant(i,item)&&!i.b&&!i.giveaway&&Number.isFinite(i.price)&&i.price>0)values.push(i.price);if(!values.length){result=quote(item);if(!result)return null;}else{values.sort((a,b)=>a-b);result=values[Math.floor(values.length/2)];}}
  return Number.isFinite(result)&&result>0?Math.floor(sell?Math.max(r.minPrice,result):Math.min(r.maxPrice,result)):null;
 }
 function listing(slot,r){
  const item=p.c.items[slot],q=e.spare(slot,r),before=e.count(item),unitPrice=price(item,r,true);if(!q||!unitPrice||!p.c.stand||!/^trade([1-9]|1[0-6])$/.test(r.slot)||p.c.slots[r.slot])return false;
  return e.perform('market.list',{slots:[slot],rule:r,guard:()=>!!p.c.stand&&!p.c.slots[r.slot]&&e.spare(slot,r)>=q,call:()=>p.call('trade',slot,r.slot,unitPrice,q),observe:()=>{const x=p.c.slots[r.slot];return x&&variant(x,item)&&x.price===unitPrice&&e.count(item)<=before-q;},details:{item:item.name,variant:identity(item),quantity:q,before}});
 }
 function buy(item,r){
  for(const player of Object.values(p.entities)){
   if(player.name===p.c.name||player.type!=='character'||!player.stand||distance(p.c,player)>300)continue;
   for(const [slot,offer] of Object.entries(player.slots??{})){
    const ceiling=price(item,r);if(!slot.startsWith('trade')||!offer||offer.b||offer.giveaway||offer.buy||!offer.rid||!variant(offer,item)||!Number.isFinite(offer.price)||offer.price<=0||!ceiling||offer.price>ceiling)continue;
    const before=e.count(item),q=Math.floor(Math.min(offer.q??1,r.batch,r.targetCount-before,r.maxCount-before)),unitPrice=offer.price,cost=q*unitPrice,rid=offer.rid;
    if(q<=0||bot.free()<=cfg.merchant.minFreeSlots)continue;
    return e.perform('market.buy',{cost,rule:r,guard:()=>{const live=bot.entity(player.id??player.name),current=live?.slots?.[slot];return live&&distance(p.c,live)<=300&&current?.rid===rid&&current.price===unitPrice&&variant(current,item)&&(current.q??1)>=q&&!current.b&&!current.giveaway;},call:()=>p.call('trade_buy',bot.entity(player.id??player.name),slot,q),observe:()=>e.count(item)>=before+q,details:{item:item.name,variant:identity(item),quantity:q,before}});
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
 function sellToBid(slot,r){const item=p.c.items[slot];if(!e.safe(item)||!p.has('trade_sell'))return false;for(const player of Object.values(p.entities)){if(player.name===p.c.name||player.type!=='character'||!player.stand||!samePlace(p.c,player)||distance(p.c,player)>300)continue;for(const [tradeSlot,bid] of Object.entries(player.slots??{})){if(!tradeSlot.startsWith('trade')||!bid?.b||!bid.rid||!variant(bid,item)||(bid.acc??'')!==(item.acc??'')||JSON.stringify(bid.data)!==JSON.stringify(item.data)||!(bid.price>=r.minPrice)||bid.price<=0)continue;const q=Math.min(e.spare(slot,r),bid.q??1),before=e.count(item),gold=p.c.gold,rid=bid.rid;if(q<=0)continue;
 // trade_sell chooses inputs server-side: reject mixed/protected variants it could select.
 if(p.c.items.some(i=>i?.name===item.name&&(i.level??0)===(item.level??0)&&(!e.safe(i)||!variant(i,item))))continue;
 return e.perform('market.sell',{slots:[slot],rule:r,guard:()=>{const h=bot.entity(player.id??player.name),b=h?.slots?.[tradeSlot];return h&&h.stand&&samePlace(p.c,h)&&distance(p.c,h)<=300&&b?.rid===rid&&b.b&&b.price===bid.price&&variant(b,item)&&(b.acc??'')===(item.acc??'')&&JSON.stringify(b.data)===JSON.stringify(item.data)&&(b.q??1)>=q&&e.spare(slot,r)>=q;},call:()=>p.call('trade_sell',bot.entity(player.id??player.name),tradeSlot,q),observe:()=>e.count(item)===before-q&&p.c.gold>=gold+q*bid.price,details:{item:item.name,variant:identity(item),quantity:q,before,expectedGold:q*bid.price}});
 }}return false;}
 // Never use historical ask prices as bids. Only offers from visible, reachable
 // characters, with matching variant, valid rid, remaining quantity and live price.
 function liveBids(item){
  const rows=[];for(const player of Object.values(p.entities??{})){
   if(!player||player.name===p.c.name||player.type!=='character'||!player.stand||!samePlace(p.c,player)||!(distance(p.c,player)<=300)||(typeof bot.entity==='function'&&!bot.entity(player.id??player.name)))continue;
   for(const [slot,bid] of Object.entries(player.slots??{})){
    if(!/^trade([1-9]|1[0-6])$/.test(slot)||!bid?.b||!bid.rid||!variant(bid,item)||
       (bid.acc??'')!==(item.acc??'')||JSON.stringify(bid.data)!==JSON.stringify(item.data)||
       !Number.isFinite(bid.price)||bid.price<=0||!Number.isSafeInteger(bid.q??1)||(bid.q??1)<1)continue;
    rows.push({buyer:player.name??player.id,id:player.id??player.name,slot,rid:bid.rid,price:bid.price,quantity:bid.q??1,distance:distance(p.c,player)});
   }
  }return rows.sort((a,b)=>b.price-a.price||a.distance-b.distance);
 }
 function bidValuation(item,quantity=1,npcUnit=null,{future=true}={}){
  const base=Number.isFinite(npcUnit)&&npcUnit>=0?npcUnit:e.value(item);
  if(!Number.isFinite(base)||base<0||!Number.isSafeInteger(quantity)||quantity<1)return {unitValue:base,covered:0,reason:'unpriced'};
  let remaining=quantity,increment=0,covered=0,travelGold=0;
  for(const bid of liveBids(item)){
   if(remaining<=0)break;if(bid.price<=base)continue;
   const take=Math.min(remaining,bid.quantity);remaining-=take;covered+=take;increment+=take*(bid.price-base);
   // Deliberately conservative opportunity cost for collecting reachable offers.
   travelGold+=Math.max(0,bid.distance-80)/Math.max(1,p.c.speed??40)/3600*Math.max(0,cfg.production.goldPerHour??0);
  }
  // Future mutation output has no guaranteed purchaser. Retain only a quarter
  // of the observed uplift; immediate decisions still discount the live offer.
  const uplift=Math.max(0,increment*(future?.25:.8)-travelGold);
  return {unitValue:base+uplift/quantity,covered,npcUnit:base,future,reason:covered?'visible-bid-discounted':'npc-only'};
 }
 function analysis(item){observe();const rows=history.filter(x=>variant(x.item,item)&&Date.now()-x.at<cfg.merchant.marketHistoryTtlMs),asks=rows.filter(x=>!x.side||x.side==='SELL').map(x=>x.price),bids=rows.filter(x=>x.side==='BUY').map(x=>x.price);const ask=asks.length?Math.min(...asks):null,bid=bids.length?Math.max(...bids):null;return {askingOnly:true,providers:new Set(rows.map(x=>x.seller)).size,ask,bid,spread:ask&&bid?(ask-bid)/ask:null,reference:quote(item),reason:'Beobachtete Angebote, keine bestätigten Handelsumsätze'};}
 return {listing,sellToBid,buy,wishlist,background,quote,analysis,liveBids,bidValuation,status:()=>({observedOffers:history.length,kind:'asking-price',ttlMs:cfg.merchant.marketHistoryTtlMs??21600000}),close(){scanGeneration++;secondhand=[];}};
}
