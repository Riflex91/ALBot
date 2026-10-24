import {craftGearCandidates} from './craft-gear.mjs';
import {automaticOperatingStockRule} from '../items/operating-stock.mjs';
import {identity,variantCount,surplusQuantity,protectedItem} from '../core/policy.mjs';
import {isAchievementCarrier} from '../items/achievement-utility.mjs';
const identityVariant=(a,b)=>identity(a)===identity(b);
import {exchangeDrops} from './materials.mjs';
import {itemPurposes} from '../items/purposes.mjs';
import {boundedStockSurplus,boundedStockVariantAllowed,verifiedProductionStockQuantity} from '../items/stock-policy.mjs';
import {physicalInventoryCapacity} from '../items/physical-capacity.mjs';
import {mutationContext,mutationHelpers} from './helpers.mjs';
import {gearScore,gearCompatible,gearSuitability,gearSlotPriority,autoGearTargetLevel} from './gear.mjs';
import {defaultsFor} from '../../editor/lib/contract.mjs';
import {ITEM_RULE} from '../../editor/lib/schema.mjs';
const HISTORICAL_CHANCES={upgrade:[[.9999999,.98,.95,.7,.6,.4,.25,.15,.07,.024],[.99998,.97,.94,.68,.58,.38,.24,.14,.066,.018],[.97,.94,.92,.64,.52,.32,.232,.13,.062,.015]],compound:[[.99,.75,.4,.25,.2,.1,.08,.05,.05,.05],[.9,.7,.4,.2,.15,.08,.05,.05,.05,.03],[.8,.6,.32,.16,.1,.05,.03,.03,.03,.02]]};
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
// The native item catalog is authoritative for compatible accessory
// identities; it is NOT a purchase, market offer or bank stock receipt.
export function vacantAccessoryCandidates(G,profile,slot,{limit=64}={}){
 const type=slot==='cape'?'cape':['earring1','earring2'].includes(slot)?'earring':null;
 if(!type||!profile?.slots||!Object.hasOwn(profile.slots,slot)||
    profile.slots[slot]!==null||!G?.items||typeof G.items!=='object')return [];
 const cap=Number.isSafeInteger(limit)?Math.max(0,Math.min(64,limit)):64;
 return Object.entries(G.items).filter(([name,meta])=>
  /^[a-zA-Z0-9_]{1,120}$/.test(name)&&meta?.type===type&&
  gearCompatible(G,profile,{name,level:0},slot))
  .sort(([a,x],[b,y])=>
    (Number.isFinite(x.g)&&x.g>=0?x.g:Infinity)-
    (Number.isFinite(y.g)&&y.g>=0?y.g:Infinity)||
    a.localeCompare(b)).slice(0,cap).map(([name])=>name);
}
export function createEconomicIntelligence(bot){const {p,cfg,me}=bot;let evaluated=[],at=0,allocation=[],chances=new Map(),props=new Map(),propsVersion=p.G.version,profitAt=0,profits=[],stockEpoch=-1,stocks=null;
 // Live callers only read the last completed generation. Work is advanced by
 // the scheduler, never by a heartbeat, inventory guard or report.
 let work=null,advancing=false,completed=false,revision=0,accessoryVacancies=[];
 const clock=()=>globalThis.performance?.now?.()??Date.now();
 function enabled(){return cfg.production.optimizeGear!==false&&cfg.production.autoGear&&cfg.production.gear&&cfg.general.testLogging!==undefined;}
 function targets(){
  if(!enabled())return [];
  // Standalone/headless module consumers without a scheduler retain the
  // synchronous API; the same reentrancy guard applies even after a long call.
  if(!Number.isInteger(bot.decisionEpoch)&&!bot.diagnosticRead&&!advancing)advance(Infinity,Infinity);
  return evaluated;
 }
 function advance(maxSteps=24,budgetMs=4){
  if(bot.diagnosticRead||advancing)return;
  if(!enabled()){work=null;evaluated=[];allocation=[];accessoryVacancies=[];completed=false;return;}
  if(!work&&completed&&Date.now()-at<cfg.general.planningTickMs)return;
  if(!work)work=evaluateTargets();
  advancing=true;const started=clock();
  try{for(let n=0;n<maxSteps;n++){
   const next=work.next();if(next.done){work=null;completed=true;at=Date.now();revision++;break;}
   if(clock()-started>=budgetMs)break;
  }}catch(error){work=null;at=Date.now();completed=true;bot.event?.('planning.gear.failed',{message:error?.message??String(error)});}
  finally{advancing=false;}
 }
 const helperQuotes=new Map(),missingHelperEvents=new Map(),observedDispositionRules=new Map();
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
    observedAt:row.evidence?.observedAt??null});for(const [name] of bot.transport.peers){const h=bot.transport.fresh(name);if(h?.running&&!h.rip&&h.realm===p.realm())for(const row of h.stock??[])result.push({item:row,owner:name});}stocks=result.slice(0,400);stockEpoch=bot.decisionEpoch;return stocks;} function* evaluateTargets(){const nextTargets=[],nextAllocation=[],nextVacancies=[],
   ownedStock=stockItems(),craftCandidates=craftGearCandidates(p.G,cfg.production),
   craftSet=new Set(craftCandidates),craftQuotes=new Map(),accessoryRoutes=new Map(),
   names=[...new Set([...cfg.production.autoGearItems,...craftCandidates,...ownedStock.map(r=>r.item.name)])],
   knownNames=new Set(names);
   function accessoryRoute(name){
    if(accessoryRoutes.has(name))return accessoryRoutes.get(name);
    let route=null;
    // Sell value is not shop availability. Require verified native NPC
    // mapping or a finite, non-speculative acquisition route.
    const npc=bot.economy.npcFor?.(name);
    if(npc&&Number.isFinite(p.G.items?.[name]?.g)&&p.G.items[name].g>=0)
     route={gold:p.G.items[name].g,hours:0,source:'verified-npc'};
    else try{
     const quote=me.role==='merchant'?bot.production?.estimateAcquisition?.(name,0,1):null;
     if(quote&&!quote.speculative&&Number.isFinite(quote.gold)&&quote.gold>=0&&
       Number.isFinite(quote.hours)&&quote.hours>=0&&
       quote.hours<=cfg.production.maxFarmHours)
      route={gold:quote.gold,hours:quote.hours,source:quote.kind??'verified-route'};
    }catch{}
    accessoryRoutes.set(name,route);
    return route;
   }
  for(const member of cfg.characters.filter(c=>c.enabled)){const profile=member.name===me.name?bot.gear.snapshot():bot.gear.profile(member.name);if(!profile)continue;const role=member.gearRole==='auto'?profile.class==='priest'?'healer':profile.class==='merchant'?'economy':'dps':member.gearRole;
   for(const [slot,old] of Object.entries(Object.fromEntries([...new Set([...Object.keys(profile.slots),'mainhand','offhand','helmet','chest','pants','shoes','gloves','amulet','belt','cape','ring1','ring2','earring1','earring2','orb'])].map(slot=>[slot,profile.slots[slot]??null])))){if(old?.l||old?.b||cfg.production.gearTargets.some(g=>g.enabled&&g.character===member.name&&g.slot===slot))continue;let previous=0;try{previous=old?gearScore(properties(old),role,profile.class):0;}catch{continue;}
     // Only fresh, confirmed online farmer gear profiles admit catalog
     // discovery. Existing stock and explicit configured targets are unchanged.
     const fresh=bot.transport?.fresh?.(member.name);
     const activeFarmer=me.role==='merchant'&&member.role==='farmer'&&
       Array.isArray(bot.farmers)&&bot.farmers.includes(member.name)&&
       fresh?.running===true&&!fresh.rip&&fresh.realm===p.realm()&&
       profile.complete===true&&profile.realm===p.realm()&&
       profile.session===fresh.session&&
       Number.isSafeInteger(profile.at)&&profile.at>0&&
       profile.at<=Date.now()&&Date.now()-profile.at<=120000;
     const newlyDiscovered=activeFarmer?
       vacantAccessoryCandidates(p.G,profile,slot):[];
     const candidates=[...new Set([...names,...newlyDiscovered])];
     let deniedRoutes=0,admittedRoutes=0;
    let best=null;for(const name of candidates){if(!gearCompatible(p.G,profile,{name,level:0},slot))continue;
      const meta=p.G.items[name],discovered=!knownNames.has(name);
      if(discovered&&bot.economy.explicit({name,level:0},'production')?.action==='keep')continue;
      for(let level=0;level<=(meta.upgrade||meta.compound?autoGearTargetLevel(cfg.production.autoGearMaxLevel,profile.level,slot):0);level++){yield;if(old?.name===name&&old.level>=level)continue;const explicit=bot.economy.explicit({name,level:Math.max(0,level-1)},'production');if(level>0&&explicit&&(explicit.action==='keep'||explicit.targetLevel<level))continue;
     const owned=ownedStock.filter(r=>r.item.name===name&&(r.item.level??0)<=level).sort((a,b)=>(b.item.level??0)-(a.item.level??0))[0];let chance=1,cost=owned?0:meta.g??Infinity;
       if(discovered&&!owned&&!craftSet.has(name)){
        const route=accessoryRoute(name);
        if(!route){deniedRoutes++;continue;}
        admittedRoutes++;
        cost=route.gold+route.hours*Math.max(1,cfg.production.goldPerHour??100000);
       }
      if(!owned&&craftSet.has(name)){
       // Account-wide craft acquisition is owned by the merchant. Farmers
       // retain cheap local/ordinary gear evaluation and receive hub orders.
       if(me.role!=='merchant')continue;
       if(!craftQuotes.has(name)){try{craftQuotes.set(name,bot.production?.estimateAcquisition?.(name,0,1)??null);}catch{craftQuotes.set(name,null);}}
       const route=craftQuotes.get(name);
       if(!route||route.speculative||!Number.isFinite(route.gold)||!Number.isFinite(route.hours)||route.hours>cfg.production.maxFarmHours)continue;
       cost=route.gold+route.hours*Math.max(1,cfg.production.goldPerHour??100000);
      }for(let l=owned?.item.level??0;l<level;l++){const c=mutationChance(name,l,meta.compound?'compound':'upgrade');if(c===null){chance=0;break;}const grade=p.call('item_grade',{name,level:l}),scroll=(meta.compound?'cscroll':'scroll')+grade;cost=(cost*(meta.compound?3:1)+(p.G.items[scroll]?.g??Infinity))/c;chance*=c;}
     if(chance<cfg.production.minChance||cfg.merchant.budgetMode!=='account-loss'&&cost>cfg.production.autoGearBudget||!Number.isFinite(cost))continue;let score;try{const nextStats=properties({name,level}),oldStats=old?properties(old):null;if(!gearSuitability(oldStats,nextStats,role,profile.class,member.merchantMobility).ok)continue;score=gearScore(nextStats,role,profile.class);}catch{continue;}const improvement=score-previous,utility=improvement*chance/(1+cost/Math.max(1,cfg.production.autoGearBudget));if(improvement<Math.abs(previous)*cfg.production.minImprovement||utility<=0)continue;if(!best||utility>best.utility)best={name:'Optimiertes Gear '+member.name+' '+slot,item:name,level,quantity:1,character:member.name,slot,enabled:true,budget:cfg.merchant.budgetMode==='account-loss'?Number.MAX_SAFE_INTEGER:cfg.production.autoGearBudget,priority:(member.catchUp?35:15)+gearSlotPriority(slot,profile.class)+
       (discovered&&old===null?35:0),utility,chance,estimatedCost:cost,sourceOwner:owned?.owner??null,sourceLevel:owned?.item.level??0,variant:owned?{stat_type:owned.item.stat_type??'',p:owned.item.p??'',title:owned.item.title??''}:undefined};
    }}if(best){nextTargets.push(best);nextAllocation.push({character:member.name,slot,item:best.item,level:best.level,utility:best.utility,state:'reserved',recipientSession:bot.transport.fresh(member.name)?.session??null});}
      if(newlyDiscovered.length)nextVacancies.push({character:member.name,slot,
       catalogued:newlyDiscovered.length,unprovenRoutes:deniedRoutes,
       admittedRoutes,selected:best?.item??null});
    }
   }evaluated=nextTargets;allocation=nextAllocation;accessoryVacancies=nextVacancies;
 }
 function gearUse(i){
 const meta=p.G.items?.[i?.name];
 const isEquipment=!!meta&&(!!meta.upgrade||!!meta.compound||
   !!meta.wtype||['weapon','helmet','chest','pants','shoes','ring','earring',
   'amulet','belt','cape','gloves','orb','shield'].includes(meta.type));
 if(!isEquipment)return {state:'no-gear-use',reason:'not-equipment',checked:0};
 // Only selected active farmers and their merchant may reserve a gear item;
 // enabled-but-offline account alternates must not freeze all gear sales.
 const selected=Array.isArray(bot.farmers)?bot.farmers:(cfg.characters??[]).filter(c=>c.enabled).map(c=>c.name);
 const names=new Set([...selected,cfg.party.merchant]);
 const members=(cfg.characters??[]).filter(c=>c.enabled&&names.has(c.name));
 if(!members.length)return {state:'unknown',reason:'no-expected-profiles',checked:0};
 if(i.data!==undefined||i.p||i.title||i.stat_type||i.acc||i.rid||i.special)
   return {state:'unknown',reason:'specific-variant-not-proven',checked:0};
 let checked=0;
 // A theoretical +5 is NOT evidence that the team can afford or safely
 // complete those mutations. Inspect existing gear at the current level;
 // optimized higher-level candidates are checked separately against the
 // global chance, budget, and upgrade-cost constraints.
 const horizon=i.level??0;
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
 // A feasible, already planned +level gear allocation still reserves
 // the source, even if the item at its current level is not useful.
 if((me.role==='merchant'||me.name===cfg.party.merchant)&&enabled()&&Number.isInteger(bot.decisionEpoch)&&(!completed||work))
   return {state:'unknown',reason:'economic-gear-plan-pending',checked,horizon};
 if((me.role==='merchant'||me.name===cfg.party.merchant)&&
    targets().some(g=>g.item===i.name&&g.level>=(i.level??0)&&
      g.sourceLevel<=(i.level??0)&&
      (!g.variant||['stat_type','p','title'].every(k=>
        (g.variant[k]??'')===(i[k]??'')))))
   return {state:'gear-useful',reason:'economically-feasible-optimized-gear-goal',
     checked,horizon};
 return {state:'no-gear-use',reason:'verified-present-use-and-economic-gear-plan',checked,horizon};
}
// Count how many physical equipment slots could possibly consume one
// identical unmodified copy. This is an UPPER bound, not a suggestion to
// sell the other copies: only fresh complete profiles, verified valuations,
// ordinary item variants and the established mutation economics authorize it.
// A 7th identical belt cannot serve a four-character party with one belt
// slot each, even when each belt would be useful on its own.
function surplusEquipmentReserve(i){
 if(me.role!=='merchant'||!bot.economy.safe(i))return null;
 const members=new Set([...(bot.farmers??[]),cfg.party.merchant]);
 let capacity=0;
 for(const name of members){
  const member=(cfg.characters??[]).find(c=>c.enabled&&c.name===name);
  if(!member)return null;
  const h=name===me.name?null:bot.transport?.fresh?.(name);
  const profile=name===me.name?bot.gear?.snapshot?.():bot.gear?.profile?.(name);
  if(!profile?.slots||!profile.class||
     name!==me.name&&(!profile.complete||!h?.running||h.rip||h.realm!==p.realm()||
       profile.session!==h.session||profile.realm!==p.realm()||
       !Number.isFinite(profile.at)||Date.now()-profile.at>120000))
   return null;
  for(const slot of ['mainhand','offhand','helmet','chest','pants',
   'shoes','gloves','amulet','belt','cape','ring1','ring2',
   'earring1','earring2','orb']){
   if(gearCompatible(p.G,profile,i,slot))capacity++;
  }
 }
 return capacity>0?capacity:null;
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
 const local=verifiedProductionStockQuantity(p.G,
  p.c.items.filter(x=>x&&identityVariant(x,i)&&bot.economy.safe(x)),i);
 if(local===null)return {level:i.level??0,ev:current,
  action:'bank',reason:'unverified-physical-compound-quantity'};
 const held=Number.isSafeInteger(heldOverride)&&heldOverride>=local?
  heldOverride:local;
 const reserved=bot.production?.reservedQuantity?.(i)??0;
 const n=Math.min(42,surplusQuantity(held,reserved));
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
     (cfg.merchant.budgetMode==='account-loss'||cost<=cfg.production.helperMaxPrice)){
    for(let k=1;k<=Math.floor(count/3);k++){
     if(cfg.merchant.budgetMode!=='account-loss'&&k*cost>cfg.production.helperMaxPrice)break;
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
function mutationEconomics(i,{heldOverride=null}={}){
 const m=p.G.items[i.name],kind=m?.compound?'compound':'upgrade',
  max=cfg.production.autoProfitMaxLevel??cfg.production.autoGearMaxLevel,
  grade=p.call('item_grade',i),scroll=(kind==='compound'?'cscroll':'uscroll')+grade;
 let missingHelper=false;
 if(cfg.production.autoHelpers&&heldOverride===null&&(m?.upgrade||m?.compound)){
  const key=mutationContext(bot,i),quote=helperQuotes.get(key);
  if(quote&&Date.now()-quote.at<30000)return {...quote.choice,level:(i.level??0)+1};
  if((i.level??0)<max&&mutationHelpers(bot,i,kind).length)
   return {level:(i.level??0)+1,ev:resaleValue(i,1,false),action:kind,reason:'helper-preview-required'};
  missingHelper=Number.isFinite(grade)&&grade>=0&&grade<4&&
   (i.level??0)<max&&!!p.G.items?.[scroll];
 }
 const fallback=choice=>{
  if(!missingHelper||!['upgrade','compound'].includes(choice.action))return choice;
  bot.production?.requestHelper?.(scroll,1);
  const key=identity(i)+':'+scroll,now=Date.now();
  if(now-(missingHelperEvents.get(key)??0)>60000){
   missingHelperEvents.set(key,now);if(missingHelperEvents.size>64)missingHelperEvents.clear();
   bot.event?.('production.helperMissing',{item:i.name,level:i.level??0,action:kind,scroll});
  }
  return {...choice,action:'bank',reason:'no-helper-available'};
 };
 const factor=kind==='compound'?3:1,current=resaleValue(i,1,false);if(!Number.isFinite(current)||cfg.merchant.budgetMode!=='account-loss'&&cfg.production.lossBudget>0&&current>cfg.production.lossBudget)return {level:i.level??0,ev:current,action:'bank',reason:'auto-mutation-exposure'};if(kind==='compound')return fallback(finiteCompoundValue(i,max,current,heldOverride));let best={level:i.level??0,ev:current,action:'sell'},value=resaleValue({...i,level:max},1,true);if(!Number.isFinite(value))return best;
  for(let l=max-1;l>=(i.level??0);l--){const c=mutationChance(i.name,l,kind),grade=p.call('item_grade',{...i,level:l}),scrollCost=p.G.items[(kind==='compound'?'cscroll':'scroll')+grade]?.g,immediate=resaleValue({...i,level:l},1,l>(i.level??0));if(!(c>=cfg.production.minChance)||!Number.isFinite(scrollCost)||!Number.isFinite(immediate)){value=immediate;continue;}const ev=(c*value-scrollCost)/factor;if(ev>immediate*(1+cfg.production.minImprovement)&&(cfg.merchant.budgetMode==='account-loss'||scrollCost<=cfg.production.helperMaxPrice)){value=ev;if(l===(i.level??0))best={level:l+1,ev,action:kind};}else value=immediate;}
  return fallback(best);
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
  if(rule){observedDispositionRules.set(key,rule);if(observedDispositionRules.size>64)observedDispositionRules.delete(observedDispositionRules.keys().next().value);}
  decisionLedger.delete(key);decisionLedger.set(key,entry);
  if(decisionLedger.size>24)decisionLedger.delete(decisionLedger.keys().next().value);
 }
  function disposition(i){
   if(bot.diagnosticRead)return observedDispositionRules.get(identity(i))??null;
   if(cfg.production.autoDisposition!==true||!bot.economy.safe(i)||isAchievementCarrier(i))return null;
   // A goal only protects its exact-variant allocation; other held copies
   // remain available for normal economic decision making.
   const witnessed=verifiedProductionStockQuantity(p.G,p.c.items??[],i);
   if(witnessed===null||!surplusQuantity(witnessed,
      bot.production?.reservedQuantity?.(i)??0))return null;
  const operating=automaticOperatingStockRule(bot,i);
  if(operating){noteDisposition(i,operating,{reason:'Endlicher NPC-ersetzbarer Betriebsvorrat mit voller Teamreserve'});return operating;}
  const purposes=itemPurposes(p.G,i);
  if(purposes.protected)return null;
  // Equipment ingredients must pass the recipe check BEFORE equipment
  // liquidation. Active production allocations remain authoritative.
  const recipeTarget=purposes.recipes.length?Math.max(...purposes.recipes.map(r=>r.quantity).filter(Number.isSafeInteger)):0;
  const bankCopies=verifiedProductionStockQuantity(p.G,
   stockItems().filter(r=>r.pack&&identityVariant(r.item,i)).map(r=>r.item),i);
  if(bankCopies===null)return null;
  const recipeKeep=Number.isFinite(recipeTarget)?
   Math.max(0,recipeTarget-bankCopies):0;
  // Preserve any unusual item variant; NPC sell value does not price rare
  // effects (such as cxjar with data="makeawish"). Explicit user rules win.
  if(i.data!==undefined&&i.data!==null||i.acc||i.rid||i.p||i.title||i.stat_type||i.skin||i.expires)return null;const m=p.G.items[i.name];if(!m||m.cash||m.quest||m.event||['pot','elixir','scroll','uscroll','cscroll','offering','stand','tool','booster'].includes(m.type))return null;
  const equipment=!!(m.upgrade||m.compound||m.wtype||
    ['weapon','helmet','chest','pants','shoes','ring','earring','amulet',
    'belt','cape','gloves','orb','shield'].includes(m.type));
  if(equipment){
    const use=gearUse(i);
    const reserve=surplusEquipmentReserve(i);
    const local=witnessed;
    const redundant=use.state!=='unknown'&&
      Number.isSafeInteger(reserve)&&reserve>0&&local>reserve;
    if(use.state!=='no-gear-use'&&!redundant)return null;
    const value=bot.economy.value(i),progressable=!!(m.upgrade||m.compound);
    const choice=progressable?mutationEconomics(i):{level:i.level??0,ev:value,action:'sell',reason:'non-progressive-equipment'};
    const count=witnessed;let action=me.role==='farmer'?'send':choice.action;
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
   // One complete recipe batch is a bounded fallback reserve. Already
   // observed bank copies satisfy it; never increase their level by accident.
   if(recipeKeep>=count){action=me.role==='farmer'?'send':cfg.merchant.bank?'bank':null;if(!action)return null;}
   const derived={...defaultsFor(ITEM_RULE),name:'Ökonomische Kurve '+i.name,item:i.name,minLevel:i.level??0,maxLevel:i.level??0,statType:i.stat_type??'',property:i.p??'',title:i.title??'',role:me.role,character:me.name,recipient:cfg.party.merchant,action,priority:-400,_autoDisposition:true,targetLevel:choice.level,targetCount:100,maxCount:100,batch:action==='compound'?3:1,minChance:cfg.production.minChance,goldBudget:cfg.production.helperMaxPrice,lossBudget:cfg.production.lossBudget,minPrice:Math.floor(value),keep:Math.max(redundant?reserve:0,['bank','send'].includes(action)?0:recipeKeep)};
    noteDisposition(i,derived,{...choice,reason:redundant?
      'sicherer Überschuss über alle kompatiblen Team-Slots':choice.reason});
    return derived;
  }
  const recipeUsed=Object.values(p.G.craft??{}).some(r=>(r.items??[]).some(x=>x[1]===i.name)),value=bot.economy.value(i);const rewards=Number.isSafeInteger(m.e)&&m.e>0?exchangeDrops(p.G,p.G.drops?.[i.name]):[],returnValue=rewards.reduce((n,r)=>n+r.chance*r.quantity*bot.economy.value({name:r.item,level:0}),0),valuableProbability=Math.min(1,rewards.filter(r=>bot.economy.value({name:r.item,level:0})>0).reduce((n,r)=>n+r.chance,0)),processable=cfg.production.enabled&&cfg.production.exchange&&bot.count(i.name)>=m.e&&valuableProbability>=cfg.production.minChance&&returnValue>value*m.e*(1+cfg.production.minImprovement)&&(cfg.merchant.budgetMode==='account-loss'||value*m.e<=cfg.production.lossBudget);const action=me.role==='farmer'?(cfg.party.merchant&&cfg.merchant.pickup?'send':null):processable?'exchange':recipeUsed&&recipeKeep>0?'bank':
   Number.isFinite(value)&&value>=0?'sell':'bank';if(!action||action==='bank'&&!cfg.merchant.bank)return null;
  const derived={...defaultsFor(ITEM_RULE),name:'Ökonomische Disposition '+i.name,item:i.name,role:me.role,character:me.name,recipient:action==='send'?cfg.party.merchant:'',action,priority:-500,_autoDisposition:true,minLevel:0,maxLevel:0,batch:action==='bank'&&recipeUsed?Math.max(1,Math.min(100,recipeKeep)):100,maxCount:100000,targetCount:100000,lossBudget:cfg.production.lossBudget,minChance:cfg.production.minChance,minPrice:action==='sell'?Math.floor(value):1,keep:0};noteDisposition(i,derived);return derived;
 }
 function profitGoals(){if(Number.isInteger(bot.decisionEpoch)&&Date.now()-profitAt<1000)return profits;if(me.role!=='merchant'||!cfg.production.enabled||!cfg.production.autonomy||!cfg.production.autoDisposition)return [];const result=[],stock=stockItems();for(const {item:i} of stock){if(itemPurposes(p.G,i).protected||itemPurposes(p.G,i).recipes.length||bot.economy.explicit(i)||futureGear(i)||!p.G.items[i.name]?.upgrade&&!p.G.items[i.name]?.compound)continue;const sources=stock.filter(r=>identityVariant(r.item,i));
   const accessible=verifiedProductionStockQuantity(p.G,
    sources.map(r=>r.item),i);
   if(accessible===null)continue;
   const choice=mutationEconomics(i,{heldOverride:accessible}),kind=choice.action;if(!['upgrade','compound'].includes(kind)||!cfg.production[kind])continue;if(kind==='compound'&&accessible<3)continue;if(choice.ev<=bot.economy.value(i))continue;
   // Remote or bank acquisitions consume time and have nonzero opportunity
   // cost. No irreversible mutation is authorized by this planning stock.
   const external=sources.some(r=>r.owner!==me.name||r.pack);
   const travelBudget=external?Math.max(0,(cfg.production.goldPerHour??0)/120):0;
   if((choice.ev-bot.economy.value(i))*accessible<=travelBudget)continue;const goal={name:'Gewinnproduktion '+i.name+' +'+choice.level,enabled:true,item:i.name,level:choice.level,quantity:1,recipient:'',priority:-100,budget:cfg.merchant.budgetMode==='account-loss'?Number.MAX_SAFE_INTEGER:Math.min(cfg.production.lossBudget,cfg.production.helperMaxPrice),variant:{stat_type:i.stat_type,p:i.p,title:i.title,data:i.data}};if(!result.some(g=>g.item===goal.item&&g.level===goal.level&&JSON.stringify(g.variant)===JSON.stringify(goal.variant)))result.push(goal);}profitAt=Date.now();profits=result.slice(0,16);return profits;}
 function rules(){const candidates=[...p.c.items.filter(Boolean)];if(me.role==='merchant')for(const [,h] of bot.transport.peers)if(h.running&&h.realm===p.realm())for(const row of h.items??[])if(row.to===me.name&&row.surplus>0)candidates.push(row.variant??{name:row.item,level:0});return [...new Map(candidates.filter(i=>!bot.economy.explicit(i)).map(i=>[identity(i),disposition(i)])).values()].filter(Boolean).slice(0,64);}
 return {advance,recordHelpers(item,choice){if(helperQuotes.size>=32)helperQuotes.clear();helperQuotes.set(mutationContext(bot,item),{at:Date.now(),choice});},targets,disposition,rules,profitGoals,futureGear,gearUse,mutationEconomics,stockItems,chance:mutationChance,recordChance(name,level,kind,value,{scroll='',offering=''}={}){
  if(Number.isFinite(value)&&value>0&&value<=1&&scroll&&p.G.items?.[scroll]){
   if(chances.size>128)chances.clear();
   const key=chanceEvidenceKey(name,level,kind,scroll,offering);
   chances.set(key,{value,at:Date.now(),source:'server-preview',scroll,offering});
   at=0;
  }
 },explainInventorySlot(slot){
   const item=p.c.items?.[slot];
   // Read only: never evaluate the auto-disposition planner for this query.
   // Its cached decision is informative, not current execution permission.
   const explicit=item?bot.economy?.explicit?.(item,'inventory')??null:null;
   const observed=item?decisionLedger.get(identity(item))??null:null;
   return describeInventoryDisposition({item,slot,inventory:p.c.items??[],inventorySize:p.c.isize,
    G:p.G,explicit,autoDecision:observed,
    reserved:item?bot.production?.observedReservation?.(item)??null:0,
    actionRemaining:explicit?bot.economy?.remaining?.(explicit)??true:true,
    valueBlocked:!!(bot.journal||bot.inventoryBlocked),now:Date.now()});
  },status:()=>({planning:{state:work?'calculating':completed?'ready':'pending',completedAt:at,revision},targets:evaluated,allocations:allocation,accessoryVacancies,decisions:[...decisionLedger.values()],bankEvidence:bot.bank?.catalogStatus?.()??null}),invalidate(){work=null;completed=false;at=0;profitAt=0;stockEpoch=-1;stocks=null;}};}


// W01: an observation, not an alternate planning/dispatch authority.
// This deliberately does not call disposition(), rules(), a bank transaction,
// or the Executor: a diagnostic request must never initiate a value action.
export function describeInventoryDisposition({
 item,slot,inventory=[],inventorySize,G={},explicit=null,autoDecision=null,
 reserved=0,actionRemaining=true,valueBlocked=false,now=Date.now()
}={}){
 const invalid={version:1,mode:'read-only',executable:false,state:'observation-unverified'};
 if(!Array.isArray(inventory)||!Number.isSafeInteger(slot)||slot<0||
    slot>=inventory.length||inventory[slot]!==item||!item?.name)
  return {...invalid,reason:'invalid-or-changed-inventory-slot'};
 const variant=identity(item);
 const copies=inventory.filter(i=>i&&identity(i)===variant);
 const quantitiesValid=copies.every(i=>Number.isSafeInteger(i.q??1)&&(i.q??1)>0);
 const local=quantitiesValid?copies.reduce((n,i)=>n+(i.q??1),0):null;
 const countsValid=Number.isSafeInteger(local)&&local>=0&&
  Number.isSafeInteger(reserved)&&reserved>=0&&
  Number.isSafeInteger(explicit?.keep??0)&&(explicit?.keep??0)>=0&&
  Number.isSafeInteger(explicit?.teamReserve??0)&&(explicit?.teamReserve??0)>=0;
 const keep=explicit?.keep??0,teamReserve=explicit?.teamReserve??0;
 const free=countsValid?surplusQuantity(local,reserved,keep,teamReserve):null;
 const boundedOptIn=explicit?.action==='keep'&&explicit.excessAction==='sell';
 const bounded=boundedOptIn?boundedStockSurplus({held:local,reserved,keep,
  teamReserve,maximum:explicit.maxCount}):null;
 const boundedEligible=boundedOptIn&&bounded?.valid&&bounded.excess>0&&
  boundedStockVariantAllowed(G,item);
 const purposes=itemPurposes(G,item);
 const hardProtected=protectedItem(item)||isAchievementCarrier(item);
 const source=explicit?'explicit':autoDecision?'last-observed-auto':'none';
 const proposedAction=boundedEligible?'sell':explicit?.action??autoDecision?.nextStep??null;
 const amount=Number.isSafeInteger(item.q??1)&&(item.q??1)>0?item.q??1:null;
 const batch=Number.isSafeInteger(explicit?.batch)&&explicit.batch>0?
  explicit.batch:null;
 const provisionalSlotUpperBound=free===null||amount===null?null:
  Math.min(free,amount,batch??amount,boundedOptIn?(boundedEligible?bounded.excess:0):amount);
 let state='rule-observed',reason='';
 if(valueBlocked){state='value-effect-unclear';reason='unresolved-value-journal';}
 else if(hardProtected){state='protected';reason='physical-item-protection';}
 else if(!countsValid){state='observation-unverified';reason='unknown-or-invalid-quantity';}
 else if(free===0){state='no-surplus';reason='reservation-or-keep-bound';}
 else if(explicit&&!actionRemaining){state='action-limit';reason='explicit-rule-action-limit';}
 else if(boundedOptIn&&!boundedEligible){state='no-bounded-excess';reason=
  bounded?.valid?'stock-below-maximum-or-protected-variant':'bounded-stock-unverified';}
 else if(boundedEligible){state='bounded-excess-observed';reason=
  'explicit-opt-in-not-dispatch-authority';}
 else if(!explicit&&purposes.protected){state='purpose-protected';reason='automatic-purpose-guard';}
 else if(!explicit&&!autoDecision){state='no-rule-observed';reason='no-observed-disposition-candidate';}
 else if(!explicit){state='auto-candidate-observed';reason='cached-not-currently-authorized';}
 else {state='explicit-rule-observed';reason='rule-exists-not-dispatch-authority';}
 // Even an observed automatic candidate is not a currently executable rule.
 const slotUpperBound=['explicit-rule-observed','bounded-excess-observed'].includes(state)?provisionalSlotUpperBound:0;
 const destination=proposedAction==='send'?explicit?.recipient??null:
  proposedAction==='bank'?'bank':proposedAction==='sell'?'npc':
  proposedAction==='list'?'market':null;
 // G01: removing a whole overflow row is NOT an ordinary free slot until
 // the official signed isize capacity becomes positive.
 const baseCapacity=physicalInventoryCapacity(inventory,{inventorySize});
 const afterWhole=inventory.slice();afterWhole[slot]=null;
 const afterCapacity=physicalInventoryCapacity(afterWhole,{inventorySize});
 const wholeRemovalCandidate=['sell','send','bank','exchange','dismantle'].includes(proposedAction)&&
  amount!==null&&slotUpperBound!==null&&slotUpperBound>=amount;
 const potentialFreed=wholeRemovalCandidate&&baseCapacity&&afterCapacity?
  Math.max(0,afterCapacity.free-baseCapacity.free):0;
 return {version:1,mode:'read-only',executable:false,state,reason,
  observation:{at:now,source:'current-client-inventory',freshForDispatch:false},
  item:{name:item.name,level:item.level??0,stat_type:item.stat_type??'',
   property:item.p??'',title:item.title??'',variant,slot,slotQuantity:amount},
  stock:{local,otherAccountLocations:'not-proven-by-this-view'},
  reservation:{grossQuantity:countsValid?reserved:null,
   reasons:reserved>0?['active-production-allocation; IDs not exposed']:[],
   keep:countsValid?keep:null,teamReserve:countsValid?teamReserve:null},
  purpose:{known:purposes.known,tags:purposes.tags,automaticProtection:purposes.protected},
  observedRule:{source,name:explicit?.name??null,action:proposedAction,
   lastAutomaticObservationAt:autoDecision?.at??null,
   automaticReason:autoDecision?.reason??null},
  stockPolicy:boundedOptIn?{kind:'local-opt-in',target:explicit.targetCount,
   maximum:explicit.maxCount,protectedFloor:bounded.protectedFloor,
   boundedExcess:bounded.excess,eligible:!!boundedEligible,
   confirmed:false}:null,
  possibleUnreservedQuantity:free,slotRemovalUpperBound:slotUpperBound,
  destination,physicalSlotEffect:{confirmed:false,potentialFreedSlots:potentialFreed,
   signedFreeBefore:baseCapacity?.signedFree??null,
  signedFreeAfterWholeRemoval:wholeRemovalCandidate?afterCapacity?.signedFree??null:null,
  reason:'intermediate capacity, recipient and post-dispatch result not proven'},
  nextRecheck:'next planner tick and mandatory fresh executor guard'};
}
