import {identity,fingerprint} from '../core/policy.mjs';
import {itemPurposes} from '../items/purposes.mjs';
export function tokenOffer(G,token,output){
 const raw=G.tokens?.[token]?.[output];
 if(!Number.isFinite(raw)||raw<=0||output.includes('-'))return null;
 const cost=raw<1?1:raw,quantity=raw<1?Math.floor(1/raw):1;
 return Number.isSafeInteger(cost)&&Number.isSafeInteger(quantity)&&quantity>0?{cost,quantity}:null;
}
export function dismantleOutputs(G,item,value){
 if(G.items?.[item.name]?.compound&&(item.level??0)>0){
  if(G.items[item.name].type==='booster')return null;
  return {cost:Math.min(50000000,value*10),outputs:[{name:item.name,level:item.level-1,quantity:3}]};
 }
 const d=G.dismantle?.[item.name];
 if(!d||!Number.isFinite(d.cost)||d.cost<0||!Array.isArray(d.items)||!d.items.length)return null;
 if(d.items.some(r=>!Number.isSafeInteger(r[0])||r[0]<1||typeof r[1]!=='string'||!G.items[r[1]]))return null;
 const merged=new Map();for(const [q,name] of d.items)merged.set(name,(merged.get(name)??0)+q);
 return {cost:d.cost,outputs:[...merged].map(([name,quantity])=>({name,level:0,quantity}))};
}
export function createConversions(bot){
 const {p,cfg,me}=bot,e=bot.economy;
 const plain=i=>e.safe(i)&&!i.p&&!i.title&&!i.stat_type&&!i.data&&!i.acc&&!i.rid&&!i.expires&&!i.v;
 function tokens(){
  if(!cfg.production.tokenBuy||!p.has('exchange_buy'))return false;
  // Only explicit, unaddressed inventory goals spend scarce token currency.
  // Remote repeatable deliveries and implicit gear targets keep their current
  // allocation planner; never spend tokens repeatedly after a delivery.
  for(const g of cfg.production.goals.filter(g=>g.enabled&&!g.recipient&&g.level===0)){
   const output={name:g.item,level:0},before=e.count(output);if(before>=g.quantity)continue;
   const rule=e.explicit(output,'acquisition');if(rule&&rule.action!=='tokenBuy')continue;
   for(const token of Object.keys(p.G.tokens??{})){
    const offer=tokenOffer(p.G,token,g.item);if(!offer||offer.cost>(cfg.production.tokenMaxPerPurchase??0)||before+offer.quantity>g.quantity)continue;
    // The runner chooses the first name match. Pin precisely that slot.
    const slot=p.c.items.findIndex(i=>i?.name===token),item=p.c.items[slot]&&{...p.c.items[slot]};if(!plain(item)||(item.q??1)<offer.cost)continue;
    const policy=e.rules(item),reserve=(policy?.keep??0)+(policy?.teamReserve??0)+(bot.production.reservedQuantity(item)??0);
    if(policy?.action==='keep'||e.count(item)-offer.cost<reserve||bot.free()<=cfg.merchant.minFreeSlots)continue;
    const cost=e.value(item)*offer.cost;if(!Number.isFinite(cost)||cost>g.budget)continue;
    const d=e.destination(p.G.items[token]?.npc??token+'s');if(!e.npcTravel(d,'Token-Shop'))return false;
    const fp=fingerprint(item),definition=JSON.stringify(p.G.tokens[token][g.item]);
    return e.perform('tokenBuy',{slots:[slot],loss:cost,rule:{name:g.name,item:g.item,action:'tokenBuy',_autoProduction:true,goldBudget:0,lossBudget:Math.min(g.budget,cfg.production.lossBudget)},guard:()=>
     cfg.production.enabled&&cfg.production.tokenBuy&&g.enabled&&!g.recipient&&g.level===0&&g.item===output.name&&
     cfg.production.goals.includes(g)&&e.count(output)===before&&before+offer.quantity<=g.quantity&&
     offer.cost<=cfg.production.tokenMaxPerPurchase&&
     (!e.explicit(output,'acquisition')||e.explicit(output,'acquisition').action==='tokenBuy')&&
     p.c.items.findIndex(i=>i?.name===token)===slot&&fingerprint(p.c.items[slot])===fp&&
     JSON.stringify(p.G.tokens?.[token]?.[g.item])===definition&&e.npcAt(d)&&
     e.rules(item)?.action!=='keep'&&e.count(item)-offer.cost>=Math.max(reserve,(e.rules(item)?.keep??0)+(e.rules(item)?.teamReserve??0)+(bot.production.reservedQuantity(item)??0))&&cost<=g.budget&&bot.free()>cfg.merchant.minFreeSlots,
     call:()=>p.call('exchange_buy',token,g.item),observe:()=>
      e.count(output)===before+offer.quantity&&
      ((p.c.items[slot]?.name===token?p.c.items[slot].q:0)===(item.q??1)-offer.cost),
     details:{item:g.item,token,quantity:offer.quantity,tokenCost:offer.cost,before}});
   }
  }return false;
 }
 function dismantle(){
  if(!cfg.production.dismantle||!p.has('dismantle'))return false;
  for(let slot=0;slot<p.c.items.length;slot++){
   const item=p.c.items[slot];if(!plain(item))continue;
   const r=e.rules(item);if(!r?._autoDisposition||r.action!=='sell'||e.spare(slot,r)<1)continue;
   const purpose=itemPurposes(p.G,item);if(purpose.protected||purpose.recipes.length)continue;
   const inputValue=e.value(item),conversion=dismantleOutputs(p.G,item,inputValue);if(!conversion)continue;
   const sale=bot.market?.bidValuation?.(item,1,inputValue,{future:false})?.totalValue??inputValue;
   const value=conversion.outputs.reduce((n,o)=>n+e.value(o)*o.quantity,0);
   if(!Number.isFinite(value)||value-conversion.cost<=sale*(1+cfg.production.minImprovement)||
     conversion.cost>cfg.production.helperMaxPrice||bot.free()<conversion.outputs.reduce((n,o)=>n+(p.G.items[o.name]?.s?1:o.quantity),0)+cfg.merchant.minFreeSlots)continue;
   const d=e.destination('craftsman');if(!e.npcTravel(d,'Dismantle'))return false;
   const before=e.count(item),counts=conversion.outputs.map(o=>e.count(o)),proof=JSON.stringify([p.G.dismantle?.[item.name],p.G.items[item.name]]);
   return e.perform('dismantle',{slots:[slot],cost:conversion.cost,loss:inputValue,rule:r,
    guard:()=>cfg.production.enabled&&cfg.production.dismantle&&e.rules(item)?._autoDisposition&&
     e.rules(item)?.action==='sell'&&e.spare(slot,r)>0&&e.npcAt(d)&&
     !itemPurposes(p.G,item).protected&&!itemPurposes(p.G,item).recipes.length&&
     conversion.cost<=cfg.production.helperMaxPrice&&
     JSON.stringify([p.G.dismantle?.[item.name],p.G.items[item.name]])===proof&&
     bot.production.reservedQuantity(item)===0,
    call:()=>p.call('dismantle',slot),observe:()=>e.count(item)===before-1&&
     conversion.outputs.every((o,n)=>e.count(o)===counts[n]+o.quantity),
    details:{item:item.name,variant:identity(item),quantity:1,before}});
  }return false;
 }
 return {tick:()=>me.role==='merchant'&&cfg.production.enabled&&!bot.journal&&!bot.inventoryBlocked&&(tokens()||dismantle())};
}
