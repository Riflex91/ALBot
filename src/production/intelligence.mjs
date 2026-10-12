import {identity} from '../core/policy.mjs';
const identityVariant=(a,b)=>identity(a)===identity(b);
import {materialDrops} from './materials.mjs';
import {gearScore,gearCompatible,gearSuitability} from './gear.mjs';
import {defaultsFor} from '../../editor/lib/contract.mjs';
import {ITEM_RULE} from '../../editor/lib/schema.mjs';
const HISTORICAL_CHANCES={upgrade:[[.9999999,.98,.95,.7,.6,.4,.25,.15,.07,.024],[.99998,.97,.94,.68,.58,.38,.24,.14,.066,.018],[.97,.94,.92,.64,.52,.32,.232,.13,.062,.015]],compound:[[.99,.75,.4,.25,.2,.1,.07,.05,.05,.05],[.9,.7,.4,.2,.15,.08,.07,.05,.05,.03],[.8,.6,.32,.16,.1,.07,.03,.03,.03,.02]]};
export function progressionChance(G,name,level,kind){
 const m=G.items?.[name],targetLevel=level+1;
 if(!m||!Number.isInteger(level)||level<0||!['upgrade','compound'].includes(kind))return null;
 // Official progression: the probability grade is distinct from the scroll
 // grade. Upgrade uses the base grade; compound uses level - 2 above +3.
 const probabilityLevel=kind==='compound'&&targetLevel>3?targetLevel-3:0;
 const grade=Array.isArray(m.grades)?
   (probabilityLevel>=m.grades[1]?2:probabilityLevel>=m.grades[0]?1:0):
   (Number.isInteger(m.igrade)?m.igrade:0);
 if(!Number.isInteger(grade)||grade<0||grade>2)return null;
 const table=kind==='compound'?G.compounds:G.upgrades;
 // Missing cells in a PRESENT live table are unknown, not permission to use
 // an obsolete historical probability.
 const value=table?(table[grade]?.[targetLevel]??table.chances?.[grade]?.[targetLevel]):
   HISTORICAL_CHANCES[kind]?.[grade]?.[level];
 return Number.isFinite(value)&&value>0&&value<=1?value:null;
}
export function createEconomicIntelligence(bot){const {p,cfg,me}=bot;let evaluated=[],at=0,allocation=[],chances=new Map(),props=new Map(),propsVersion=p.G.version,profitAt=0,profits=[],stockEpoch=-1,stocks=null;
 function chanceEvidenceKey(name,level,kind,scroll,offering=''){
  return JSON.stringify([p.G.version,p.G.items?.[name],kind,level,scroll,
   p.G.items?.[scroll],offering,offering?p.G.items?.[offering]:null]);
 }
 function mutationChance(name,level,kind){
  const grade=p.call('item_grade',{name,level});
  const scroll=(kind==='compound'?'cscroll':'scroll')+grade;
  const key=chanceEvidenceKey(name,level,kind,scroll,'');
  const observed=chances.get(key);
  return observed&&Date.now()-observed.at<3600000?observed.value:
   progressionChance(p.G,name,level,kind);
 }
 function properties(i){if(propsVersion!==p.G.version){propsVersion=p.G.version;props.clear();}const key=identity(i);if(props.has(key))return props.get(key);const value=p.call('item_properties',i);if(props.size>=512)props.clear();props.set(key,value);return value;}
 function stockItems(){if(stocks&&Number.isInteger(bot.decisionEpoch)&&stockEpoch===bot.decisionEpoch)return stocks;const result=p.c.items.filter(i=>i&&bot.economy.safe(i)).map(i=>({item:i,owner:me.name}));for(const row of bot.bank?.catalogStock?.()??(bot.bank?.packs?.()??[]).flatMap(([pack,items])=>
   items.filter(i=>i&&bot.economy.safe(i)).map(item=>({pack,item}))))
   if(row.item&&bot.economy.safe(row.item))result.push({item:row.item,owner:me.name,pack:row.pack,
    observedAt:row.evidence?.observedAt??null});for(const [name] of bot.transport.peers){const h=bot.transport.fresh(name);if(h?.running&&!h.rip&&h.realm===p.realm())for(const row of h.stock??[])result.push({item:row,owner:name});}stocks=result.slice(0,400);stockEpoch=bot.decisionEpoch;return stocks;} function targets(){if(cfg.production.optimizeGear===false||!cfg.production.autoGear||!cfg.production.gear||cfg.general.testLogging===undefined)return [];if(Date.now()-at<cfg.general.planningTickMs)return evaluated;at=Date.now();evaluated=[];allocation=[];const ownedStock=stockItems();
  for(const member of cfg.characters.filter(c=>c.enabled)){const profile=member.name===me.name?bot.gear.snapshot():bot.gear.profile(member.name);if(!profile)continue;const role=member.gearRole==='auto'?profile.class==='priest'?'healer':profile.class==='merchant'?'economy':'dps':member.gearRole;
   for(const [slot,old] of Object.entries(Object.fromEntries([...new Set([...Object.keys(profile.slots),'mainhand','offhand','helmet','chest','pants','shoes','gloves','amulet','belt','cape','ring1','ring2','earring1','earring2','orb'])].map(slot=>[slot,profile.slots[slot]??null])))){if(old?.l||old?.b||cfg.production.gearTargets.some(g=>g.enabled&&g.character===member.name&&g.slot===slot))continue;let previous=0;try{previous=old?gearScore(properties(old),role,profile.class):0;}catch{continue;}
    let best=null;for(const name of new Set([...cfg.production.autoGearItems,...ownedStock.map(r=>r.item.name)])){if(!gearCompatible(p.G,profile,{name,level:0},slot))continue;const meta=p.G.items[name];for(let level=0;level<=(meta.upgrade||meta.compound?cfg.production.autoGearMaxLevel:0);level++){if(old?.name===name&&old.level>=level)continue;const explicit=bot.economy.explicit({name,level:Math.max(0,level-1)},'production');if(level>0&&explicit&&(explicit.action==='keep'||explicit.targetLevel<level))continue;
     const owned=ownedStock.filter(r=>r.item.name===name&&(r.item.level??0)<=level).sort((a,b)=>(b.item.level??0)-(a.item.level??0))[0];let chance=1,cost=owned?0:meta.g??Infinity;for(let l=owned?.item.level??0;l<level;l++){const c=mutationChance(name,l,meta.compound?'compound':'upgrade');if(c===null){chance=0;break;}const grade=p.call('item_grade',{name,level:l}),scroll=(meta.compound?'cscroll':'scroll')+grade;cost=(cost*(meta.compound?3:1)+(p.G.items[scroll]?.g??Infinity))/c;chance*=c;}
     if(chance<cfg.production.minChance||cost>cfg.production.autoGearBudget||!Number.isFinite(cost))continue;let score;try{const nextStats=properties({name,level}),oldStats=old?properties(old):null;if(!gearSuitability(oldStats,nextStats,role,profile.class,member.merchantMobility).ok)continue;score=gearScore(nextStats,role,profile.class);}catch{continue;}const improvement=score-previous,utility=improvement*chance/(1+cost/Math.max(1,cfg.production.autoGearBudget));if(improvement<Math.abs(previous)*cfg.production.minImprovement||utility<=0)continue;if(!best||utility>best.utility)best={name:'Optimiertes Gear '+member.name+' '+slot,item:name,level,quantity:1,character:member.name,slot,enabled:true,budget:cfg.production.autoGearBudget,priority:member.catchUp?35:15,utility,chance,estimatedCost:cost,sourceOwner:owned?.owner??null,sourceLevel:owned?.item.level??0,variant:owned?{stat_type:owned.item.stat_type??'',p:owned.item.p??'',title:owned.item.title??''}:undefined};
    }}if(best){evaluated.push(best);allocation.push({character:member.name,slot,item:best.item,level:best.level,utility:best.utility,state:'reserved',recipientSession:bot.transport.fresh(member.name)?.session??null});}}
  }return evaluated;
 }
 function gearUse(i){
 const meta=p.G.items?.[i?.name];
 const isEquipment=!!meta&&(!!meta.upgrade||!!meta.compound||
   !!meta.wtype||['weapon','helmet','chest','pants','shoes','ring','earring',
   'amulet','belt','cape','gloves','orb','shield'].includes(meta.type));
 if(!isEquipment)return {state:'no-gear-use',reason:'not-equipment',checked:0};
 // Only selected active farmers and their merchant may reserve a gear item;
 // enabled-but-offline account alternates must not freeze all gear sales.
 const names=new Set([...(bot.farmers??[]),cfg.party.merchant]);
 const members=(cfg.characters??[]).filter(c=>c.enabled&&names.has(c.name));
 if(!members.length)return {state:'unknown',reason:'no-expected-profiles',checked:0};
 if(i.data!==undefined||i.p||i.title||i.stat_type||i.acc||i.rid||i.special)
   return {state:'unknown',reason:'specific-variant-not-proven',checked:0};
 let checked=0;
 const horizon=meta.upgrade||meta.compound?Math.max(i.level??0,cfg.production.autoGearMaxLevel??0):(i.level??0);
 for(const member of members){
  // A stale profile is not evidence of disuse. Remote profiles must have an
  // independently fresh heartbeat even when old gear is cached locally.
  const peer=member.name===me.name?null:bot.transport?.fresh?.(member.name);
  const profile=member.name===me.name?bot.gear?.snapshot?.():bot.gear?.profile?.(member.name);
  if(!profile||!profile.slots||!profile.class||
     member.name!==me.name&&(!peer||!peer.running||peer.rip||peer.realm!==p.realm()))
    return {state:'unknown',reason:'missing-or-stale-profile:'+member.name,checked,horizon};
  // A fresh status heartbeat cannot make a week-old cached profile fresh.
  // Only current-session, realm-bound, complete gear evidence can prove
  // negative utility and authorize an automatic sale.
  if(member.name!==me.name&&(!profile.complete||profile.session!==peer.session||
    profile.realm!==p.realm()||!Number.isFinite(profile.at)||
    Date.now()-profile.at>120000||profile.at>Date.now()))
   return {state:'unknown',reason:'gear-evidence-unverified:'+member.name,
    checked,horizon,profileAgeMs:Number.isFinite(profile.at)?Date.now()-profile.at:null};
  checked++;
  const role=member.gearRole==='auto'?
   (profile.class==='priest'?'healer':profile.class==='merchant'?'economy':'dps'):member.gearRole;
  const slots=new Set([...Object.keys(profile.slots),'mainhand','offhand','helmet','chest','pants','shoes','gloves','amulet','belt','cape','ring1','ring2','earring1','earring2','orb']);
  for(const slot of slots){
   if(!gearCompatible(p.G,profile,i,slot))continue;
   const old=profile.slots[slot]??null;
   let oldStats,oldScore;
   try{
    oldStats=old?properties(old):{};
    if(old&&!oldStats)return {state:'unknown',reason:'unknown-current-stats',checked,horizon};
    oldScore=old?gearScore(oldStats,role,profile.class):0;
   }catch{return {state:'unknown',reason:'invalid-current-stats',checked,horizon};}
   for(let level=Math.max(0,i.level??0);level<=horizon;level++){
    try{
     const candidate={...i,level},newStats=properties(candidate);
     if(!newStats||typeof newStats!=='object')return {state:'unknown',reason:'unknown-candidate-stats',checked,horizon};
     if(!gearSuitability(oldStats,newStats,role,profile.class,member.merchantMobility).ok)continue;
     const score=gearScore(newStats,role,profile.class);
     if(score>oldScore+Math.max(.01,Math.abs(oldScore)*(cfg.production.minImprovement??0)))
      return {state:'gear-useful',reason:'improvement:'+member.name+':'+slot,checked,horizon,level};
    }catch{return {state:'unknown',reason:'gear-analysis-failed',checked,horizon};}
   }
  }
 }
 return {state:'no-gear-use',reason:'checked-all-expected-profiles-within-horizon',checked,horizon};
}
function futureGear(i){return gearUse(i).state!=='no-gear-use';}
 // Discounted, quantity-bounded bids supplement the NPC baseline only when a
 // verified buyer is currently reachable; a future upgrade gets a larger haircut.
 function resaleValue(item,quantity=1,future=true){
  const npc=bot.economy.value(item);const bid=bot.market?.bidValuation?.(item,quantity,npc,{future});
  return Number.isFinite(bid?.unitValue)&&bid.unitValue>=npc?bid.unitValue:npc;
 }
 function finiteCompoundValue(i,max,current,heldOverride=null){
 // Sell-or-compound optimization over the FINITE, currently actionable
 // inventory. Each batch consumes three units; a failed attempt returns zero
 // units. Future results cannot be financed with nonexistent inputs.
 const local=p.c.items.filter(x=>x&&identityVariant(x,i)&&bot.economy.safe(x))
   .reduce((n,x)=>n+(Number.isSafeInteger(x.q)&&x.q>0?x.q:1),0);
 const held=Number.isSafeInteger(heldOverride)&&heldOverride>=local?heldOverride:local;
 const reserved=bot.production?.reservedQuantity?.(i)??0;
 const n=Math.max(0,Math.min(42,held-Math.max(0,reserved)));
 if(n<1)return {level:i.level??0,ev:current,action:'bank',reason:'no-unreserved-copies'};
 const start=i.level??0,memo=new Map(),priceCache=new Map();
 const saleTotal=(level,quantity)=>{
  if(quantity<=0)return 0;
  const key=level+':'+quantity;
  if(!priceCache.has(key)){
   const item={...i,level},npc=bot.economy.value(item);
   const quote=bot.market?.bidValuation?.(item,quantity,npc,{future:level>start});
   const total=Number.isFinite(quote?.totalValue)?quote.totalValue:
    Number.isFinite(quote?.unitValue)?quote.unitValue*quantity:npc*quantity;
   priceCache.set(key,Number.isFinite(total)?Math.max(npc*quantity,total):NaN);
  }
  return priceCache.get(key);
 };
 function solve(l,count){
  if(count<=0)return {value:0,groups:0};
  const key=l+':'+count;if(memo.has(key))return memo.get(key);
  const sale=saleTotal(l,count);
  let best={value:sale,groups:0};
  if(l<max&&count>=3&&Number.isFinite(sale)){
   const c=mutationChance(i.name,l,'compound');
   const grade=p.call('item_grade',{...i,level:l});
   const cost=p.G.items?.['cscroll'+grade]?.g;
   if(c>=cfg.production.minChance&&Number.isFinite(cost)&&cost>=0&&
     cost<=cfg.production.helperMaxPrice){
    for(let k=1;k<=Math.floor(count/3);k++){
     if(k*cost>cfg.production.helperMaxPrice)break;
     let expected=0,comb=1;
     for(let j=0;j<=k;j++){
      const prob=comb*Math.pow(c,j)*Math.pow(1-c,k-j);
      expected+=prob*solve(l+1,j).value;
      comb=comb*(k-j)/(j+1);
     }
     const total=saleTotal(l,count-3*k)+expected-k*cost;
     if(Number.isFinite(total)&&total>best.value*(1+(cfg.production.minImprovement??0)))
      best={value:total,groups:k};
    }
   }
  }
  memo.set(key,best);return best;
 }
 const answer=solve(start,n);
 return {level:start+(answer.groups?1:0),ev:answer.value/n,
   action:answer.groups?'compound':'sell',quantity:n,groups:answer.groups,
   reason:answer.groups?'finite-stock-compound':'finite-stock-sell'};
}
function mutationEconomics(i,{heldOverride=null}={}){const m=p.G.items[i.name],kind=m?.compound?'compound':'upgrade',factor=kind==='compound'?3:1,current=resaleValue(i,1,false),max=cfg.production.autoProfitMaxLevel??cfg.production.autoGearMaxLevel;if(!Number.isFinite(current)||cfg.production.lossBudget>0&&current>cfg.production.lossBudget)return {level:i.level??0,ev:current,action:'bank',reason:'auto-mutation-exposure'};if(kind==='compound')return finiteCompoundValue(i,max,current,heldOverride);let best={level:i.level??0,ev:current,action:'sell'},value=resaleValue({...i,level:max},1,true);if(!Number.isFinite(value))return best;
  for(let l=max-1;l>=(i.level??0);l--){const c=mutationChance(i.name,l,kind),grade=p.call('item_grade',{...i,level:l}),scrollCost=p.G.items[(kind==='compound'?'cscroll':'scroll')+grade]?.g,immediate=resaleValue({...i,level:l},1,l>(i.level??0));if(!(c>=cfg.production.minChance)||!Number.isFinite(scrollCost)||!Number.isFinite(immediate)){value=immediate;continue;}const ev=(c*value-scrollCost)/factor;if(ev>immediate*(1+cfg.production.minImprovement)&&scrollCost<=cfg.production.helperMaxPrice){value=ev;if(l===(i.level??0))best={level:l+1,ev,action:kind};}else value=immediate;}
  return best;
 }
 const decisionLedger=new Map();
 function noteDisposition(item,rule,choice=null){
  const key=identity(item),local=(p.c.items??[]).filter(i=>i&&identityVariant(i,item))
   .reduce((n,i)=>n+(i.q??1),0),all=stockItems().filter(r=>identityVariant(r.item,item));
  const bank=all.filter(r=>r.pack).reduce((n,r)=>n+(r.item.q??1),0);
  const peers=all.filter(r=>r.owner!==me.name).reduce((n,r)=>n+(r.item.q??1),0);
  const g=p.G.items?.[item.name]??{},progressive=!!(g.upgrade||g.compound);
  const chance=progressive?mutationChance(item.name,item.level??0,
   g.compound?'compound':'upgrade'):null;
  const gear=progressive?gearUse(item):{state:'not-applicable',reason:'not-gear'};
  const value=bot.economy.value(item);
  const bid=bot.market?.bidValuation?.(item,1,value,{future:false});
  const entry={at:Date.now(),item:item.name,level:item.level??0,
   variant:key,source:rule?._autoDisposition?'autonomous':'explicit',
   gearState:gear.state,gearReason:gear.reason,profileAgeMs:gear.profileAgeMs??null,
   gearHorizon:gear.horizon??null,profitHorizon:cfg.production.autoProfitMaxLevel??null,
   local,bank,peers,reserved:bot.production?.reservedQuantity?.(item)??0,
   npcValue:value,marketNet:bid?.totalValue??null,bidEvidence:bid?.reason??'unavailable',
   chance,chanceSource:chance===null?'unknown':'official-or-context-matched-preview',
   expectedValue:choice?.ev??null,nextStep:rule?.action??'keep',
   reason:choice?.reason??gear.reason,
   stopReason:rule?'':gear.state==='unknown'?'gear-evidence-unverified':'no-eligible-auto-rule'};
  decisionLedger.delete(key);decisionLedger.set(key,entry);
  if(decisionLedger.size>24)decisionLedger.delete(decisionLedger.keys().next().value);
 }
  function disposition(i){if(cfg.production.autoDisposition!==true||!bot.economy.safe(i)||bot.production.reservedQuantity(i)>0)return null;
  // Preserve any unusual item variant; NPC sell value does not price rare
  // effects (such as cxjar with data="makeawish"). Explicit user rules win.
  if(i.data!==undefined&&i.data!==null||i.acc||i.rid||i.p||i.title||i.stat_type||i.skin||i.expires)return null;const m=p.G.items[i.name];if(!m||m.cash||m.quest||m.event||['pot','elixir','scroll','uscroll','cscroll','offering','stand','tool','booster'].includes(m.type))return null;
  const equipment=!!(m.upgrade||m.compound||m.wtype||
    ['weapon','helmet','chest','pants','shoes','ring','earring','amulet',
    'belt','cape','gloves','orb','shield'].includes(m.type));
  if(equipment){
    if(futureGear(i))return null;
    const value=bot.economy.value(i),progressable=!!(m.upgrade||m.compound);
    const choice=progressable?mutationEconomics(i):{level:i.level??0,ev:value,action:'sell',reason:'non-progressive-equipment'};
    const count=p.c.items.filter(x=>x&&identityVariant(x,i)).reduce((n,x)=>n+(x.q??1),0);let action=me.role==='farmer'?'send':choice.action;
   if(me.role==='merchant'&&['upgrade','compound'].includes(action)&&(!cfg.production.enabled||!cfg.production[action]))action='bank';if(me.role==='merchant'&&progressable&&m.compound&&count<3){
    const hypothetical=mutationEconomics(i,{heldOverride:3});
    // Only accumulate when completing ONE bounded triple is economically
    // better than selling the inputs; otherwise preserve the sell decision.
    if(hypothetical.action==='compound'&&hypothetical.ev>value*(1+(cfg.production.minImprovement??0))&&
       cfg.merchant.bank)action='bank';
   }
   if(me.role==='merchant'&&action==='sell'){
    // A progressive item may be sold up to one million gold per item, but
    // ONLY after fresh team-wide equipment analysis and finite-stock
    // upgrade/compound economics show that keeping or mutating it is worse.
    // autoSellMaxValue is deliberately NOT used as a blanket gear veto.
    const kind=m.compound?'compound':'upgrade',grade=progressable&&(i.level??0)<(cfg.production.autoProfitMaxLevel??cfg.production.autoGearMaxLevel)?
     p.call('item_grade',i):null;
    const table=kind==='compound'?p.G.compounds:p.G.upgrades;
    const chance=grade===null?1:mutationChance(i.name,i.level??0,kind);
    const scroll=grade===null?0:p.G.items?.[(kind==='compound'?'cscroll':'scroll')+grade]?.g;
    if(!Number.isFinite(value)||value<0||value>(cfg.production.autoGearSellMaxValue??1000000)||
       progressable&&grade!==null&&(!table||!Number.isFinite(chance))||
       !Number.isFinite(scroll)){
      action='bank'; // Unverified chance/cost cannot prove mutation is worse.
    }
   }
   if(action==='bank'&&!cfg.merchant.bank)return null;
   const derived={...defaultsFor(ITEM_RULE),name:'Ökonomische Kurve '+i.name,item:i.name,minLevel:i.level??0,maxLevel:i.level??0,statType:i.stat_type??'',property:i.p??'',title:i.title??'',role:me.role,character:me.name,recipient:cfg.party.merchant,action,priority:-400,_autoDisposition:true,targetLevel:choice.level,targetCount:100,maxCount:100,batch:action==='compound'?3:1,minChance:cfg.production.minChance,goldBudget:cfg.production.helperMaxPrice,lossBudget:cfg.production.lossBudget,minPrice:Math.floor(value),keep:0};noteDisposition(i,derived,choice);return derived;
  }
  const recipeUsed=Object.values(p.G.craft??{}).some(r=>(r.items??[]).some(x=>x[1]===i.name)),value=bot.economy.value(i);const rewards=Number.isSafeInteger(m.e)&&m.e>0?materialDrops(p.G,p.G.drops?.[i.name]):[],returnValue=rewards.reduce((n,r)=>n+r.chance*r.quantity*bot.economy.value({name:r.item,level:0}),0),valuableProbability=Math.min(1,rewards.filter(r=>bot.economy.value({name:r.item,level:0})>0).reduce((n,r)=>n+r.chance,0)),processable=cfg.production.enabled&&cfg.production.exchange&&bot.count(i.name)>=m.e&&valuableProbability>=cfg.production.minChance&&returnValue>value*m.e*(1+cfg.production.minImprovement)&&value*m.e<=cfg.production.lossBudget;const action=me.role==='farmer'?(cfg.party.merchant&&cfg.merchant.pickup?'send':null):processable?'exchange':recipeUsed?'bank':
   Number.isFinite(value)&&value>=0?'sell':'bank';if(!action||action==='bank'&&!cfg.merchant.bank)return null;
  const derived={...defaultsFor(ITEM_RULE),name:'Ökonomische Disposition '+i.name,item:i.name,role:me.role,character:me.name,recipient:action==='send'?cfg.party.merchant:'',action,priority:-500,_autoDisposition:true,minLevel:0,maxLevel:0,batch:100,maxCount:100000,targetCount:100000,lossBudget:cfg.production.lossBudget,minChance:cfg.production.minChance,minPrice:action==='sell'?Math.floor(value):1,keep:me.role==='merchant'&&recipeUsed?10:0};noteDisposition(i,derived);return derived;
 }
 function profitGoals(){if(Number.isInteger(bot.decisionEpoch)&&Date.now()-profitAt<1000)return profits;if(me.role!=='merchant'||!cfg.production.enabled||!cfg.production.autonomy||!cfg.production.autoDisposition)return [];const result=[],stock=stockItems();for(const {item:i} of stock){if(bot.economy.explicit(i)||futureGear(i)||!p.G.items[i.name]?.upgrade&&!p.G.items[i.name]?.compound)continue;const sources=stock.filter(r=>identityVariant(r.item,i));
   const accessible=sources.reduce((n,r)=>n+(Number.isSafeInteger(r.item.q)?r.item.q:1),0);
   const choice=mutationEconomics(i,{heldOverride:accessible}),kind=choice.action;if(!['upgrade','compound'].includes(kind)||!cfg.production[kind])continue;if(kind==='compound'&&sources.reduce((n,r)=>n+(r.item.q??1),0)<3)continue;if(choice.ev<=bot.economy.value(i))continue;
   // Remote or bank acquisitions consume time and have nonzero opportunity
   // cost. No irreversible mutation is authorized by this planning stock.
   const external=sources.some(r=>r.owner!==me.name||r.pack);
   const travelBudget=external?Math.max(0,(cfg.production.goldPerHour??0)/120):0;
   if((choice.ev-bot.economy.value(i))*accessible<=travelBudget)continue;const goal={name:'Gewinnproduktion '+i.name+' +'+choice.level,enabled:true,item:i.name,level:choice.level,quantity:1,recipient:'',priority:-100,budget:Math.min(cfg.production.lossBudget,cfg.production.helperMaxPrice),variant:{stat_type:i.stat_type,p:i.p,title:i.title,data:i.data}};if(!result.some(g=>g.item===goal.item&&g.level===goal.level&&JSON.stringify(g.variant)===JSON.stringify(goal.variant)))result.push(goal);}profitAt=Date.now();profits=result.slice(0,16);return profits;}
 function rules(){const candidates=[...p.c.items.filter(Boolean)];if(me.role==='merchant')for(const [,h] of bot.transport.peers)if(h.running&&h.realm===p.realm())for(const row of h.items??[])if(row.to===me.name&&row.surplus>0)candidates.push(row.variant??{name:row.item,level:0});return [...new Map(candidates.filter(i=>!bot.economy.explicit(i)).map(i=>[identity(i),disposition(i)])).values()].filter(Boolean).slice(0,64);}
 return {targets,disposition,rules,profitGoals,futureGear,gearUse,mutationEconomics,stockItems,chance:mutationChance,recordChance(name,level,kind,value,{scroll='',offering=''}={}){
  if(Number.isFinite(value)&&value>0&&value<=1&&scroll&&p.G.items?.[scroll]){
   if(chances.size>128)chances.clear();
   const key=chanceEvidenceKey(name,level,kind,scroll,offering);
   chances.set(key,{value,at:Date.now(),source:'server-preview',scroll,offering});
   at=0;
  }
 },status:()=>({targets:evaluated,allocations:allocation,decisions:[...decisionLedger.values()],bankEvidence:bot.bank?.catalogStatus?.()??null}),invalidate(){at=0;profitAt=0;stockEpoch=-1;stocks=null;}};}
