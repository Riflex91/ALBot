import {automaticOperatingStockRule,bankOperatingStockRule} from '../items/operating-stock.mjs';
import {chooseRule,identity,fingerprint,protectedItem,variantCount,distance,samePlace,surplusQuantity} from '../core/policy.mjs';
import {capacityAfterConsumption} from '../items/physical-capacity.mjs';
import {boundedExcessSaleRule,boundedStockSurplus,boundedStockVariantAllowed,localVariantQuantity} from '../items/stock-policy.mjs';
import {phaseOf} from '../../editor/lib/contract.mjs';
import {MUTATION_RISK_WINDOW_MS,mutationRiskLimit,mutationRiskAllowed} from './mutation-risk.mjs';
// Adventure Land server (node/server.js) uses B.sell_dist = 400 for the
// ordinary NPC buy/sell/upgrade/compound/craft distance gate. Some checks are
// strict (<400). Leave 25 units inside the boundary for movement jitter.
export const NPC_INTERACTION_LIMIT=400;
export const NPC_INTERACTION_BUFFER=25;
export const NPC_WORK_RADIUS=NPC_INTERACTION_LIMIT-NPC_INTERACTION_BUFFER;
// A bank-expansion budget caps cumulative purchases across reloads and
// hourly accounting periods, not merely the price of one new pack. Legacy
// budgets without a bankSpent field start at zero; malformed persisted values
// cannot be interpreted as an unspent budget.
export function bankExpansionRemaining(bankBudget,bankSpent=0){
 if(!Number.isSafeInteger(bankBudget)||bankBudget<0||
    !Number.isSafeInteger(bankSpent)||bankSpent<0)return 0;
 return Math.max(0,bankBudget-bankSpent);
}
export function saleReceiptMatches(receipt,item,quantity,gold){
 return !!receipt&&receipt.success!==false&&!receipt.failed&&
   receipt.gold===gold&&identity(receipt.item)===identity(item)&&
   (receipt.item?.q??1)===quantity;
}
// NPC purchase uses actual stack capacity. One free slot permits a normal
// scroll or potion purchase even at the Merchant's preferred 4-slot reserve.
export function purchaseFits(items,item,quantity,meta,{inventorySize}={}){
 if(!Number.isSafeInteger(quantity)||quantity<1)return false;
 const planned=capacityAfterConsumption(items,[],item,meta,{inventorySize});
 return !!planned&&planned.units>=quantity;
}
export function createEconomy(bot){
 const {p,cfg,me,exec}=bot;let closed=false,npcEpoch=-1;const noteTimes=new Map();const npcCache=new Map();const ruleActions=new Map();
 const actionKey=r=>JSON.stringify([r.name,r.item,r._originalAction??r.action,r.character,r.recipient,r.minLevel,r.maxLevel]);
 const remaining=r=>!r?.maxActions||(ruleActions.get(actionKey(r))??0)<r.maxActions;
 const ledgerKey='albot:economy:'+me.name+':budget';
 let ledger=p.read(ledgerKey)??{hour:Date.now(),spent:0,loss:0,goals:{}};
 if(!Number.isFinite(ledger.hour)||!Number.isFinite(ledger.spent)||!Number.isFinite(ledger.loss)||!ledger.goals||typeof ledger.goals!=='object')ledger={hour:Date.now(),spent:cfg.merchant.maxSpendPerHour,loss:cfg.production.lossBudget,goals:{}};
 const explicit=(item,phase='inventory')=>chooseRule(cfg.items.filter(r=>phaseOf(r.action)==='all'||phaseOf(r.action)===phase),item,{role:me.role,character:me.name,map:p.c.map,server:p.realm(),task:bot.task?.()??(me.role==='merchant'?'supply':'farm')});
 const rules=(item,phase='inventory')=>{
  const selected=explicit(item,phase);
  if(selected)return phase==='inventory'&&selected.action==='keep'?
   boundedExcessSaleRule({item,inventory:p.c.items,G:p.G,rule:selected,
    reserved:bot.production?.reservedQuantity?.(item)??0})??selected:selected;
  return bot.production?.derivedRule(item,phase)??(()=>{
   const r=bot.intelligence?.disposition(item);
   return r&&phaseOf(r.action)===phase?r:null;
  })()??null;
 };
 const count=item=>variantCount(p.c.items,item);
 const downstreamSatisfied=(item,r)=>{
  if(!r||!['buy','retrieve','marketBuy','wishlist'].includes(r.action))return false;
  const production=rules(item,'production');if(!production||!['upgrade','compound'].includes(production.action)||production.targetLevel<=(item.level??0))return false;
  return count({...item,level:production.targetLevel})>=Math.min(production.targetCount,production.maxCount);
 };
 const safe=i=>!protectedItem(i)&&typeof i.name==='string'&&i.name!=='placeholder';
 const spare=(slot,r)=>{
  const i=p.c.items[slot];if(!safe(i)||!r)return 0;
  if(r._bankExplicitSource&&(
   explicit(i,'inventory')!==r._bankExplicitSource||
   r._bankExplicitSource.action!=='sell'||
   r._bankExplicitSource.enabled!==true))return 0;
  const reserved=['sell','bank','list','send','swap','tradeOffer'].includes(r.action)?
   bot.production?.reservedQuantity?.(i,r.action==='send'?r.recipient:'')??
   (bot.production?.reserved(i)?count(i):0):0;
  if(r._bankOperatingStock){
   const current=bankOperatingStockRule(bot,i,{carried:true});
   return current&&(current._boundedSource??null)===(r._boundedSource??null)?Math.min(i.q??1,r.batch,current.batch):0;
  }
  if(r._autoOperatingStock){
   const current=automaticOperatingStockRule(bot,i);
   if(!current||current.keep!==r.keep||current.minPrice>value(i))return 0;
   return Math.min(i.q??1,r.batch,current.batch,
    surplusQuantity(count(i),reserved,current.keep,0));
  }
  if(r._autoBoundedExcess){
   const source=r._boundedSource;
   // Source rule, role, scope and current physical state are rechecked at
   // scheduling AND dispatch; the earlier derived rule is never authority.
   if(explicit(i,'inventory')!==source||source.action!=='keep'||
      source.excessAction!=='sell'||!boundedStockVariantAllowed(p.G,i))
    return 0;
   const policy=boundedStockSurplus({held:localVariantQuantity(p.c.items,i),
    reserved,keep:source.keep,teamReserve:source.teamReserve,
    maximum:source.maxCount});
   return policy.valid?Math.max(0,Math.min(i.q??1,r.batch,policy.excess)):0;
  }
  return Math.min(i.q??1,r.batch,
   surplusQuantity(count(i),reserved,r.keep??0,r.teamReserve??0));
 };
 const value=i=>{try{const v=p.call('item_value',i);return Number.isFinite(v)&&v>=0?v:Infinity;}catch{return Infinity;}};
 const goalId=g=>JSON.stringify([g.name,g.item,g.level,g.quantity,g.recipient,g.gearSlot??'']);
 function goalSpent(g){const index=cfg.production.goals.indexOf(g);return Math.max(ledger.goals[goalId(g)]??0,index>=0?ledger.goals[String(index)]??0:0);}
 function goalBudget(cost,loss,item){const goal=bot.production?.activeGoal;return cost+loss===0||!goal||!(bot.production.owns?.(item)??true)||(Object.hasOwn(ledger.goals,goalId(goal))||Object.keys(ledger.goals).length<1024)&&goalSpent(goal)+cost+loss<=goal.budget;}
 function note(s){
   bot.reason=s;
   // Bank pressure alternates two different messages. A global 'last
   // message' throttle does not protect the report ring from that pattern.
   const key=/^(?:Bank voll|Bankdruck)/.test(s)?s.split(':')[0]:s;
   const now=Date.now();
   if(now-(noteTimes.get(key)??-Infinity)<60000)return;
   if(noteTimes.size>=128)for(const [old,at] of noteTimes)if(now-at>60000)noteTimes.delete(old);
   if(noteTimes.size>=128)noteTimes.delete(noteTimes.keys().next().value);
   noteTimes.set(key,now);bot.report(s);
  }
 const bankExpansionAvailable=cost=>Number.isSafeInteger(cost)&&cost>0&&
   (cfg.merchant.budgetMode==='account-loss'||cost<=bankExpansionRemaining(cfg.merchant.bankBudget,ledger.bankSpent??0));
 const exposure=()=>ledger.productionExposure===undefined?ledger.loss:Number.isSafeInteger(ledger.productionExposure)&&ledger.productionExposure>=0?ledger.productionExposure:Infinity;
 const automaticRisk=(cost,loss,r)=>!!(r?._autoProduction||r?._autoDisposition)&&(cost>0||loss>0);
 const committedGold=()=>Object.entries(p.c.slots??{}).reduce((n,[k,i])=>n+(k.startsWith('trade')&&i?.b?Math.max(0,Number(i.price)||0)*Math.max(1,Number(i.q)||1):0),0);
 function budget(cost,loss=0,r=null,carriedGold=p.c.gold){
  if(cfg.merchant.budgetMode==='account-loss'){bot.lossGuard?.sample();const committed=committedGold();return !bot.lossGuard?.blocked&&Number.isFinite(cost)&&cost>=0&&Number.isFinite(loss)&&loss>=0&&(cost===0||carriedGold-committed>=cost);}
  if(Date.now()-ledger.hour>=3600000)ledger={...ledger,hour:Date.now(),spent:0,loss:0,productionExposure:0,supplySpent:0};
  const reserve=Math.max(me.goldReserve??0,me.role==='merchant'?cfg.merchant.goldReserve:0);
  const commitments=committedGold();
  return Number.isFinite(cost)&&cost>=0&&Number.isFinite(loss)&&loss>=0&&(cost===0||carriedGold-cost-commitments>=reserve)&&(cost===0||ledger.spent+cost<=cfg.merchant.maxSpendPerHour)&&(loss===0||ledger.loss+loss<=cfg.production.lossBudget)&&(!r||(cost<=r.goldBudget&&loss<=r.lossBudget))&&(!automaticRisk(cost,loss,r)||bot.account?.spendAllowed?.(cost,exposure()+loss,{production:true})===true);
 }
 // Simulate a future verified bank withdrawal without changing live gold,
 // then enforce all the same spend/loss/account and active-goal policies.
 const budgetAtGold=(gold,cost,loss=0,r=null,item=null)=>Number.isSafeInteger(gold)&&gold>=0&&
  budget(cost,loss,r,gold)&&goalBudget(cost,loss,item);
 function budgetExplanation(cost,loss=0,r=null){
  if(cfg.merchant.budgetMode==='account-loss')return bot.lossGuard?.blocked?'Accountgold: 85-%-Verlustsperre aktiv':'Tatsächlich verfügbares Gold reicht für Kosten und bestehende Handelszusagen nicht';
  const reserve=Math.max(me.goldReserve??0,me.role==='merchant'?cfg.merchant.goldReserve:0);
  if(cost>0&&p.c.gold-cost<reserve)return 'Goldreserve würde unterschritten';
  if(ledger.spent+cost>cfg.merchant.maxSpendPerHour)return 'Stündliches Ausgabenbudget ausgeschöpft';
  if(ledger.loss+loss>cfg.production.lossBudget)return 'Stündliches Verlustbudget ausgeschöpft';
  if(r&&(cost>r.goldBudget||loss>r.lossBudget))return 'Budget der Itemregel reicht nicht';
  if(automaticRisk(cost,loss,r)){const risk=bot.account?.risk?.({production:true});return 'Account-Risikobudget: benötigt '+(exposure()+cost+loss)+' Gold, Sitzungslimit '+(risk?.sessionRiskLimit??'unbekannt')+' Gold; '+(risk?.reason??'Accountdaten fehlen');}
  return 'Kosten/Verlust oder gebundene Handelsangebote nicht freigegeben';
 }
 // Persist worst-case per-variant mutation exposure over a 24-hour window,
 // without weakening hourly or per-goal budgets. A reload does not erase it.
 const riskApplies=(kind,r)=>['upgrade','compound'].includes(kind)&&
   (r?._autoDisposition===true||r?._autoProduction===true);
 const riskRows=()=>Date.now()-(ledger.riskStart??0)<MUTATION_RISK_WINDOW_MS&&
   ledger.itemRisk&&typeof ledger.itemRisk==='object'&&!Array.isArray(ledger.itemRisk)?
   ledger.itemRisk:{};
 function riskAllowed(kind,r,details,loss){
  if(cfg.merchant.budgetMode==='account-loss')return !bot.lossGuard?.blocked;
  if(!riskApplies(kind,r))return true;
  return mutationRiskAllowed(riskRows(),details.riskVariant,loss,
   mutationRiskLimit(details.item,p.G.items?.[details.item],
    cfg.production.lossBudget));
 }
 // Charge the maximum exposure BEFORE dispatch. A reload or ambiguous result cannot reset a budget.
 function charge(cost,loss,r,kind,details){
  if(!budget(cost,loss,r)||!riskAllowed(kind,r,details,loss))return false;
  const irreversible=['upgrade','compound','destat','craft','exchange','dismantle','market.swap'].includes(kind);
  const next={...ledger,goals:{...ledger.goals},spent:ledger.spent+cost,loss:ledger.loss+loss,
   productionExposure:exposure()+(irreversible?cost+loss:loss),supplySpent:(ledger.supplySpent??0)+(!irreversible?cost:0)};
  if(cfg.merchant.budgetMode!=='account-loss'&&riskApplies(kind,r)){
   const current=riskRows(),key=details.riskVariant;
   if(!Object.hasOwn(current,key)&&Object.keys(current).length>=128)return false;
   next.riskStart=current===ledger.itemRisk?ledger.riskStart:Date.now();
   next.itemRisk={...current,[key]:(current[key]??0)+loss};
  }
  const goal=bot.production?.activeGoal;if(goal&&cost+loss>0&&(bot.production.owns?.(details.item)??true)){const spent=goalSpent(goal)+cost+loss;if(cfg.merchant.budgetMode!=='account-loss'&&spent>goal.budget)return false;next.goals[goalId(goal)]=spent;}
  if(kind==='bank.expand'){
   if(!bankExpansionAvailable(cost))return false;
   next.bankSpent=(ledger.bankSpent??0)+cost;
  }
  if(!p.write(ledgerKey,next))return false;ledger=next;return true;
 }
 function perform(kind,{slots=[],cost=0,loss=0,rule=null,guard=()=>true,call,observe,details={},timeout=20000,onConfirmed=()=>true}){
  // Official equip clears player.c, cancelling Town. Protect the channel
  // both before enqueueing and in the final dispatch guard.
  const townActive=()=>bot.movement?.townActive||p.c.c?.town||exec.pending?.has('travel.town');
  if(townActive())return false;
  if(bot.recovery?.authorize(kind)===false)return false;const definitions=[...new Set(slots.map(n=>p.c.items[n]?.name).filter(Boolean)),...(rule?.item?[rule.item]:[])];if(definitions.some(name=>bot.content?.approve('item:'+name,[p.G.items[name],p.G.craft?.[name],p.G.drops?.[name]])===false))return false;
  if(kind==='bank.expand'&&!bankExpansionAvailable(cost))return false;
  const rollback=kind==='bank.store'&&details.reason==='revoked-emergency-sale-rollback'&&bot.bank?.reclaiming===true&&bot.bank?.rollbackPending===true;
  if(closed||!bot.running||bot.inventoryBlocked||bot.journal||bot.bank?.pending&&!kind.startsWith('bank.partial.')&&!(bot.bank.singlePending&&['bank.retrieve','bank.merge.retrieve'].includes(kind))&&!(bot.bank.storePending&&kind==='bank.store')&&!(bot.bank.swapPending&&kind==='bank.consolidate')&&!(bot.bank.reclaiming&&['bank.reclaim','sell'].includes(kind))&&!rollback||bot.logistics.reserved||!bot.checkpoint.durable||p.c.rip||exec.busy('inventory')||!remaining(rule))return false;
  if(!budget(cost,loss,rule)){note(kind+': '+budgetExplanation(cost,loss,rule));return false;}
  if(cfg.merchant.budgetMode!=='account-loss'&&!goalBudget(cost,loss,details.item)){note('Produktionsziel: Gesamtbudget ausgeschöpft');return false;}
  if(!riskAllowed(kind,rule,details,loss)){note('Autonome Mutation: 24h-Risikolimit für Itemvariante ausgeschöpft');return false;}
  const prints=slots.map(s=>[s,fingerprint(p.c.items[s])]);
  const valid=()=>bot.running&&!closed&&!townActive()&&!p.c.rip&&!bot.journal&&!bot.inventoryBlocked&&!bot.logistics.reserved&&(kind.startsWith('bank.')?bot.recovery?.bankDispatchAllowed?.(kind)!==false:true)&&(!rule?._capacitySale||slots.length===1&&!!bot.storage?.lowQualityRule?.(p.c.items[slots[0]]))&&prints.every(([s,f])=>fingerprint(p.c.items[s])===f&&safe(p.c.items[s]))&&budget(cost,loss,rule)&&
    (kind!=='bank.expand'||bankExpansionAvailable(cost))&&
    riskAllowed(kind,rule,details,loss)&&guard();
  return exec.run(kind,['inventory','gold','economy'],valid,()=>{
   if(!valid())throw Error('Economy-Zustand verändert');
   if(!charge(cost,loss,rule,kind,details))throw Error('Budget konnte nicht reserviert werden');
   bot.beginValue({kind,...details,cost,loss,slots:prints});
   if(rule&&kind!=='bank.split'&&!kind.startsWith('inventory.'))ruleActions.set(actionKey(rule),(ruleActions.get(actionKey(rule))??0)+1);
   return call();
  },{value:true,timeout,delay:cfg.general.economyTickMs,observe,onSettle:state=>{
   if(state==='confirmed'){try{if(onConfirmed()===false)state='unknown';}catch{state='unknown';}}
   bot.endValue(state);
  }});
 }
 function destination(id){try{return p.call('find_npc',id);}catch{return null;}}
 function at(d,radius=110){return !!d&&samePlace(p.c,d)&&distance(p.c,d)<=radius&&!p.c.moving;}
 function travel(d,label,radius=90){if(!d){note('Kein Arbeitsplatz: '+label);return false;}if(at(d,radius))return true;if(!bot.logistics.reserved){bot.reason='Unterwegs: '+label;bot.movement.go({...d,radius},'economy');}return false;}
 const npcAt=d=>at(d,NPC_WORK_RADIUS);
 const npcTravel=(d,label)=>travel(d,label,NPC_WORK_RADIUS);
 function npcFor(item){if(Number.isInteger(bot.decisionEpoch)){if(npcEpoch!==bot.decisionEpoch){npcEpoch=bot.decisionEpoch;npcCache.clear();}if(npcCache.has(item))return npcCache.get(item);}const candidates=[];for(const [id,n] of Object.entries(p.G.npcs??{})){if(!Array.isArray(n.items)||!n.items.includes(item))continue;const d=destination(id);if(d&&Number.isFinite(d.x)&&Number.isFinite(d.y)&&d.map&&!p.G.maps?.[d.map]?.ignore)candidates.push(d);}const result=candidates.sort((a,b)=>(a.map===p.c.map?-1000000:0)+distance(p.c,a)-((b.map===p.c.map?-1000000:0)+distance(p.c,b)))[0]??null;if(Number.isInteger(bot.decisionEpoch))npcCache.set(item,result);return result;}
 function npcBuy(item,r,quantity,extraGuard=()=>true){
  const meta=p.G.items[item.name];if(!meta||item.level||item.p||item.stat_type||item.title)return false;
  const price=meta.g;if(!Number.isFinite(price)||price<=0||price>r.maxPrice)return false;
  const before=count(item),q=Math.floor(Math.min(quantity,r.batch,r.maxCount-before,Math.floor((cfg.merchant.budgetMode==='account-loss'?Math.max(0,p.c.gold):r.goldBudget)/price)));
  if(q<1||!extraGuard())return false;
  if(!purchaseFits(p.c.items,item,q,meta,{inventorySize:p.c.isize})){
   note('NPC-Kauf '+item.name+': physische Inventarplätze fehlen (frei: '+bot.free()+')');
   return false;
  }
  if(!budget(q*price,0,r)||!npcTravel(npcFor(item.name),'NPC '+item.name))return false;
  return perform('buy',{cost:q*price,rule:r,guard:()=>extraGuard()&&purchaseFits(p.c.items,item,q,meta,{inventorySize:p.c.isize})&&npcAt(npcFor(item.name))&&count(item)===before&&p.G.items[item.name]?.g===price,call:()=>p.call('buy_with_gold',item.name,q),observe:()=>count(item)>=before+q,details:{item:item.name,variant:identity(item),quantity:q,before}});
 }
 function npcSell(slot,r,{onConfirmed=()=>true}={}){const i=p.c.items[slot],sourceBefore=i?.q??1,q=spare(slot,r),price=value(i);if(r?._autoDisposition===true&&bot.production?.protectGearChainInput?.(i))return false;if(!q||!Number.isFinite(price)||price<r.minPrice||!remaining(r)||!budget(0,0,r))return false;const before=count(i),gold=p.c.gold;let receipt=null;const d=destination('fancypots')??destination('potions')??npcFor('hpot0');if(!npcTravel(d,'NPC-Verkauf'))return false;
  return perform('sell',{slots:[slot],rule:r,onConfirmed,guard:()=>!(r?._autoDisposition===true&&bot.production?.protectGearChainInput?.(p.c.items[slot]))&&spare(slot,r)>=q&&npcAt(d)&&value(p.c.items[slot])>=r.minPrice,call:()=>Promise.resolve(p.call('sell',slot,q)).then(result=>{receipt=result;return result;}),observe:()=>{
  const live=p.c.items[slot],left=sourceBefore-q;
  const sourceVerified=left===0?!live:identity(live)===identity(i)&&live?.q===left;
  return sourceVerified&&(saleReceiptMatches(receipt,i,q,q*price)||p.c.gold===gold+q*price);
 },details:{item:i.name,variant:identity(i),quantity:q,before,sourceSlot:slot,expectedGold:q*price}});
 }
 return {rules,explicit,count,downstreamSatisfied,safe,spare,value,note,budget,budgetAtGold,committedGold,budgetExplanation,remaining,perform,destination,at,travel,npcAt,npcTravel,npcFor,npcBuy,npcSell,bankExpansionAvailable,get ledger(){return ledger;},close(){closed=true;},resume(){closed=false;}};
}
