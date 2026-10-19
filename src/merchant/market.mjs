import {identity,fingerprint,distance,samePlace} from '../core/policy.mjs';
import {capacityAfterConsumption} from '../items/physical-capacity.mjs';
export function createMarket(bot){
 const {p,cfg,exec}=bot,e=bot.economy;let secondhand=[],lastScan=0,scanGeneration=0;
 const marketProbes=new Map(),noOffers=new Map(),MARKET_REPROBE_MS=120000;
 const variant=(a,b)=>a&&b&&a.name===b.name&&(a.level??0)===(b.level??0)&&['stat_type','p','title'].every(k=>(a[k]??'')===(b[k]??''));
 // Finite production material requests require the actual variant, not just
 // the display-level/grade fields used for general market price research.
 // Listing RID belongs to the offer and is validated separately at dispatch.
 const materialVariant=(offer,item)=>variant(offer,item)&&
  (offer.acc??'')===(item.acc??'')&&
  JSON.stringify(offer.data)===JSON.stringify(item.data)&&
  !offer.l&&!offer.bound&&!offer.locked;
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
  const item=p.c.items[slot],q=e.spare(slot,r),before=e.count(item),unitPrice=price(item,r,true),tradeSlot=r.slot;
  if(!Number.isSafeInteger(q)||q<1||!Number.isSafeInteger(unitPrice)||unitPrice<1||!/^trade([1-9]|1[0-6])$/.test(tradeSlot)||p.c.slots[tradeSlot])return false;
  if(!p.c.stand)return bot.merchant?.activateStand?.()??false;
  // A listing can remain advertised after rules/market references have changed.
  // Never publish an old ask below the currently permitted minimum price.
  return e.perform('market.list',{slots:[slot],rule:r,guard:()=>{
   const currentFloor=price(item,r,true);
   return (!r._autoMarket||!!bot.marketDemand?.proposal(item,{...r,action:'sell'}))&&!!p.c.stand&&r.slot===tradeSlot&&!p.c.slots[tradeSlot]&&e.spare(slot,r)>=q&&
    Number.isSafeInteger(currentFloor)&&unitPrice>=currentFloor;
  },call:()=>p.call('trade',slot,tradeSlot,unitPrice,q),observe:()=>{const x=p.c.slots[tradeSlot];return x&&variant(x,item)&&x.price===unitPrice&&e.count(item)<=before-q;},onConfirmed:()=>bot.marketDemand?.posted(tradeSlot,item,r)??true,details:{item:item.name,variant:identity(item),quantity:q,before}});
 }
 // Only a currently visible matching seller can interrupt the no-offer cooldown.
 // Price, remaining quantity, budgets and slot capacity are ALWAYS rechecked
 // independently inside buy() and economy.perform before spending any gold.
 function hasVisibleBuyOffer(item,{strict=false,rule=null}={}){
  // A production wait must wake only for an offer that could actually
  // pass the current acquisition price and finite quantity rules.
  // Diagnostic strict calls without a rule still check only item evidence.
  const ceiling=strict&&rule?price(item,rule):null;
  const held=strict&&rule?e.count(item):null;
  const room=strict&&rule?
   Math.min(rule.batch,rule.targetCount-held,rule.maxCount-held):null;
  if(strict&&rule&&(
   rule.action!=='marketBuy'||rule.enabled===false||
   !Number.isSafeInteger(ceiling)||ceiling<1||
   !Number.isSafeInteger(held)||held<0||
   !Number.isSafeInteger(room)||room<1))return false;
  return Object.values(p.entities??{}).some(player=>player&&
   player.name!==p.c.name&&player.type==='character'&&player.stand&&
   samePlace(p.c,player)&&distance(p.c,player)<=300&&
   Object.entries(player.slots??{}).some(([slot,offer])=>
    /^trade([1-9]|1[0-6])$/.test(slot)&&offer?.rid&&
    !offer.b&&!offer.giveaway&&!offer.buy&&
    Number.isFinite(offer.price)&&offer.price>0&&
    (!strict||(Number.isSafeInteger(offer.price)&&
     Number.isSafeInteger(offer.q??1)&&(offer.q??1)>0&&
     typeof offer.rid==='string'&&offer.rid.length>0))&&
    (strict?materialVariant(offer,item):variant(offer,item))&&
    (!strict||!rule||offer.price<=ceiling)));
 }
 function offerWaitMs(item){
  return hasVisibleBuyOffer(item)?0:Math.max(0,(noOffers.get(identity(item))??0)-Date.now());
 }
 function buy(item,r,scope=null){
  // Production-market procurement is tied to one live finite plan step.
  // Ordinary explicitly configured market-buy tasks retain their behavior.
  const finite=scope!==null;
  if(finite&&(!scope||!Number.isSafeInteger(scope.quantity)||
      scope.quantity<1||scope.quantity>1000000||
      typeof scope.admit!=='function'||scope.admit()!==true))return false;
  const entries=Object.values(p.entities??{}).flatMap(player=>
   Object.entries(player?.slots??{}).map(([slot,offer])=>({player,slot,offer})));
  if(finite){
   // Rank only currently eligible, exact-variant offers. A lower price on
   // a different material, stale listing or malformed quantity must not
   // distort the choice. All authorization guards still run at dispatch.
   const priceRank=({player,slot,offer})=>
    player&&player.name!==p.c.name&&player.type==='character'&&
    player.stand&&samePlace(p.c,player)&&distance(p.c,player)<=300&&
    /^trade([1-9]|1[0-6])$/.test(slot)&&
    offer&&!offer.b&&!offer.buy&&!offer.giveaway&&
    typeof offer.rid==='string'&&!!offer.rid&&
    Number.isSafeInteger(offer.price)&&offer.price>0&&
    Number.isSafeInteger(offer.q??1)&&(offer.q??1)>0&&
    materialVariant(offer,item)?offer.price:Infinity;
   entries.sort((a,b)=>priceRank(a)-priceRank(b));
  }
  for(const {player,slot,offer} of entries){
   if(!player||player.name===p.c.name||player.type!=='character'||!player.stand||!samePlace(p.c,player)||distance(p.c,player)>300)continue;
    const ceiling=price(item,r);if(!/^trade([1-9]|1[0-6])$/.test(slot)||!offer||offer.b||offer.giveaway||offer.buy||!offer.rid||!(finite?materialVariant(offer,item):variant(offer,item))||!Number.isFinite(offer.price)||offer.price<=0||!ceiling||offer.price>ceiling)continue;
    // Production purchases cannot round malformed seller quantities or
    // risk a fractional / non-safe total gold debit. Free explicit market
    // rules retain their previous selection contract.
    if(finite&&(!Number.isSafeInteger(offer.q??1)||(offer.q??1)<1||
      !Number.isSafeInteger(offer.price)||offer.price<1||
      typeof offer.rid!=='string'||!offer.rid))continue;
    const before=e.count(item),q=Math.floor(Math.min(offer.q??1,r.batch,r.targetCount-before,r.maxCount-before,finite?scope.quantity:Infinity)),unitPrice=offer.price,cost=q*unitPrice,rid=offer.rid;
    if(!Number.isSafeInteger(q)||q<=0||
      finite&&(!Number.isSafeInteger(before)||before<0||
       !Number.isSafeInteger(cost)||cost<1)||
      bot.free()<=cfg.merchant.minFreeSlots)continue;
    const fits=()=>{
     if(!finite)return true;
     const room=capacityAfterConsumption(p.c.items,[],item,
      p.G?.items?.[item.name],{inventorySize:p.c.isize});
     return !!room&&room.units>=q;
    };
    if(!fits())continue;
    noOffers.delete(identity(item));
    let response=null,dispatchGold=null;
    return e.perform('market.buy',{cost,rule:r,guard:()=>{const live=bot.entity(player.id??player.name),current=live?.slots?.[slot];const limit=price(item,r);return (!finite||scope.admit()===true&&q<=scope.quantity&&
      e.count(item)===before&&Number.isSafeInteger(current?.q??1)&&
      (current?.q??1)>0&&Number.isSafeInteger(current?.price))&&
      fits()&&live?.type==='character'&&!!live.stand&&samePlace(p.c,live)&&distance(p.c,live)<=300&&current?.rid===rid&&current.price===unitPrice&&Number.isFinite(limit)&&unitPrice<=limit&&(finite?materialVariant(current,item):variant(current,item))&&(current.q??1)>=q&&!current.b&&!current.giveaway&&!current.buy&&e.count(item)+q<=Math.min(r.targetCount,r.maxCount)&&bot.free()>cfg.merchant.minFreeSlots;},call:()=>{dispatchGold=p.c.gold;return Promise.resolve(p.call('trade_buy',bot.entity(player.id??player.name),slot,q)).then(result=>{response=result;return result;});},
    observe:()=>finite?
     !!response&&typeof response==='object'&&!response.failed&&
      response.success!==false&&Number.isSafeInteger(dispatchGold)&&
      p.c.gold===dispatchGold-cost&&e.count(item)===before+q:
     e.count(item)>=before+q,
    details:{item:item.name,variant:identity(item),quantity:q,before,
     unitPrice,seller:player.name??player.id,tradeSlot:slot,rid,
     source:finite?'finite-production-plan':'explicit-market-rule'}});
  }
  // A search for missing live player offers is not an admitted purchase.
  // The first trip is allowed; subsequent bank->market journeys are bounded
  // per item. New valid live offers are checked before this cooldown.
  const key=identity(item),now=Date.now();
  const d=cfg.merchant.position.enabled?{...cfg.merchant.position,in:cfg.merchant.position.map}:e.destination('citizen22');
  const at=d&&(cfg.merchant.position.enabled?e.at(d):e.npcAt(d));
  if(at){
   // An observed empty market is a *read-only* planning signal. Let other
   // safe production goals run until the next bounded search or live offer.
   noOffers.set(key,now+MARKET_REPROBE_MS);
   if(noOffers.size>64)noOffers.delete(noOffers.keys().next().value);
   if((marketProbes.get(key)??0)<=now)
    bot.event?.('market.noOffer',{item:item.name,level:item.level??0,
     reason:'Kein freigegebenes Live-Marktangebot; kein Kauf ausgeführt',
     retryMs:MARKET_REPROBE_MS});
   marketProbes.set(key,now+MARKET_REPROBE_MS);
   if(marketProbes.size>64)marketProbes.delete(marketProbes.keys().next().value);
   return false;
  }
  if(!d||now<(marketProbes.get(key)??0))return false;
  marketProbes.set(key,now+MARKET_REPROBE_MS);
  if(cfg.merchant.position.enabled)e.travel(d,'Marktsuche');
  else e.npcTravel(d,'Marktsuche');
  return bot.movement?.order?.owner==='economy';
 }
 function wishlist(item,r){
  const unitPrice=price(item,r),q=Math.floor(Math.min(r.batch,r.targetCount-e.count(item),r.maxCount-e.count(item))),cost=q*unitPrice,tradeSlot=r.slot;
  if(!Number.isSafeInteger(unitPrice)||unitPrice<1||!Number.isSafeInteger(q)||q<1||!Number.isSafeInteger(cost)||
    !/^trade([1-9]|1[0-6])$/.test(tradeSlot)||p.c.slots[tradeSlot])return false;
  if(!p.c.stand)return bot.merchant?.activateStand?.()??false;
  // A passive buy order reserves real gold. Pin both its posting slot and
  // maximum exposure to the original authorized decision.
  return e.perform('market.wishlist',{cost,rule:r,guard:()=>{
   const liveCeiling=price(item,r);
   return !!p.c.stand&&r.slot===tradeSlot&&!p.c.slots[tradeSlot]&&e.count(item)+q<=Math.min(r.targetCount,r.maxCount)&&
    Number.isSafeInteger(liveCeiling)&&unitPrice<=liveCeiling;
  },call:()=>p.call('wishlist',tradeSlot,item.name,unitPrice,item.level??0,q),observe:()=>{const x=p.c.slots[tradeSlot];return x?.name===item.name&&x.b&&x.price===unitPrice;},details:{item:item.name,quantity:q}});
 }
 function background(){
  observe();
  if(cfg.merchant.giveaways)for(const player of Object.values(p.entities))for(const [slot,offer] of Object.entries(player.slots??{})){
   if(!offer?.giveaway||!offer.rid||distance(p.c,player)>300||offer.list?.includes(p.c.name))continue;
   if(exec.run('giveaway',['social'],()=>bot.running,()=>p.call('join_giveaway',player.name,slot,offer.rid),{delay:60000}))return true;
  }
  if(!cfg.merchant.ponty)return false;
  const d=e.destination('secondhands');if(!d)return false;
  if(Date.now()-lastScan>60000){if(!e.npcTravel(d,'Ponty'))return true;const token=++scanGeneration;
   const accepted=exec.run('ponty.scan',['economy'],()=>bot.running,()=>Promise.resolve(p.call('get_secondhands',10000)).then(x=>{if(bot.running&&token===scanGeneration)secondhand=Array.isArray(x?.items)?x.items.slice(0,100):[];}),{delay:60000});if(accepted)lastScan=Date.now();return accepted;}
  for(const i of secondhand){const item={...i};delete item.rid;const r=e.rules(item,'acquisition');if(r?.action!=='marketBuy'||!e.remaining(r)||!i.rid||!e.safe(i))continue;
   const factor=p.G.multipliers?.[p.G.items[i.name]?.cash?'secondhands_cash_mult':'secondhands_mult']??(p.G.items[i.name]?.cash?3:2);
   const price=Math.ceil(e.value(i)*factor*(i.q??1)),q=i.q??1,before=e.count(item),reference=thisReference(item,r);
   if(!Number.isFinite(price)||price<=0||!reference||price>Math.min(r.maxPrice*q,cfg.merchant.pontyMaxSpend)||price>reference*q*cfg.merchant.bargainRatio||before+q>Math.min(r.targetCount,r.maxCount)||q>r.batch||bot.free()<=cfg.merchant.minFreeSlots)continue;
   if(!e.npcTravel(d,'Ponty-Kauf'))return true;
   const accepted=e.perform('ponty.buy',{cost:price,rule:r,guard:()=>e.npcAt(d)&&e.count(item)===before,call:()=>p.call('buy_secondhand',i.rid,10000),observe:()=>e.count(item)>=before+q,details:{item:i.name,quantity:q,before}});if(accepted)secondhand=secondhand.filter(x=>x.rid!==i.rid);return accepted;
  }return false;
 }
 function thisReference(item,r){if(r.priceSource==='fixed')return r.maxPrice;if(r.priceSource==='npc')return e.value(item);return price(item,r);}
 // The official trade_sell API selects an inventory slot server-side. Every
 // same-name/level stack must therefore be safe to consume, not just the slot
 // proposed by the scheduler. Recheck this at dispatch after any inventory drift.
 function saleInventorySafe(slot,rule,quantity){
  const chosen=p.c.items?.[slot];
  if(!chosen||!Number.isSafeInteger(quantity)||quantity<1)return false;
  const same=p.c.items.map((item,n)=>({item,n})).filter(({item})=>item?.name===chosen.name&&(item.level??0)===(chosen.level??0));
  if(!same.length)return false;
  return same.every(({item,n})=>e.safe(item)&&variant(item,chosen)&&
   (item.acc??'')===(chosen.acc??'')&&JSON.stringify(item.data)===JSON.stringify(chosen.data)&&
   e.spare(n,rule)>=quantity&&(!e.rules||e.rules(item,'inventory')?.action===rule.action));
 }
 // The server rounds the *total* payout, not each unit. Never estimate
 // profitable automatic resale from a gross bid or from unknown tax.
 function netBid(quantity,price,tax){
  if(!Number.isSafeInteger(quantity)||quantity<1||!Number.isFinite(price)||price<=0||
     !Number.isFinite(tax)||tax<0||tax>=1)return null;
  const gross=quantity*price,net=Math.round(gross*(1-tax));
  return Number.isSafeInteger(gross)&&Number.isSafeInteger(net)&&net>=0?
    {gross,net,tax,quantity,price}:null;
 }
 function sellToBid(slot,r){
  const item=p.c.items[slot];if(!e.safe(item)||!p.has('trade_sell'))return false;
  const npc=e.value?.(item),automatic=r?._autoDisposition===true;
  const candidates=liveBids(item).flatMap(bid=>{
   const quantity=Math.min(e.spare(slot,r),bid.quantity),tax=p.c.tax;
   const valuation=netBid(quantity,bid.price,Number.isFinite(tax)?tax:(automatic?NaN:0));
   if(!valuation||bid.price<r.minPrice||!saleInventorySafe(slot,r,quantity)||
      automatic&&(!Number.isFinite(npc)||valuation.net<=npc*quantity))return [];
   return [{bid,quantity,...valuation,margin:Number.isFinite(npc)?valuation.net-npc*quantity:valuation.net}];
  }).sort((a,b)=>b.margin-a.margin||b.net-a.net||a.bid.distance-b.bid.distance);
  for(const chosen of candidates){
   const {bid,quantity:q,net:expectedGold,price:unitPrice,tax}=chosen;
   const before=e.count(item),gold=p.c.gold,rid=bid.rid,tradeSlot=bid.slot;
   const buyerId=bid.id;
   return e.perform('market.sell',{slots:[slot],rule:r,guard:()=>{
    const h=bot.entity(buyerId),b=h?.slots?.[tradeSlot];
    const currentTax=Number.isFinite(p.c.tax)?p.c.tax:(automatic?NaN:0);
    const valuation=netBid(q,unitPrice,currentTax);
    const currentNpc=e.value?.(item);
    return h?.type==='character'&&!!h.stand&&samePlace(p.c,h)&&distance(p.c,h)<=300&&
     b?.rid===rid&&b.b&&Number.isFinite(b.price)&&b.price===unitPrice&&
     Number.isFinite(r.minPrice)&&unitPrice>=r.minPrice&&variant(b,item)&&
     (b.acc??'')===(item.acc??'')&&JSON.stringify(b.data)===JSON.stringify(item.data)&&
     Number.isSafeInteger(b.q??1)&&(b.q??1)>=q&&valuation?.net===expectedGold&&
     (!automatic||Number.isFinite(currentNpc)&&valuation.net>currentNpc*q)&&
     saleInventorySafe(slot,r,q);
   },call:()=>p.call('trade_sell',bot.entity(buyerId),tradeSlot,q),
   observe:()=>e.count(item)===before-q&&p.c.gold===gold+expectedGold,
   details:{item:item.name,variant:identity(item),quantity:q,before,expectedGold,buyer:bid.buyer}});
  }
  return false;
 }
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
  if(!Number.isFinite(base)||base<0||!Number.isSafeInteger(quantity)||quantity<1)
   return {unitValue:base,totalValue:null,covered:0,reason:'unpriced'};
  let remaining=quantity,increment=0,covered=0,travelGold=0;
  const bids=liveBids(item),tax=p.c.tax;
  // Missing tax is unverified economic evidence, not free money.
  if(!Number.isFinite(tax)||tax<0||tax>=1)
   return {unitValue:base,totalValue:quantity*base,covered:0,npcUnit:base,future,reason:'unknown-tax'};
  for(const bid of bids){
   if(remaining<=0)break;
   const take=Math.min(remaining,bid.quantity),net=netBid(take,bid.price,tax);
   if(!net||net.net<=base*take)continue;
   remaining-=take;covered+=take;increment+=net.net-base*take;
   travelGold+=Math.max(0,bid.distance-80)/Math.max(1,p.c.speed??40)/3600*
    Math.max(0,cfg.production?.goldPerHour??0);
  }
  const uplift=Math.max(0,increment*(future?.25:.8)-travelGold);
  return {unitValue:base+uplift/quantity,totalValue:base*quantity+uplift,
   covered,npcUnit:base,future,reason:covered?'net-visible-bid-discounted':'npc-only'};
 }
 function analysis(item){observe();const rows=history.filter(x=>variant(x.item,item)&&Date.now()-x.at<cfg.merchant.marketHistoryTtlMs),asks=rows.filter(x=>!x.side||x.side==='SELL').map(x=>x.price),bids=rows.filter(x=>x.side==='BUY').map(x=>x.price);const ask=asks.length?Math.min(...asks):null,bid=bids.length?Math.max(...bids):null;return {askingOnly:true,providers:new Set(rows.map(x=>x.seller)).size,ask,bid,spread:ask&&bid?(ask-bid)/ask:null,reference:quote(item),reason:'Beobachtete Angebote, keine bestätigten Handelsumsätze'};}
 return {listing,sellToBid,buy,wishlist,background,quote,analysis,liveBids,bidValuation,
  hasVisibleBuyOffer,offerWaitMs,
  status:()=>({observedOffers:history.length,kind:'asking-price',ttlMs:cfg.merchant.marketHistoryTtlMs??21600000,
   noOfferWaits:[...noOffers].filter(([,until])=>until>Date.now()).map(([item,until])=>({item,retryAt:until})).slice(0,20)}),
  close(){scanGeneration++;secondhand=[];noOffers.clear();}};
}
