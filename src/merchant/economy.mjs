import {chooseRule,identity,fingerprint,protectedItem,variantCount,distance,samePlace} from '../core/policy.mjs';
import {phaseOf} from '../../editor/lib/contract.mjs';
export function createEconomy(bot){
 const {p,cfg,me,exec}=bot;let closed=false,lastMessage='',lastMessageAt=0,npcEpoch=-1;const npcCache=new Map();const ruleActions=new Map();
 const actionKey=r=>JSON.stringify([r.name,r.item,r._originalAction??r.action,r.character,r.recipient,r.minLevel,r.maxLevel]);
 const remaining=r=>!r?.maxActions||(ruleActions.get(actionKey(r))??0)<r.maxActions;
 const ledgerKey='albot:economy:'+me.name+':budget';
 let ledger=p.read(ledgerKey)??{hour:Date.now(),spent:0,loss:0,goals:{}};
 if(!Number.isFinite(ledger.hour)||!Number.isFinite(ledger.spent)||!Number.isFinite(ledger.loss)||!ledger.goals||typeof ledger.goals!=='object')ledger={hour:Date.now(),spent:cfg.merchant.maxSpendPerHour,loss:cfg.production.lossBudget,goals:{}};
 const explicit=(item,phase='inventory')=>chooseRule(cfg.items.filter(r=>phaseOf(r.action)==='all'||phaseOf(r.action)===phase),item,{role:me.role,character:me.name,map:p.c.map,server:p.realm(),task:bot.task?.()??(me.role==='merchant'?'supply':'farm')});
 const rules=(item,phase='inventory')=>explicit(item,phase)??bot.production?.derivedRule(item,phase)??(()=>{const r=bot.intelligence?.disposition(item);return r&&phaseOf(r.action)===phase?r:null;})()??null;
 const count=item=>variantCount(p.c.items,item);
 const downstreamSatisfied=(item,r)=>{
  if(!r||!['buy','retrieve','marketBuy','wishlist'].includes(r.action))return false;
  const production=rules(item,'production');if(!production||!['upgrade','compound'].includes(production.action)||production.targetLevel<=(item.level??0))return false;
  return count({...item,level:production.targetLevel})>=Math.min(production.targetCount,production.maxCount);
 };
 const safe=i=>!protectedItem(i)&&typeof i.name==='string'&&i.name!=='placeholder';
 const spare=(slot,r)=>{const i=p.c.items[slot];if(!safe(i)||!r)return 0;const reserved=['sell','bank','list','send'].includes(r.action)?bot.production?.reservedQuantity?.(i,r.action==='send'?r.recipient:'')??(bot.production?.reserved(i)?count(i):0):0;return Math.max(0,Math.min(i.q??1,r.batch,count(i)-r.keep-r.teamReserve-reserved));};
 const value=i=>{try{const v=p.call('item_value',i);return Number.isFinite(v)&&v>=0?v:Infinity;}catch{return Infinity;}};
 const goalId=g=>JSON.stringify([g.name,g.item,g.level,g.quantity,g.recipient,g.gearSlot??'']);
 function goalSpent(g){const index=cfg.production.goals.indexOf(g);return Math.max(ledger.goals[goalId(g)]??0,index>=0?ledger.goals[String(index)]??0:0);}
 function goalBudget(cost,loss,item){const goal=bot.production?.activeGoal;return cost+loss===0||!goal||!(bot.production.owns?.(item)??true)||(Object.hasOwn(ledger.goals,goalId(goal))||Object.keys(ledger.goals).length<1024)&&goalSpent(goal)+cost+loss<=goal.budget;}
 function note(s){bot.reason=s;if(lastMessage!==s||Date.now()-lastMessageAt>30000){lastMessage=s;lastMessageAt=Date.now();bot.report(s);}}
 function budget(cost,loss=0,r=null){
  if(Date.now()-ledger.hour>=3600000)ledger={...ledger,hour:Date.now(),spent:0,loss:0};
  const reserve=Math.max(me.goldReserve??0,me.role==='merchant'?cfg.merchant.goldReserve:0);
  const commitments=Object.entries(p.c.slots??{}).reduce((n,[k,i])=>n+(k.startsWith('trade')&&i?.b?Math.max(0,Number(i.price)||0)*Math.max(1,Number(i.q)||1):0),0);
  return Number.isFinite(cost)&&cost>=0&&Number.isFinite(loss)&&loss>=0&&(cost===0||p.c.gold-cost-commitments>=reserve)&&ledger.spent+cost<=cfg.merchant.maxSpendPerHour&&ledger.loss+loss<=cfg.production.lossBudget&&(!r||(cost<=r.goldBudget&&loss<=r.lossBudget));
 }
 // Charge the maximum exposure BEFORE dispatch. A reload or ambiguous result cannot reset a budget.
 function charge(cost,loss,r,kind,details){
  if(!budget(cost,loss,r))return false;const next={...ledger,goals:{...ledger.goals},spent:ledger.spent+cost,loss:ledger.loss+loss};
  const goal=bot.production?.activeGoal;if(goal&&cost+loss>0&&(bot.production.owns?.(details.item)??true)){const spent=goalSpent(goal)+cost+loss;if(spent>goal.budget)return false;next.goals[goalId(goal)]=spent;}
  if(kind==='bank.expand'){next.bankSpent=(ledger.bankSpent??0)+cost;if(next.bankSpent>cfg.merchant.bankBudget)return false;}
  if(!p.write(ledgerKey,next))return false;ledger=next;return true;
 }
 function perform(kind,{slots=[],cost=0,loss=0,rule=null,guard=()=>true,call,observe,details={},timeout=20000}){
  if(bot.recovery?.authorize(kind)===false)return false;const definitions=[...new Set(slots.map(n=>p.c.items[n]?.name).filter(Boolean)),...(rule?.item?[rule.item]:[])];if(definitions.some(name=>bot.content?.approve('item:'+name,[p.G.items[name],p.G.craft?.[name],p.G.drops?.[name]])===false))return false;
  if(closed||!bot.running||bot.inventoryBlocked||bot.journal||bot.bank?.pending&&!kind.startsWith('bank.partial.')&&!(bot.bank.reclaiming&&['bank.reclaim','sell'].includes(kind))||bot.logistics.reserved||!bot.checkpoint.durable||p.c.rip||exec.busy('inventory')||!budget(cost,loss,rule)||!remaining(rule))return false;
  if(!goalBudget(cost,loss,details.item)){note('Produktionsziel: Gesamtbudget ausgeschöpft');return false;}
  const prints=slots.map(s=>[s,fingerprint(p.c.items[s])]);
  const valid=()=>bot.running&&!closed&&!p.c.rip&&!bot.journal&&!bot.inventoryBlocked&&!bot.logistics.reserved&&prints.every(([s,f])=>fingerprint(p.c.items[s])===f&&safe(p.c.items[s]))&&budget(cost,loss,rule)&&guard();
  return exec.run(kind,['inventory','gold','economy'],valid,()=>{
   if(!valid())throw Error('Economy-Zustand verändert');
   if(!charge(cost,loss,rule,kind,details))throw Error('Budget konnte nicht reserviert werden');
   bot.beginValue({kind,...details,cost,loss,slots:prints});
   if(rule&&kind!=='bank.split'&&!kind.startsWith('inventory.'))ruleActions.set(actionKey(rule),(ruleActions.get(actionKey(rule))??0)+1);
   return call();
  },{value:true,timeout,delay:cfg.general.economyTickMs,observe,onSettle:state=>bot.endValue(state)});
 }
 function destination(id){try{return p.call('find_npc',id);}catch{return null;}}
 function at(d,radius=110){return !!d&&samePlace(p.c,d)&&distance(p.c,d)<=radius&&!p.c.moving;}
 function travel(d,label,radius=90){if(!d){note('Kein Arbeitsplatz: '+label);return false;}if(at(d,radius))return true;if(!bot.logistics.reserved){bot.reason='Unterwegs: '+label;bot.movement.go({...d,radius},'economy');}return false;}
 function npcFor(item){if(Number.isInteger(bot.decisionEpoch)){if(npcEpoch!==bot.decisionEpoch){npcEpoch=bot.decisionEpoch;npcCache.clear();}if(npcCache.has(item))return npcCache.get(item);}const candidates=[];for(const [id,n] of Object.entries(p.G.npcs??{})){if(!Array.isArray(n.items)||!n.items.includes(item))continue;const d=destination(id);if(d&&Number.isFinite(d.x)&&Number.isFinite(d.y)&&d.map&&!p.G.maps?.[d.map]?.ignore)candidates.push(d);}const result=candidates.sort((a,b)=>(a.map===p.c.map?-1000000:0)+distance(p.c,a)-((b.map===p.c.map?-1000000:0)+distance(p.c,b)))[0]??null;if(Number.isInteger(bot.decisionEpoch))npcCache.set(item,result);return result;}
 function npcBuy(item,r,quantity){
  const meta=p.G.items[item.name];if(!meta||item.level||item.p||item.stat_type||item.title)return false;
  const price=meta.g;if(!Number.isFinite(price)||price<=0||price>r.maxPrice)return false;
  const before=count(item),q=Math.floor(Math.min(quantity,r.batch,r.maxCount-before,Math.floor(r.goldBudget/price)));
  if(q<1||bot.free()<=cfg.merchant.minFreeSlots||!budget(q*price,0,r)||!travel(npcFor(item.name),'NPC '+item.name))return false;
  return perform('buy',{cost:q*price,rule:r,guard:()=>at(npcFor(item.name))&&count(item)===before&&p.G.items[item.name]?.g===price,call:()=>p.call('buy_with_gold',item.name,q),observe:()=>count(item)>=before+q,details:{item:item.name,variant:identity(item),quantity:q,before}});
 }
 function npcSell(slot,r){const i=p.c.items[slot],q=spare(slot,r),price=value(i);if(!q||!Number.isFinite(price)||price<r.minPrice)return false;const before=count(i),gold=p.c.gold;const d=destination('fancypots')??destination('potions')??npcFor('hpot0');if(!travel(d,'NPC-Verkauf'))return false;
  return perform('sell',{slots:[slot],rule:r,guard:()=>spare(slot,r)>=q&&at(d)&&value(p.c.items[slot])>=r.minPrice,call:()=>p.call('sell',slot,q),observe:()=>count(i)<=before-q&&p.c.gold>=gold+q*r.minPrice,details:{item:i.name,variant:identity(i),quantity:q,before,expectedGold:q*price}});
 }
 return {rules,explicit,count,downstreamSatisfied,safe,spare,value,note,budget,remaining,perform,destination,at,travel,npcFor,npcBuy,npcSell,get ledger(){return ledger;},close(){closed=true;},resume(){closed=false;}};
}
