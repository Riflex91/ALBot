import {identity,fingerprint,distance} from '../core/policy.mjs';
export function createMarket(bot){
 const {p,cfg,exec}=bot,e=bot.economy;let secondhand=[],lastScan=0;
 const variant=(a,b)=>a&&b&&a.name===b.name&&(a.level??0)===(b.level??0)&&['stat_type','p','title'].every(k=>(a[k]??'')===(b[k]??''));
 function price(item,r,sell=false){
  let result=sell?r.minPrice:r.maxPrice;
  if(r.priceSource==='npc')result=e.value(item);
  if(r.priceSource==='market'){const values=[];for(const player of Object.values(p.entities))for(const [slot,i] of Object.entries(player.slots??{}))if(slot.startsWith('trade')&&variant(i,item)&&!i.b&&!i.giveaway&&Number.isFinite(i.price)&&i.price>0)values.push(i.price);if(!values.length)return null;values.sort((a,b)=>a-b);result=values[Math.floor(values.length/2)];}
  return Number.isFinite(result)&&result>0?Math.floor(sell?Math.max(r.minPrice,result):Math.min(r.maxPrice,result)):null;
 }
 function listing(slot,r){
  const item=p.c.items[slot],q=e.spare(slot,r),before=e.count(item),unitPrice=price(item,r,true);if(!q||!unitPrice||!p.c.stand||!/^trade([1-9]|1[0-6])$/.test(r.slot)||p.c.slots[r.slot])return false;
  return e.perform('market.list',{slots:[slot],rule:r,guard:()=>!!p.c.stand&&!p.c.slots[r.slot]&&e.spare(slot,r)>=q,call:()=>p.call('trade',slot,r.slot,unitPrice,q),observe:()=>{const x=p.c.slots[r.slot];return x&&variant(x,item)&&x.price===unitPrice&&e.count(item)<=before-q;},details:{item:item.name,quantity:q,before}});
 }
 function buy(item,r){
  for(const player of Object.values(p.entities)){
   if(player.type!=='character'||!player.stand||distance(p.c,player)>300)continue;
   for(const [slot,offer] of Object.entries(player.slots??{})){
    const ceiling=price(item,r);if(!slot.startsWith('trade')||!offer||offer.b||offer.giveaway||offer.buy||!offer.rid||!variant(offer,item)||!Number.isFinite(offer.price)||offer.price<=0||!ceiling||offer.price>ceiling)continue;
    const before=e.count(item),q=Math.floor(Math.min(offer.q??1,r.batch,r.targetCount-before,r.maxCount-before)),unitPrice=offer.price,cost=q*unitPrice,rid=offer.rid;
    if(q<=0||bot.free()<=cfg.merchant.minFreeSlots)continue;
    return e.perform('market.buy',{cost,rule:r,guard:()=>{const live=bot.entity(player.id??player.name),current=live?.slots?.[slot];return live&&distance(p.c,live)<=300&&current?.rid===rid&&current.price===unitPrice&&variant(current,item)&&(current.q??1)>=q&&!current.b&&!current.giveaway;},call:()=>p.call('trade_buy',bot.entity(player.id??player.name),slot,q),observe:()=>e.count(item)>=before+q,details:{item:item.name,quantity:q,before}});
   }
  }return false;
 }
 function wishlist(item,r){
  const unitPrice=price(item,r),q=Math.floor(Math.min(r.batch,r.targetCount-e.count(item),r.maxCount-e.count(item))),cost=q*unitPrice;if(!unitPrice||q<=0||!p.c.stand||!/^trade([1-9]|1[0-6])$/.test(r.slot)||p.c.slots[r.slot])return false;
  // Reserve full maximum exposure when publishing a passive purchase order.
  return e.perform('market.wishlist',{cost,rule:r,guard:()=>!!p.c.stand&&!p.c.slots[r.slot],call:()=>p.call('wishlist',r.slot,item.name,unitPrice,item.level??0,q),observe:()=>{const x=p.c.slots[r.slot];return x?.name===item.name&&x.b&&x.price===unitPrice;},details:{item:item.name,quantity:q}});
 }
 function background(){
  if(cfg.merchant.giveaways)for(const player of Object.values(p.entities))for(const [slot,offer] of Object.entries(player.slots??{})){
   if(!offer?.giveaway||!offer.rid||distance(p.c,player)>300||offer.list?.includes(p.c.name))continue;
   if(exec.run('giveaway',['social'],()=>bot.running,()=>p.call('join_giveaway',player.name,slot,offer.rid),{delay:60000}))return true;
  }
  if(!cfg.merchant.ponty)return false;
  const d=e.destination('secondhands');if(!e.at(d))return false;
  if(Date.now()-lastScan>60000){lastScan=Date.now();return exec.run('ponty.scan',['economy'],()=>bot.running,()=>Promise.resolve(p.call('get_secondhands',10000)).then(x=>{secondhand=Array.isArray(x?.items)?x.items.slice(0,100):[];}),{delay:60000});}
  for(const i of secondhand){const r=e.rules(i,'acquisition');if(r?.action!=='marketBuy'||!i.rid||!e.safe(i))continue;
   const price=i.price,q=i.q??1,before=e.count(i);if(!Number.isFinite(price)||price<=0||price>Math.min(r.maxPrice*q,cfg.merchant.pontyMaxSpend)||price>e.value(i)*q*cfg.merchant.bargainRatio||before+q>r.targetCount)continue;
   return e.perform('ponty.buy',{cost:price,rule:r,guard:()=>e.at(d)&&e.count(i)===before,call:()=>p.call('buy_secondhand',i.rid,10000),observe:()=>e.count(i)>=before+q,details:{item:i.name,quantity:q,before}});
  }return false;
 }
 return {listing,buy,wishlist,background};
}
