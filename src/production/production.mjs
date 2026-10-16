import {knowledgeFingerprint} from '../world/knowledge.mjs';
import {purposeReservations} from './purpose-allocation.mjs';
import {mutationContext,mutationHelpers,bestMutationHelper,planMutationHelpers} from './helpers.mjs';
import {estimateRoutes} from './costs.mjs';
import {materialSources,exchangeDrops,exchangeSource} from './materials.mjs';
import {planMaterialQuotas,materialQuotaCap} from './material-quotas.mjs';
import {identity,fingerprint,variantCount} from '../core/policy.mjs';
import {capacityAfterConsumption} from '../items/physical-capacity.mjs';
import {planProduction} from './planner.mjs';
import {findRecipe,recipeIngredients,recipeGridIngredients,matchRecipeSlots,planCraftStackMerge} from './recipes.mjs';
import {ITEM_RULE} from '../../editor/lib/schema.mjs';
import {defaultsFor,phaseOf} from '../../editor/lib/contract.mjs';
import {prioritizeAdmittedProductionGoal,admittedProductionAction,deferNoOfferMarketPlan,firstEligibleProductionSlot} from '../merchant/production-priority.mjs';
// Independent recipients require independent send rules even for identical items.
// Two gear slots for the same recipient accumulate their remaining quantities.
export function pendingDeliveryRuleNeeds(goals,delivered,sender,available=()=>Infinity){
 const grouped=new Map(),allocated=new Map();
 for(const g of goals){
  if(!g.recipient||g.recipient===sender)continue;
  const remaining=Math.max(0,g.quantity-(delivered(g)??0));if(!remaining)continue;
  const stockKey=JSON.stringify([g.item,g.level,g.variant??null]);
  const capacity=Math.max(0,available(g));
  const transferable=Math.min(remaining,Math.max(0,capacity-(allocated.get(stockKey)??0)));
  if(!transferable)continue;
  allocated.set(stockKey,(allocated.get(stockKey)??0)+transferable);
  const key=JSON.stringify([g.recipient,g.item,g.level,g.variant??null]);
  const prior=grouped.get(key);
  if(prior)prior.quantity+=transferable;
  else grouped.set(key,{...g,quantity:transferable});
 }
 return [...grouped.values()];
}
export function needsProductionStock(available,required){return available<required;}
// Prefer already actionable Gear upgrades to a long, remote exchange queue.
// This only changes ordering: server-proven chances, budgets and user rules
// still decide if an actual mutation may execute.
export function gearInputReady(g,stock,meta){
 if(!g?.gearSlot||!Number.isInteger(g.level)||g.level<1||
   !(meta?.upgrade||meta?.compound))return false;
 const needed=meta.compound?3:1;
 const n=(stock??[]).reduce((sum,i)=>sum+(i?.name===g.item&&
   (i.level??0)===g.level-1&&!i.l&&!i.b&&
   (!g.variant||['stat_type','p','title','data'].every(k=>
     g.variant[k]===undefined||JSON.stringify(g.variant[k])===JSON.stringify(i[k]??(['stat_type','p','title'].includes(k)?'':undefined))))?
   (Number.isSafeInteger(i.q)&&i.q>0?i.q:1):0),0);
 return n>=needed;
}
// A multi-level goal can be actionable starting with a lower-level batch.
export function gearChainReady(g,stock,meta){
 if(!g?.gearSlot||!Number.isInteger(g.level)||g.level<1||
   !(meta?.upgrade||meta?.compound))return false;
 for(let level=g.level-1;level>=0;level--)
  if(gearInputReady({...g,level:level+1},stock,meta))return true;
 return false;
}
// Every action needs physical output space, not an arbitrary gap ABOVE the
// Merchant's configured reserve. Reusing a stack or freeing consumed input
// slots can satisfy the requirement even if the inventory is full.
export function actionCapacity(items,consumed=[],output=null,G={},outputs=1){
 if(!Number.isSafeInteger(outputs)||outputs<0)return false;
 const planned=capacityAfterConsumption(items,consumed,output,
   output?G.items?.[output.name]:null);
 return !!planned&&(output?planned.units>=outputs:planned.free>=outputs);
}
// Release only the part of other goals' gross demand already backed by
// verified, non-protected bank inventory. Keep sale reservations gross: this
// exemption is for a current production step's inputs, never liquidation.
export function unbankedDemand(rows,bankItems,name,level){
 const demand=(rows??[]).filter(r=>r.item===name&&r.level===level)
  .sort((a,b)=>Number(!!b.variant)-Number(!!a.variant));
 const available=(bankItems??[]).filter(i=>i?.name===name&&(i.level??0)===level)
  .map(item=>({item,left:Number.isSafeInteger(item.q)&&item.q>0?item.q:1}));
 let remaining=0;
 for(const row of demand){
  let need=row.quantity;
  if(!Number.isSafeInteger(need)||need<0)return Infinity;
  for(const source of available){
   if(!need)break;
   if(row.variant&&identity({name,level,...row.variant})!==identity(source.item))continue;
   const take=Math.min(need,source.left);
   source.left-=take;need-=take;
  }
  remaining+=need;
 }
 return remaining;
}
export function createProduction(bot){
 let helperSearch=null,demandBusy=false,admittedGoalKey=null,admittedAt=0;
 const {p,cfg,exec,me}=bot,e=bot.economy;let preview=null,plan=[],goal=null,materials=[],planningReason=null,heldGoal=null,heldAt=0,planAt=0,goalsEpoch=-1,goalsCache=null,rulesEpoch=-1,rulesCache=null;
 const blockedMutations=new Map();const helperRequests=new Map();const scrollFallbacks=new Map();
 const marketDeferred=new Map(),actionDeferred=new Map();
 function noteDeferred(kind,item,reason,extra={}){
  if(cfg.general.testLogging===undefined)return;
  const key=JSON.stringify([kind,item,reason]),now=Date.now();
  if(now-(actionDeferred.get(key)??-Infinity)<60000)return;
  if(actionDeferred.size>=64)actionDeferred.delete(actionDeferred.keys().next().value);
  actionDeferred.set(key,now);
  bot.event?.('production.actionDeferred',{kind,item,reason,...extra});
 }
 const routeCache=new Map();const farmOrderReceipts=new Set();const waiting=new Map(),intentKey='albot:production:'+bot.me.name+':intent';let intent=p.read(intentKey)??null,intentBlocked=false;
 function persistIntent(next){if(cfg.general.testLogging===undefined)return true;if(intent&&next&&JSON.stringify({...intent,at:0})===JSON.stringify({...next,at:0}))return true;if(!p.write(intentKey,next)){intentBlocked=true;bot.economy.note('Produktionsabsicht konnte nicht gespeichert werden');return false;}intent=next;return true;}
 const deliveryKey='albot:production:'+bot.me.name+':deliveries',goalKey=g=>JSON.stringify([g.name,g.item,g.level,g.quantity,g.recipient,...(g.gearSlot?[g.gearSlot]:[]),...(g.variant?[g.variant]:[])]);
 let deliveries=p.read(deliveryKey)??{};if(!deliveries||typeof deliveries!=='object'||Array.isArray(deliveries))deliveries={};
 const goals=()=>{if(goalsCache&&Number.isInteger(bot.decisionEpoch)&&goalsEpoch===bot.decisionEpoch)return goalsCache;
  // Guard reentrant goal evaluation before asking gear/intelligence.
  goalsEpoch=bot.decisionEpoch;goalsCache=[];const tools=cfg.production.autonomy&&bot.me.role==='merchant'?['fishing','mining'].filter(k=>cfg.merchant[k]).map(k=>({name:'Werkzeug: '+k,enabled:true,item:k==='fishing'?'rod':'pickaxe',level:0,quantity:1,recipient:'',budget:cfg.merchant.toolBudget,priority:55})).filter(g=>p.c.slots?.mainhand?.name!==g.item):[];goalsEpoch=bot.decisionEpoch;return goalsCache=[...cfg.production.goals,...(bot.gear?.goals()??[]),...(bot.elixirs?.goals()??[]),...(bot.supplies?.goals()??[]),...(bot.intelligence?.profitGoals()??[]),...tools].filter(g=>g.enabled).sort((a,b)=>b.priority-a.priority);};
 function recordDelivery(j){
  if(j.kind!=='send'||!j.id||!j.to||typeof j.item!=='object')return true;if(Object.values(deliveries).some(x=>x.last?.includes(j.id)))return true;const next=structuredClone(deliveries);let changed=false,remaining=j.quantity;
  for(const g of goals().filter(g=>g.recipient===j.to&&g.item===j.item.name&&g.level===j.item.level&&variantMatches(j.item,g))){
   const key=goalKey(g),old=next[key]??{quantity:0,last:[]};if(!Number.isFinite(old.quantity)||!Array.isArray(old.last))return false;const take=Math.min(remaining,Math.max(0,g.quantity-old.quantity));if(take<=0)continue;
   next[key]={quantity:old.quantity+take,last:[...old.last,j.id].slice(-32)};changed=true;remaining-=take;if(!remaining)break;
  }
  if(changed){if(Object.keys(next).length>1024)return false;if(!p.write(deliveryKey,next))return false;deliveries=next;}return true;
 }
 function matchesOutput(i){const r=e.explicit(i,'production'),recipe=r?.recipe&&r.action==='craft'?findRecipe(p.G,i.name,r.recipe)?.recipe:null;return !recipe?.output?.data||JSON.stringify(i.data)===JSON.stringify(recipe.output.data);}
 function demand(exclude=null,recipient='',recipientItem=null,allocatedGoals=null){
  const nested=demandBusy;demandBusy=true;
  try{return purposeReservations({G:p.G,goals:(allocatedGoals??(nested?cfg.production.goals:goals())).filter(g=>!g.name.startsWith('Gewinnproduktion ')),exclude,recipient,recipientItem,
   delivered:g=>deliveries[goalKey(g)]?.quantity??0,
   stock:(name,level,variant)=>p.c.items.reduce((n,i)=>n+(i?.name===name&&(i.level??0)===level&&
    (!variant||identity(i)===identity({name,level,...variant}))&&!i.l&&!i.b?(i.q??1):0),0)});}finally{demandBusy=nested;}
 }
 function reserveOther(name,level,g=goal){const pending=Math.max(0,...[...waiting.entries()].filter(([key,w])=>key!==goalKey(g??{})&&w.until>Date.now()).flatMap(([,w])=>w.reservations.filter(r=>r.item===name&&r.level===level).map(r=>r.quantity)));if(cfg.production.purposeAllocation){const ordered=goals(),position=g?ordered.findIndex(x=>goalKey(x)===goalKey(g)):-1;
     const predecessors=position>=0?ordered.slice(0,position).filter(x=>!(waiting.get(goalKey(x))?.until>Date.now())):ordered;
     const d=demand(g,'',null,predecessors);return d.blocked?Infinity:Math.max(g?0:pending,unbankedDemand(d.rows,
     (bot.bank?.catalogStock?.()??[]).map(r=>r.item).filter(i=>e.safe(i)&&
      e.explicit(i)?.action!=='keep'),name,level));}if(g?.item===name&&g.level===level)return pending;return pending+goals().filter(x=>!x.recipient&&(bot.me.role==='merchant'||x.gearSlot&&x.character===bot.me.name)&&x.item===name&&x.level===level).reduce((n,x)=>Math.max(n,x.quantity),0);}
 const variantMatches=(i,g)=>!g?.variant||g.item!==i.name||['stat_type','p','title','data'].every(k=>g.variant[k]===undefined||JSON.stringify(g.variant[k])===JSON.stringify(i[k]??(['stat_type','p','title'].includes(k)?'':undefined)));
 const qty=(name,level,g=goal)=>{let total=0,reserve=0;const groups=new Map();for(const i of p.c.items){const r=i&&e.explicit(i);if(i?.name===name&&(i.level??0)===level&&matchesOutput(i)&&variantMatches(i,g)&&r?.action!=='keep'&&!i.l&&!i.b){total+=i.q??1;groups.set(identity(i),(groups.get(identity(i))??0)+(i.q??1));reserve=Math.max(reserve,(r?.keep??0)+(r?.teamReserve??0));}}if(p.G.items[name]?.compound&&groups.size)total=Math.max(...groups.values());return Math.max(0,total-reserve-reserveOther(name,level,g));};
 function generated(action,item,quantity,g=goal){return {...defaultsFor(ITEM_RULE),name:'Automatisch: '+(g?.name??'Material')+' / '+action+' / '+item.name,_autoProduction:true,role:bot.me.role,character:bot.me.name,item:item.name,minLevel:item.level??0,maxLevel:item.level??0,...(g?.variant&&g.item===item.name?{statType:g.variant.stat_type??'',property:g.variant.p??'',title:g.variant.title??''}:{}),action,priority:g?.priority??0,targetCount:quantity,maxCount:quantity,batch:Math.max(1,quantity),maxPrice:cfg.merchant.budgetMode==='account-loss'?Number.MAX_SAFE_INTEGER:cfg.production.helperMaxPrice??100000,goldBudget:g?.budget??0,lossBudget:cfg.production.lossBudget,minChance:cfg.production.minChance,targetLevel:(item.level??0)+1};}
 function effectiveRules(){
  if(rulesCache&&Number.isInteger(bot.decisionEpoch)&&rulesEpoch===bot.decisionEpoch)return rulesCache;
  if(!cfg.production.autonomy||!cfg.production.enabled)return cfg.items;
  // Guard reentrant rules resolution before calling intelligence.rules().
  rulesEpoch=bot.decisionEpoch;rulesCache=[];
  const extra=[];
  for(const g of pendingDeliveryRuleNeeds(goals(),g=>deliveries[goalKey(g)]?.quantity??0,bot.me.name,g=>qty(g.item,g.level,g))){
   extra.push({...generated('send',{name:g.item,level:g.level},g.quantity,g),recipient:g.recipient});
  }
  for(const g of goals()){
   if(g.gearSlot&&(!g.recipient||g.recipient===bot.me.name))extra.push({...generated('equip',{name:g.item,level:g.level},g.quantity,g),slot:g.gearSlot});
  }
  // Receiving characters derive only their explicitly configured gear demand.
  for(const g of cfg.production.gearTargets??[])if(g.enabled&&g.character===bot.me.name&&!(p.c.slots?.[g.slot]?.name===g.item&&(p.c.slots[g.slot].level??0)>=g.level))extra.push({...generated('equip',{name:g.item,level:g.level},1,g),slot:g.slot});
  for(const g of cfg.production.goals)if(g.enabled&&g.recipient===bot.me.name)extra.push(generated('keep',{name:g.item,level:g.level},g.quantity,g));
  if(bot.me.role==='merchant'){for(const g of goals())if(g.sourceOwner&&g.sourceOwner!==me.name)extra.push(generated('keep',{name:g.item,level:g.sourceLevel??g.level},1,g));for(const step of plan)if(step.kind==='farm')extra.push(generated('keep',{name:step.item,level:step.level},step.quantity+qtyRaw({name:step.item,level:step.level})));}
  else {const merchant=bot.transport.fresh(cfg.party.merchant);for(const g of merchant?.gearOrders??[])if(g.sourceOwner===me.name){extra.push({...generated(g.character===me.name&&g.level===(g.targetLevel??g.level)?'equip':'send',{name:g.item,level:g.level},1,g),slot:g.gearSlot,recipient:cfg.party.merchant});}for(const request of merchant?.materials??[])if(Number.isSafeInteger(request.quantity)&&request.quantity>0&&request.quantity<=1000000)extra.push({...generated('send',{name:request.item,level:0},request.quantity),recipient:cfg.party.merchant});}
  rulesEpoch=bot.decisionEpoch;return rulesCache=[...cfg.items,...(bot.allocation?.rules()??[]),...extra,...(bot.intelligence?.rules()??[])];
 }
 function derivedRule(item,phase){
  if(!cfg.production.autonomy||!cfg.production.enabled)return null;
  if(phase==='inventory')return effectiveRules().slice(cfg.items.length).find(r=>r.item===item.name&&r.minLevel===(item.level??0))??null;
  const step=plan.find(s=>s.item===item.name&&s.level===(item.level??0)&&phaseOf(s.kind)===phase);if(!step||!goal)return null;
  return {...generated(step.kind,item,Math.max(1,qtyRaw(item)+(step.outputQuantity??step.quantity))),targetLevel:step.targetLevel??(item.level??0)+1,recipe:step.recipe??step.output??''};
 }
 const qtyRaw=item=>p.c.items.reduce((n,i)=>n+(i?.name===item.name&&(i.level??0)===(item.level??0)&&!i.l&&!i.b?(i.q??1):0),0);
 function mergeFor(item,required,r,contextReady){
  const key=identity(item),level=item.level??0;
  // Merges rearrange inventory. Do not select an ingredient protected by
  // either an explicit or an effective (derived) inventory keep rule.
  const eligible=i=>!!i&&identity(i)===key&&e.safe(i)&&e.rules(i,'inventory')?.action!=='keep'&&e.explicit(i)?.action!=='keep'&&
   Number.isSafeInteger(i.q??1)&&(i.q??1)>0;
  const limit=()=>p.G.items[item.name]?.s??1;
  const livePair=(x,y)=>{
   const a=p.c.items[x],b=p.c.items[y],sum=(a?.q??1)+(b?.q??1),policy=a&&e.rules(a,'inventory');
   return x!==y&&eligible(a)&&eligible(b)&&Number.isSafeInteger(sum)&&Number.isSafeInteger(limit())&&
    sum<=limit()&&cfg.production.enabled&&cfg.production.craft&&e.remaining(r)&&contextReady()&&
    e.count(a)-required>=(policy?.keep??0)+(policy?.teamReserve??0)+reserveOther(item.name,level);
  };
  const slots=p.c.items.map((i,n)=>({i,n})).filter(({i})=>{
   if(!eligible(i))return false;
   const policy=e.rules(i,'inventory');
   return e.count(i)-required>=(policy?.keep??0)+(policy?.teamReserve??0)+reserveOther(item.name,level);
  });
  const complete=planCraftStackMerge(slots.map(({i,n})=>({slot:n,quantity:i.q??1})),required,limit());
  if(!complete)return false;
  // Every staged merge must belong to a complete feasible stack; the next
  // invocation replans using the newly merged inventory.
  const [first,second]=complete.slots;
  if(!livePair(first,second))return false;
  const a={n:first,i:p.c.items[first]},b={n:second,i:p.c.items[second]};
  const sum=(a.i.q??1)+(b.i.q??1),before=e.count(item);
  return e.perform('inventory.merge',{slots:[a.n,b.n],rule:r,guard:()=>livePair(a.n,b.n)&&e.count(item)===before,
   call:()=>p.call('swap',a.n,b.n),
   observe:()=>e.count(item)===before&&((p.c.items[a.n]?.q===sum&&!p.c.items[b.n])||(p.c.items[b.n]?.q===sum&&!p.c.items[a.n])),
   details:{item:item.name,quantity:sum,required}});
 }
 function capacity(consumed=[],output=null,outputQuantity=1){
  if(actionCapacity(p.c.items,consumed,output,p.G,outputQuantity))return true;
  e.note('Produktionsschritt blockiert: keine freien Ausgabeplätze; physisch frei='+bot.free());
  return false;
 }
 function outputCount(name,r){const data=findRecipe(p.G,name,r.recipe)?.recipe.output?.data;return p.c.items.reduce((n,i)=>n+(i?.name===name&&(i.level??0)===0&&(data===undefined||JSON.stringify(i.data)===JSON.stringify(data))?(i.q??1):0),0);}
 function mutate(slot,r){
  const i={...p.c.items[slot]},kind=r.action;if(!e.remaining(r)||!cfg.production.enabled||!cfg.production[kind]||!e.safe(i)||!p.G.items[i.name]?.[kind]||(i.level??0)>=r.targetLevel)return false;
  const blockKey=identity(i)+':'+kind,blocked=blockedMutations.get(blockKey);
  if(blocked&&blocked.until>Date.now()&&e.budget&&!e.budget(blocked.cost,blocked.loss,r))return false;
  blockedMutations.delete(blockKey);
  const inputs=[slot];if(kind==='compound')for(let n=0;n<p.c.items.length&&inputs.length<3;n++)if(n!==slot&&e.safe(p.c.items[n])&&identity(i)===identity(p.c.items[n]))inputs.push(n);
  if(kind==='compound'&&inputs.length!==3){
   noteDeferred(kind,i.name,'identical-safe-inputs-missing',{found:inputs.length,required:3});
   return false;
  }
  if(e.count(i)-inputs.length<r.keep+r.teamReserve+reserveOther(i.name,i.level??0))return false;
  // Only implicit standard-scroll upgrades may opt into scroll1. Explicit
  // scrolls/offerings and the profit planner keep their own helper policies.
  const fallbackKey=()=>JSON.stringify([p.c.items[slot],p.G.version,p.G.upgrades,
   p.G.items[i.name],p.G.items.scroll0,p.G.items.scroll1,cfg.production,cfg.items,r]);
  const fallbackProof=fallbackKey(),fallback=scrollFallbacks.get(fallbackProof);
  if(fallback?.until>Date.now()&&fallback.blocked)return false;
  const fallbackEligible=kind==='upgrade'&&!r.scroll&&!r.offering&&!r._autoDisposition&&cfg.production.autoHelpers&&p.call('item_grade',i)===0;
  const useScroll1=fallbackEligible&&fallback?.until>Date.now()&&fallback.scroll==='scroll1';
  if(cfg.production.autoHelpers&&r._autoDisposition){
   const context=mutationContext(bot,i);
   if(helperSearch?.context!==context||Date.now()-helperSearch.at>30000)
    helperSearch={context,at:Date.now(),rows:mutationHelpers(bot,i,kind),quotes:[],index:0};
   const search=helperSearch,candidate=search.rows[search.index];
   const d=e.destination('newupgrade')??e.destination('upgrade');if(!e.npcTravel(d,kind))return false;
   if(candidate){
    if(exec.busy('economy'))return false;
    const args=kind==='compound'?[...inputs,candidate.scrollSlot,candidate.offeringSlot]:[slot,candidate.scrollSlot,candidate.offeringSlot];
    return exec.run('production.helper-preview',['economy'],()=>bot.running&&!bot.journal&&
      mutationContext(bot,i)===context&&e.npcAt(d),()=>Promise.resolve(p.call(kind,...args,true)).then(result=>{
       if(helperSearch!==search||mutationContext(bot,i)!==context)return;
       const chance=Number(result?.chance??result?.success_chance),fee=result?.cost??0;
       search.quotes.push({...candidate,chance,cost:candidate.cost+(Number.isFinite(fee)&&fee>=0?fee:Infinity)});search.index++;
      },()=>{if(helperSearch===search){search.quotes.push({...candidate,chance:NaN});search.index++;}}),{delay:1000});
   }
   const input=e.value(i),output=e.value({...i,level:(i.level??0)+1});
   // Invalid or unsupported preview combinations cannot poison the entire
   // candidate list: only individually server-verified quotes may compete.
   // Wait for every attempted preview before planning a finite helper choice.
   const verifiedQuotes=search.quotes.filter(q=>Number.isFinite(q.chance)&&
    q.chance>=0&&q.chance<=1&&Number.isFinite(q.cost)&&q.cost>=0);
   const choice=search.index>=search.rows.length&&verifiedQuotes.length?
    planMutationHelpers(bot,i,verifiedQuotes,kind,Math.max(r.minChance,cfg.production.minChance)):
    {action:'bank',ev:input,reason:search.index<search.rows.length?
     'helper-preview-incomplete':'helper-preview-unverified'};
   bot.intelligence?.recordHelpers(i,choice);
   if(choice.action!==kind){
    if(search.reported!==true){search.reported=true;
     bot.event?.('production.helperDeferred',{item:i.name,level:i.level??0,kind,
      checked:search.quotes.length,verified:verifiedQuotes.length,
      reason:choice.reason??'no-profitable-safe-helper',minimum:Math.max(r.minChance,cfg.production.minChance)});
    }return false;
   }
   r={...r,scroll:choice.scroll,offering:choice.offering};
  }
  const scrollName=useScroll1?'scroll1':r.scroll||((kind==='compound'?'cscroll':'scroll')+p.call('item_grade',i));
  const usable=x=>{const rule=x&&e.rules(x);return e.safe(x)&&rule?.action!=='keep'&&e.count(x)>(rule?rule.keep+rule.teamReserve:0)+reserveOther(x.name,x.level??0);};
  const scroll=p.c.items.findIndex(x=>x?.name===scrollName&&usable(x));const offering=r.offering?p.c.items.findIndex(x=>x?.name===r.offering&&usable(x)):null;
  // Merchant-only helper request: only for a rule explicitly asking for it.
  if(r.offering&&offering<0)requestHelper(r.offering,1);
  if(scroll<0)requestHelper(scrollName,1,useScroll1?()=>fallbackKey()===fallbackProof&&fallback.until>Date.now():null);
  if(scroll<0||(r.offering&&offering<0)){
   noteDeferred(kind,i.name,'helpers-not-carried',{scroll:scrollName,offering:r.offering??null});
   e.note('Produktion benötigt '+scrollName+(r.offering?' / '+r.offering:''));return false;
  }
  const slots=[...inputs,scroll,...(offering===null?[]:[offering])];if(new Set(slots).size!==slots.length)return false;
  const d=e.destination('newupgrade')??e.destination('upgrade');if(!e.npcTravel(d,kind))return false;
  // Bind the preview to the current mutation definitions and user's rule.
  // Slot fingerprints alone do not capture changed minimum chance or scroll policy.
  const policyProof=()=>JSON.stringify([p.G.version,p.G.upgrades,p.G.compounds,p.G.items[i.name],p.G.items[scrollName],p.G.items[r.offering],r.scroll,r.offering,r.targetLevel,r.minChance,cfg.production,cfg.items]);
  const initialPolicyProof=policyProof();
  const key=kind+':'+slots.map(n=>fingerprint(p.c.items[n])).join('|')+':'+initialPolicyProof;
  const args=kind==='compound'?[...inputs,scroll,offering]:[slot,scroll,offering];
  if(preview?.key!==key||Date.now()-preview.time>5000){
   if(exec.busy('economy'))return false;preview={key,time:Date.now(),chance:null,cost:null};const token=preview;
   const accepted=exec.run('production.preview',['economy'],()=>bot.running,()=>Promise.resolve(p.call(kind,...args,true)).then(result=>{if(preview!==token||!bot.running)return;const raw=typeof result==='number'?result:result?.chance??result?.success_chance;token.chance=Number(raw);bot.intelligence?.recordChance(i.name,i.level??0,kind,token.chance,{scroll:scrollName,offering:r.offering??''});token.cost=result?.cost??0;bot.event?.('production.preview-result',{item:i.name,level:i.level??0,kind,scroll:scrollName,offering:r.offering??'',chance:token.chance,cost:token.cost,minimum:Math.max(r.minChance,cfg.production.minChance)});}),{delay:1000});if(!accepted)preview=null;return accepted;
  }
  const chance=preview.chance,cost=preview.cost;
  const minimum=Math.max(r.minChance,cfg.production.minChance);
  if(Number.isFinite(chance)&&chance>=0&&chance<minimum&&Number.isFinite(cost)&&cost>=0&&fallbackEligible){
   // The server applies the higher-grade bonus once to the base probability,
   // then adds the unchanged no-offering grace. This estimate authorizes only
   // acquisition; execution still requires a fresh real scroll1 preview.
   const baseGrade=p.call('item_grade',{...i,level:0}),base=p.G.upgrades?.[baseGrade]?.[(i.level??0)+1];
   const estimate=Number.isFinite(base)&&base>0&&base<=chance&&chance<Math.min(base+.24,base*2)&&
    (i.level??0)+1<=10&&p.G.items.scroll1?.type==='uscroll'&&p.G.items.scroll1.grade===1?
    Math.min(chance+base*.2+.01,base+.36,base*3):null;
   const upgrade=scrollName==='scroll0'&&Number.isFinite(estimate)&&estimate>=minimum;
   if(scrollFallbacks.size>=64)scrollFallbacks.delete(scrollFallbacks.keys().next().value);
   scrollFallbacks.set(fallbackProof,{scroll:upgrade?'scroll1':scrollName,blocked:!upgrade,until:Date.now()+(upgrade?300000:60000)});
   bot.event?.('production.scroll-fallback',{item:i.name,level:i.level??0,scroll:scrollName,chance,minimum,estimatedScroll1Chance:estimate,next:upgrade?'scroll1':'deferred'});
   e.note(upgrade?'Upgrade: prüfe scroll1 statt scroll0':'Upgrade zurückgestellt: Chance '+(chance*100).toFixed(2)+' % unter '+(minimum*100).toFixed(0)+' %');return false;
  }
  if(!Number.isFinite(chance)||chance>1||chance<minimum||!Number.isFinite(cost)||cost<0){
   noteDeferred(kind,i.name,'chance-or-cost-unverified',{chance,cost,minimum});
   e.note('Upgrade/Compound: Chance oder Kosten nicht freigegeben');return false;
  }
  if(cfg.production.autoHelpers&&r._autoDisposition){
   const helperCost=slots.filter(n=>!inputs.includes(n)).reduce((sum,n)=>sum+Math.max(e.value(p.c.items[n]),p.G.items[p.c.items[n].name]?.g??0),0)+cost;
   const check=cfg.production.finiteHelpers?planMutationHelpers(bot,i,helperSearch.quotes.map(q=>q.scroll===scrollName&&q.offering===(r.offering??'')?{...q,chance,cost:helperCost}:q),kind,Math.max(r.minChance,cfg.production.minChance)):bestMutationHelper([{chance,cost:helperCost,preserves:kind==='upgrade'&&p.G.items[scrollName]?.grade===3.6}],{
    inputValue:e.value(i),outputValue:e.value({...i,level:(i.level??0)+1}),factor:inputs.length,
    minChance:Math.max(r.minChance,cfg.production.minChance),margin:cfg.production.minImprovement});
   if(check.action!==kind||cfg.production.finiteHelpers&&(check.scroll!==scrollName||(check.offering??'')!==(r.offering??''))){bot.intelligence?.recordHelpers(i,check);return false;}
  }
  const loss=slots.reduce((sum,n)=>sum+e.value(p.c.items[n]),0),before=e.count(i),next={...i,level:(i.level??0)+1},after=e.count(next),scrollBefore=p.c.items[scroll].q??1;
  if(e.budget&&!e.budget(cost,loss,r)){
   if(blockedMutations.size>=64)blockedMutations.delete(blockedMutations.keys().next().value);
   blockedMutations.set(blockKey,{cost,loss,until:Date.now()+60000});
   e.note(kind+': '+(e.budgetExplanation?.(cost,loss,r)??'Budget gesperrt'));
   bot.event?.('production.budget-deferred',{item:i.name,kind,cost,loss,retryAt:Date.now()+60000});return false;
  }
  const mutationReady=()=>{
   if(!cfg.production.enabled||!cfg.production[kind]||!p.G.items[i.name]?.[kind]||!e.remaining(r)||
      (i.level??0)>=r.targetLevel||policyProof()!==initialPolicyProof||
      preview?.key!==key||Date.now()-preview.time>=5000||
      !Number.isFinite(preview.chance)||preview.chance<Math.max(r.minChance,cfg.production.minChance)||
      !Number.isFinite(preview.cost)||preview.cost!==cost||
      e.count(i)-inputs.length<r.keep+r.teamReserve+reserveOther(i.name,i.level??0))return false;
   if(!inputs.every(n=>e.safe(p.c.items[n])&&identity(p.c.items[n])===identity(i)))return false;
   if(p.c.items[scroll]?.name!==scrollName||!usable(p.c.items[scroll]))return false;
   if(offering!==null&&(p.c.items[offering]?.name!==r.offering||!usable(p.c.items[offering])))return false;
   return e.npcAt(d);
  };
  let mutationResult=null;
  return e.perform(kind,{slots,cost,loss,rule:r,guard:mutationReady,
   call:()=>Promise.resolve(p.call(kind,...args)).then(result=>{mutationResult=result;return result;}),observe:()=>{
    const consumed=p.c.items[scroll]?.name!==scrollName||(p.c.items[scroll]?.q??1)<scrollBefore;
    const retainedFailure=kind==='upgrade'&&p.G.items[scrollName]?.grade===3.6&&
      mutationResult?.success===false&&!mutationResult.calculate&&e.count(i)===before&&identity(p.c.items[slot])===identity(i);
    return consumed&&!p.c.q?.[kind]&&(e.count(next)>after||e.count(i)<=before-inputs.length||retainedFailure);
   },details:{item:i.name,riskVariant:identity(i),before,quantity:inputs.length,targetLevel:next.level},timeout:45000});
 }
 function craft(name,r){
  const found=findRecipe(p.G,name,r.recipe),recipe=found?.recipe;if(r.action!=='craft'||!e.remaining(r)||!cfg.production.enabled||!cfg.production.craft||!recipe)return false;
  const yieldCount=recipe.q??recipe.quantity??1;if(!Number.isSafeInteger(yieldCount)||yieldCount<1||outputCount(name,r)+yieldCount>Math.min(r.targetCount,r.maxCount))return false;
  // Game definitions may change or contain malformed recipes. A bad grid
  // must reject only this action, not throw out of the autonomous bot tick.
  let grid,totals;
  try{grid=recipeGridIngredients(recipe);totals=recipeIngredients(recipe);}catch(e){
   e?.message&&bot.event?.('production.craft-unavailable',{recipe:found.key,reason:String(e.message).slice(0,120)});
   return false;
  }
  const recipeProof=JSON.stringify([found.key,recipe]);
  const totalFor=(id,level)=>totals.find(x=>x.item===id&&x.level===level)?.quantity??0;
  // Each official craft grid position needs a different inventory slot.
  // Build candidate sets before assigning any slot: first-fit can consume
  // the only sufficiently large stack on an earlier, smaller recipe row.
  const candidates=grid.map(({quantity:q,item:id,level})=>{
   const total=totalFor(id,level),eligible=[];
   for(let n=0;n<p.c.items.length;n++){
    const i=p.c.items[n],policy=i&&e.rules(i);
    if(i?.name===id&&(i.level??0)===level&&e.safe(i)&&(i.q??1)>=q&&
       policy?.action!=='keep'&&
       e.count(i)-total>=(policy?policy.keep+policy.teamReserve:0)+reserveOther(id,level))eligible.push(n);
   }
   return eligible;
  });
  const slots=matchRecipeSlots(candidates);
  if(!slots){
   // Merging can prepare a single grid position, but it must not pretend
   // one merged stack can occupy multiple positions of the same ingredient.
   const missing=grid.find((_,index)=>candidates[index].length===0);
   if(!missing)return false;
   const {item:id,level,quantity:q}=missing,total=totalFor(id,level);
   if(grid.filter(req=>req.item===id&&req.level===level).length!==1)return false;
   const candidate=p.c.items.find(i=>i?.name===id&&(i.level??0)===level&&e.safe(i)&&e.rules(i)?.action!=='keep');
   if(!candidate)return false;
   const policy=e.rules(candidate);
   if(e.count(candidate)-total<(policy?policy.keep+policy.teamReserve:0)+reserveOther(id,level))return false;
   // A queued swap is still a crafting operation: stale recipe keys, changed
   // ingredient requirements or a completed output target must stop it too.
   const contextReady=()=>{
    const live=findRecipe(p.G,name,r.recipe);
    const currentYield=live?.recipe?.q??live?.recipe?.quantity??1;
    return r.action==='craft'&&!!live&&JSON.stringify([live.key,live.recipe])===recipeProof&&
     Number.isSafeInteger(currentYield)&&currentYield>0&&
     outputCount(name,r)+currentYield<=Math.min(r.targetCount,r.maxCount);
   };
   return mergeFor(candidate,q,r,contextReady);
  }
  const requirements=slots.map((slot,n)=>({item:{...p.c.items[slot]},before:e.count(p.c.items[slot]),q:grid[n].quantity}));
  if(!Number.isFinite(recipe.cost)||recipe.cost<0)return false;
  const questNpc=recipe.quest&&(p.G.npcs?.[recipe.quest]?recipe.quest:Object.entries(p.G.npcs??{}).find(([,n])=>n.quest===recipe.quest)?.[0]),d=e.destination(questNpc||'craftsman');if(recipe.quest&&!questNpc){e.note('Rezept-Arbeitsplatz fehlt: '+recipe.quest);return false;}
  const item={name,level:0,data:recipe.output?.data},total=()=>p.c.items.reduce((n,i)=>n+(i?.name===name&&(i.level??0)===(item.level??0)&&(item.data===undefined||JSON.stringify(i.data)===JSON.stringify(item.data))?i.q??1:0),0),before=total();
  if(!capacity(slots.map((slot,n)=>({slot,quantity:requirements[n].q})),item,yieldCount)||!e.npcTravel(d,'Craft '+name))return false;
  // The game chooses the craft outcome from the live recipe/ingredients. Recheck
  // that contract at dispatch: an inventory fingerprint alone cannot detect a
  // changed recipe, keep rule, reserve, output cap or crafting permission.
  const craftReady=()=>{
   if(r.action!=='craft'||!cfg.production.enabled||!cfg.production.craft||!e.remaining(r))return false;
   const live=findRecipe(p.G,name,r.recipe);
   if(!live||JSON.stringify([live.key,live.recipe])!==recipeProof)return false;
   const produced=live.recipe.q??live.recipe.quantity??1;
   if(!Number.isSafeInteger(produced)||produced<1||outputCount(name,r)+produced>Math.min(r.targetCount,r.maxCount))return false;
   let ingredients,materialTotals;try{ingredients=recipeGridIngredients(live.recipe);materialTotals=recipeIngredients(live.recipe);}catch{return false;}
   if(ingredients.length!==slots.length)return false;
   return ingredients.every((req,n)=>{
    const i=p.c.items[slots[n]],policy=i&&e.rules(i),aggregate=materialTotals.find(x=>x.item===req.item&&x.level===req.level);
    return i?.name===req.item&&(i.level??0)===req.level&&e.safe(i)&&(i.q??1)>=req.quantity&&
     policy?.action!=='keep'&&e.count(i)-aggregate.quantity>=(policy?policy.keep+policy.teamReserve:0)+reserveOther(req.item,req.level);
   })&&capacity(slots.map((slot,n)=>({slot,quantity:ingredients[n].quantity})),item,produced);
  };
  // Observe the *aggregate* consumption. Looking at each repeated row alone
  // would falsely confirm a two-position recipe after consuming only one.
  const consumption=totals.map(req=>({...req,before:e.count({name:req.item,level:req.level})}));
  return e.perform('craft',{slots,cost:recipe.cost,rule:r,guard:()=>e.npcAt(d)&&craftReady(),call:()=>p.call('craft',...slots),observe:()=>total()>before&&consumption.every(x=>e.count({name:x.item,level:x.level})<=x.before-x.quantity),details:{item:name,recipe:found.key,before},timeout:45000});
 }
 function exchange(slot,r,step=null){
   const existing=p.c.items[slot];if(!existing)return false;
   const i={...existing},q=p.G.items[i.name]?.e;if(!e.remaining(r)||!cfg.production.enabled||!cfg.production.exchange||!Number.isSafeInteger(q)||q<1||e.spare(slot,r)<q)return false;
   if(e.count(i)-q<r.keep+r.teamReserve+reserveOther(i.name,i.level??0))return false;
   if(r.recipe){if(!exchangeDrops(p.G,p.G.drops?.[i.name]).some(x=>x.item===r.recipe)){e.note('Exchange-Ziel nicht in Spieldaten: '+r.recipe);return false;}if(qty(r.recipe,0)>=Math.min(r.targetCount,r.maxCount))return false;}
   if(bot.storage?.exchangeAllowed?.(slot,q)===false)return false;
   if(!capacity([{slot,quantity:q}]))return false;
   const source=()=>exchangeSource(p.G,i.name,p.root?.S??p.parent?.S??{});
   const verified=source(),proof=x=>JSON.stringify({quest:x.quest,npc:x.npc,destination:x.destination,event:x.event});
   if(!verified.ready||step?.sourceProof&&proof(verified)!==JSON.stringify(step.sourceProof)){e.note('Exchange-Quelle nicht verifiziert: '+i.name+' / '+(verified.reason??'Quellenwechsel'));return false;}
   const d=verified.quest?verified.destination:e.destination('exchange');
   if(!e.npcTravel(d,'Exchange '+i.name))return false;const before=e.count(i),initialProof=proof(verified);
   return e.perform('exchange',{slots:[slot],loss:cfg.general.testLogging!==undefined?q*e.value(i):0,rule:r,guard:()=>{const live=source();return bot.storage?.exchangeAllowed?.(slot,q)!==false&&live.ready&&proof(live)===initialProof&&(!step?.sourceProof||proof(live)===JSON.stringify(step.sourceProof))&&e.npcAt(d)&&e.spare(slot,r)>=q&&actionCapacity(p.c.items,[{slot,quantity:q}],null,p.G);},call:()=>p.call('exchange',slot),observe:()=>!p.c.q?.exchange&&!p.c.items.some(x=>x?.name==='placeholder')&&e.count(i)<=before-q,details:{item:i.name,quantity:q,before,quest:verified.quest,event:verified.event},
    onConfirmed:()=>{bot.merchant?.confirmedExchange?.(i.name,slot);return true;},timeout:45000});
  }
 // A production goal may be reprioritized while its already admitted NPC
 // journey is running. Preserve one narrowly scoped, in-memory rule ticket
 // and reevaluate actual outstanding demand before dispatching any exchange.
 // This is NOT a durable value journal and grants no additional permissions.
 function captureExchangeRoute(step){
  if(step?.kind!=='exchange'||plan[0]?.kind!=='exchange'||
     !goal||plan[0].item!==step.item||
     (plan[0].level??0)!==(step.level??0))return null;
  const item={name:step.item,level:step.level??0};
  const rule=e.rules(item,'production');
  if(rule?.action!=='exchange'||rule.item!==item.name||
     !e.remaining(rule))return null;
  const source=p.c.items.find(i=>i?.name===item.name&&
   (i.level??0)===item.level&&e.safe(i));
  if(!source)return null;
  return {kind:'exchange',item:item.name,level:item.level,
   rule:structuredClone(rule),goalKey:goalKey(goal),
   variant:identity(source),sourceProof:step.sourceProof??null};
 }
 function resumeExchangeRoute(ticket){
  if(!ticket||ticket.kind!=='exchange'||!ticket.rule||
     ticket.rule.action!=='exchange'||ticket.rule.item!==ticket.item||
     !cfg.production.enabled||!cfg.production.exchange)return false;
  const rule=ticket.rule;
  if(rule._autoProduction){
   if(!cfg.production.autonomy||!ticket.goalKey)return false;
   // Reprioritization is allowed; removal/completion of the ORIGINAL demand
   // is not. The old rule may only consume items for a still-open goal.
   const g=goals().find(x=>goalKey(x)===ticket.goalKey);
   if(!g)return false;
   const left=Math.max(0,g.quantity-(g.recipient?
    deliveries[goalKey(g)]?.quantity??0:0));
   if(!left||!needsProductionStock(qty(g.item,g.level,g),left))return false;
  }
  const slot=p.c.items.findIndex(i=>i?.name===ticket.item&&
   (i.level??0)===(ticket.level??0)&&identity(i)===ticket.variant&&
   e.safe(i));
  if(slot<0)return false;
  const item=p.c.items[slot];
  // A new explicit keep rule must veto an old automatically generated ticket.
  if(e.explicit(item,'inventory')?.action==='keep'||
     e.explicit(item,'production')?.action==='keep')return false;
  if(!rule._autoProduction){
   const active=[e.rules(item,'production'),e.rules(item,'inventory')];
   if(!active.some(r=>r?.action==='exchange'&&r.name===rule.name))
    return false;
  }
  return exchange(slot,rule,ticket.sourceProof?
   {sourceProof:ticket.sourceProof}:null);
 }
 function availabilityFingerprint(step){
  return JSON.stringify([step?.item,step?.level,step?.kind,
   p.c.items.map(i=>i?[i.name,i.level??0,i.q??1,i.stat_type??'']:null),
   (bot.bank?.catalogStock?.()??[]).map(r=>[r.item?.name,r.item?.level??0,r.item?.q??1,r.item?.stat_type??'']).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))),p.c.gold,
   cfg.production.enabled,cfg.production.autoHelpers,cfg.production.minChance]);
 }
 function planGoals(){if(Number.isInteger(bot.decisionEpoch)&&Date.now()-planAt<cfg.general.planningTickMs)return;planAt=Date.now();
  routeCache.clear();plan=[];goal=null;planningReason=null;if(!cfg.production.enabled||bot.me.role!=='merchant')return;
  const readyStock=[...p.c.items.filter(i=>i&&e.safe(i)&&e.explicit(i)?.action!=='keep'),
   ...(bot.bank?.catalogStock?.()??[]).map(r=>r.item).filter(i=>i&&e.safe(i)&&e.explicit(i)?.action!=='keep')];
  const fastGear=g=>gearChainReady(g,readyStock,p.G.items?.[g.item]);
  const ranked=goals().map(g=>{let score=Infinity;try{const step={kind:'farm',item:g.item,level:g.level,quantity:Math.max(1,g.quantity-qty(g.item,g.level,g))};routeScore(step);score=Math.min(...(routeCache.get(JSON.stringify([step.item,step.level,step.quantity,step.sources]))??[]).map(r=>r.hours));}catch{}return {...g,utilityPerHour:(g.utility??p.G.items[g.item]?.g??1)/Math.max(.01,Number.isFinite(score)?score:1000000)};}).sort((a,b)=>{const held=g=>heldGoal===goalKey(g)&&Date.now()-heldAt<Math.max(cfg.merchant.taskHoldMs??30000,45000);
    const effective=g=>(g.priority??0)+(fastGear(g)?65:0);
    // A five-minute remote-exchange hold must not starve ready local gear.
    return effective(b)-effective(a)||Number(held(b))-Number(held(a))||
      (bot.progression?.goalPriority(b)??0)-(bot.progression?.goalPriority(a)??0)||
      b.utilityPerHour-a.utilityPerHour;});
  const ordered=prioritizeAdmittedProductionGoal(ranked,{
   admittedKey:admittedGoalKey,admittedAt,now:Date.now(),
   keyOf:goalKey,scoreOf:g=>(g.priority??0)+(fastGear(g)?65:0),
   maxHoldMs:45000,maxPriorityDeficit:15
  });
  for(const g of ordered){
   const wait=waiting.get(goalKey(g));
   // New visible offers supersede earlier no-offer waits without waiting for
   // unrelated inventory or gold fingerprints to change.
   if(wait?.until>Date.now()&&wait.fingerprint===availabilityFingerprint(wait.step)&&
      !(wait.step?.kind==='marketBuy'&&bot.market?.hasVisibleBuyOffer?.({name:wait.step.item,level:wait.step.level})))continue;
   if(wait)waiting.delete(goalKey(g));
   const delivered=g.recipient?(deliveries[goalKey(g)]?.quantity??0):0,needed=Math.max(0,g.quantity-delivered);
   if(!needed)continue;// Items already in stock are delivered by logistics.poll. A remote recipient
   // must not monopolize the production slot while out of transfer range.
   if(!needsProductionStock(qty(g.item,g.level,g),needed))continue;
   const holder=g.sourceOwner&&g.sourceOwner!==me.name?bot.transport.fresh(g.sourceOwner):null;if(holder?.running&&holder.realm===p.realm()&&holder.stock?.some(i=>i.name===g.item&&(i.level??0)===(g.sourceLevel??g.level))&&qty(g.item,g.sourceLevel??g.level,g)<1){planningReason='Vorhandenes Gear von '+g.sourceOwner+' anfordern';continue;}
   try{goal=g;
    const permit=(name,level,kind)=>{if(['craft','exchange','upgrade','compound'].includes(kind)&&!cfg.production[kind])return false;const item={name,level},phase=phaseOf(kind),r=e.explicit(item,phase);return r?r.action===kind&&e.remaining(r)&&(!['upgrade','compound'].includes(kind)||r.targetLevel>level):!!cfg.production.autonomy;};
    // Historical profiles retain their explicit-rule planner and fixed ordering.
    const options=cfg.production.autonomy?{permit,recipeFor:(name,level)=>e.explicit({name,level},'production')?.recipe??'',helpers:(name,level,kind)=>{
     const r=e.explicit({name,level},'production'),grade=p.call('item_grade',{name,level}),scroll=r?.scroll||((kind==='compound'?'cscroll':'scroll')+grade);
     return [{item:scroll,quantity:1},...(r?.offering?[{item:r.offering,quantity:1}]:[])];
    },score:step=>routeScore(step,new Set(),0)}:{};
    plan=planProduction({G:p.G,item:g.item,level:g.level,quantity:needed,stock:qty,bank:(name,level,wanted)=>bot.bank.stock?.(name,level,wanted)??bot.bank.packs().reduce((n,[,items])=>n+items.reduce((s,i)=>s+(i?.name===name&&(i.level??0)===level&&!i.l&&!i.b&&e.explicit(i)?.action!=='keep'?(i.q??1):0),0),0),canBuy:name=>!!e.npcFor(name),allowed:cfg.production.acquireBy,maxDepth:cfg.production.maxChainDepth,confidence:cfg.production.farmConfidence,state:p.root?.S??p.parent?.S??{},...options});
   }catch(err){plan=[];goal=null;planningReason=err.message;e.note(err.message);continue;}
   const marketWait=deferNoOfferMarketPlan(plan[0],bot.market);
   if(marketWait>0){
    const key=goalKey(g),until=Date.now()+marketWait,prev=marketDeferred.get(key);
    if(!prev||prev.until<=Date.now())bot.event?.('production.marketDeferred',{
     goal:g.name,item:plan[0].item,level:plan[0].level??0,
     reason:'NO_LIVE_MARKET_OFFER',retryMs:marketWait});
    if(marketDeferred.size>=64&&!marketDeferred.has(key))marketDeferred.delete(marketDeferred.keys().next().value);
    marketDeferred.set(key,{goal:g.name,item:plan[0].item,level:plan[0].level??0,until});
    goal=null;plan=[];planningReason='Marktangebot für '+g.item+' ausstehend; andere Produktion prüfen';
    continue;
   }
   marketDeferred.delete(goalKey(g));
   planningReason=null;const objective=knowledgeFingerprint(goalKey(g));const previous=intent?.objective;if(previous&&previous!==objective)bot.event('production.cancel',{objective:previous,reason:'Bedarf/Ziel geändert'});persistIntent({objective,goal:goalKey(g),item:g.item,level:g.level,quantity:needed,recipient:g.recipient,realm:p.realm(),phase:'planned',at:Date.now(),definition:knowledgeFingerprint([p.G.items[g.item],p.G.craft]),steps:plan.slice(0,32),reservations:plan.reservations??[]});break;
  }
  if(!goal&&intent&&!bot.journal){const pending=goals().some(g=>g.recipient?(deliveries[goalKey(g)]?.quantity??0)<g.quantity:qty(g.item,g.level,g)<g.quantity);if(pending)persistIntent({...intent,phase:'waiting'});else{bot.event('production.intent.complete',{objective:intent.objective,reason:'Bedarf erfüllt oder ausdrücklich entfernt'});persistIntent(null);}}
  if(!goal||plan[0]?.kind!=='farm')materials=[];else updateMaterials();
  if(materials.length){
    const request=materials[0];
    for(const name of bot.farmers){
      const h=bot.transport.fresh(name),ack=h?.materialAck;
      if(!h?.running||h.rip||h.realm!==p.realm()||ack?.objective!==request.objective||
         ack.item!==request.item||ack.monster!==request.monster)continue;
      const key=request.objective+':'+name+':'+h.session;
      if(!farmOrderReceipts.has(key)){
        if(farmOrderReceipts.size>=128)farmOrderReceipts.clear();
        farmOrderReceipts.add(key);
        bot.event('farmOrder.acknowledged',{farmer:name,objective:request.objective,
          monster:request.monster,item:request.item,session:h.session});
      }
    }
  }
  if(goal&&!intentBlocked){if(heldGoal!==goalKey(goal)){heldGoal=goalKey(goal);heldAt=Date.now();}const objective=knowledgeFingerprint(goalKey(goal)),participants=bot.farmers.map(name=>{const h=bot.transport.fresh(name);return {name,session:h?.session??null,held:h?.materialProgress?.find(x=>x.objective===objective)?.quantity??0};});persistIntent({...intent,objective,goal:goalKey(goal),item:goal.item,level:goal.level,quantity:goal.quantity,recipient:goal.recipient,realm:p.realm(),phase:materials.length?'gathering':plan.length?'planned':'delivery',participants,sources:materials.slice(0,1).map(r=>({monster:r.monster,item:r.item,quantity:r.quantity,sourceFingerprint:r.sourceFingerprint}))});}

 }
 function routeScore(step){
  const cacheKey=JSON.stringify([step.item,step.level,step.quantity,step.sources]);if(routeCache.has(cacheKey))return routeCache.get(cacheKey).find(r=>r.kind===step.kind)?.score??Infinity;const key=step.item+':'+step.level,permit=(name,level,kind)=>{if(kind==='exchange'&&step.sources?.length===1&&name!==step.sources[0][0])return false;if(['craft','exchange','upgrade','compound'].includes(kind)&&!cfg.production[kind])return false;const r=e.explicit({name,level},phaseOf(kind));return !r||r.action===kind&&e.remaining(r)&&(!['upgrade','compound'].includes(kind)||r.targetLevel>level);};
  const capped=(name,level,price)=>{const r=e.explicit({name,level},'acquisition');return Number.isFinite(price)&&price>0&&price<=(r?.maxPrice??(cfg.merchant.budgetMode==='account-loss'?Number.MAX_SAFE_INTEGER:cfg.production.helperMaxPrice))?price:Infinity;};
  const rows=estimateRoutes({G:p.G,item:step.item,level:step.level,quantity:step.quantity,stock:(name,level)=>name+':'+level===key?0:qty(name,level),bank:(name,level,wanted)=>name+':'+level===key?0:bot.bank.stock?.(name,level,wanted)??bot.bank.packs().reduce((n,[,items])=>n+items.reduce((v,i)=>v+(i?.name===name&&(i.level??0)===level&&e.safe(i)&&e.explicit(i)?.action!=='keep'?(i.q??1):0),0),0),allowed:cfg.production.acquireBy,permit,
   npcPrice:name=>e.npcFor(name)?capped(name,0,p.G.items[name]?.g):Infinity,marketPrice:(name,level)=>capped(name,level,bot.market.quote?.({name,level})??e.explicit({name,level},'acquisition')?.maxPrice??cfg.production.helperMaxPrice),
   farmHours:(name,q)=>materialSources(p.G,name,q,allowedMonsters(),cfg.production.maxFarmHours,bot.observations?.rate,{state:p.root?.S??p.parent?.S,confidence:cfg.production.farmConfidence,questAllowed:q=>!!p.c.s?.[q]})[0]?.selectedHours??Infinity,
   travelHours:(kind,name)=>{const d=kind==='buy'?e.npcFor(name):kind==='craft'?e.destination('craftsman'):kind==='retrieve'?{map:'bank',x:0,y:-100}:kind==='exchange'?(exchangeSource(p.G,name,p.root?.S??p.parent?.S??{}).destination??e.destination('exchange')):e.destination(kind==='marketBuy'?'citizen22':'newupgrade');return (bot.observations?.travelMs(d)??60000)/3600000;},
   helpers:(name,level,kind)=>{const r=e.explicit({name,level},'production');return [{item:r?.scroll||((kind==='compound'?'cscroll':'scroll')+p.call('item_grade',{name,level})),quantity:1},...(r?.offering?[{item:r.offering,quantity:1}]:[])];},
   chance:(name,level,kind)=>bot.intelligence?(bot.intelligence.chance(name,level,kind)??0):Math.max(cfg.production.minChance,e.explicit({name,level},'production')?.minChance??0),recipeFor:(name,level)=>e.explicit({name,level},'production')?.recipe??'',confidence:cfg.production.farmConfidence??'mean',strategy:cfg.production.strategy,goldPerHour:cfg.production.goldPerHour,maxDepth:cfg.production.maxChainDepth,state:p.root?.S??p.parent?.S??{}});
  routeCache.set(cacheKey,rows);return rows.find(r=>r.kind===step.kind)?.score??Infinity;
 }
 const allowedMonsters=()=>bot.teamPlan?bot.teamPlan.candidates().filter(id=>bot.strategy.safeTarget(id,undefined,true,true)):[...new Set(cfg.characters.filter(c=>c.enabled&&c.role==='farmer'&&(!bot.farmers||bot.farmers.includes(c.name))).flatMap(c=>c.farmTargets.length?c.farmTargets:cfg.farming.targets))];
 // A fully verified local exchange must not be displaced by an unrelated
 // bank catalog refresh. Normal exchange() remains the sole value authority.
 function locallyExecutableExchange(){
  const step=plan[0];
  if(step?.kind!=='exchange'||!goal||!cfg.production.exchange)return false;
  const item={name:step.item,level:step.level,
   ...(step.item===goal.item?goal.variant:{})};
  const slot=p.c.items.findIndex(i=>i&&identity(i)===identity(item));
  if(slot<0)return false;
  const live=p.c.items[slot],rule=e.rules(item,'production'),
   quantity=p.G.items?.[live.name]?.e;
  if(!e.safe(live)||rule?.action!=='exchange'||!e.remaining(rule)||
     !Number.isSafeInteger(quantity)||quantity<1||
     e.spare(slot,rule)<quantity||
     e.count(live)-quantity<(rule.keep??0)+(rule.teamReserve??0)+
      reserveOther(live.name,live.level??0)||
     bot.storage?.exchangeAllowed?.(slot,quantity)===false||
     !capacity([{slot,quantity}]))return false;
  if(rule.recipe&&(!exchangeDrops(p.G,p.G.drops?.[live.name])
     .some(x=>x.item===rule.recipe)||
     qty(rule.recipe,0)>=Math.min(rule.targetCount,rule.maxCount)))
   return false;
  const source=exchangeSource(p.G,live.name,p.root?.S??p.parent?.S??{});
  if(!source.ready)return false;
  if(step.sourceProof){
   const proof=JSON.stringify({quest:source.quest,npc:source.npc,
    destination:source.destination,event:source.event});
   if(proof!==JSON.stringify(step.sourceProof))return false;
  }
  return true;
 }
 function tick(){
  if(intentBlocked||!goal||!plan.length)return false;
  if(cfg.production.autonomy&&cfg.merchant.bank&&
     cfg.production.acquireBy.includes('bank')&&!bot.bank.observed&&
     !locallyExecutableExchange()){
   bot.bank.inspect();return true;
  }
  const step=plan[0],item={name:step.item,level:step.level,...(step.item===goal.item?goal.variant:{})};
  const r=e.rules(item,['buy','retrieve','farm','marketBuy'].includes(step.kind)?'acquisition':'production');
  if(!r||r.action!==step.kind){const reason='Produktionskette benötigt passende '+step.kind+'-Regel für '+step.item;e.note(reason);bot.event?.('production.blocked',{goal:goal.name,item:step.item,step:step.kind,reason});return false;}
  if(!e.remaining(r))return false;
  const attempt=fn=>{bot.reason='Produktionsschritt '+step.kind+' / '+step.item+': Voraussetzungen prüfen';const accepted=fn();
   // Market discovery journeys are not confirmed purchases. Preserve admission
   // hysteresis only for an actual market transaction or another admitted action.
   if(goal&&admittedProductionAction(step,accepted,{journal:!!bot.journal,pending:exec.pending.size>0})){
    admittedGoalKey=goalKey(goal);admittedAt=Date.now();
   }
   if(cfg.general.testLogging!==undefined&&!accepted&&!bot.movement.order&&!bot.journal&&!exec.pending.size){const entry={goal:goal.name,item:step.item,kind:step.kind,
   step:{item:step.item,level:step.level,kind:step.kind},
   fingerprint:availabilityFingerprint(step),
   reservations:structuredClone(plan.reservations??[]),
   reason:bot.reason||'Voraussetzungen/Angebot fehlen',until:Date.now()+120000};waiting.set(goalKey(goal),entry);if(waiting.size>64)waiting.delete(waiting.keys().next().value);bot.event('production.wait',{
    goal:entry.goal,item:entry.item,kind:entry.kind,
    fingerprint:knowledgeFingerprint(entry.fingerprint),
    reservationCount:entry.reservations.length,reason:entry.reason,until:entry.until
   });}return accepted;};
  if(step.kind==='buy')return attempt(()=>e.npcBuy(item,{...r,goldBudget:Math.min(r.goldBudget,goal.budget)},step.quantity));
  if(step.kind==='retrieve')return attempt(()=>bot.bank.retrieve(item,r,step.quantity));
  if(step.kind==='craft')return attempt(()=>craft(step.item,r));if(step.kind==='marketBuy')return attempt(()=>bot.market.buy(item,r));if(step.kind==='exchange'){
   const slot=firstEligibleProductionSlot(p.c.items,item,i=>e.safe(i)&&
    e.explicit(i,'inventory')?.action!=='keep'&&e.explicit(i,'production')?.action!=='keep');
   if(slot<0)noteDeferred(step.kind,step.item,'no-safe-matching-inventory-slot');
   return attempt(()=>slot>=0&&exchange(slot,r,step));
  }
  if(['upgrade','compound'].includes(step.kind)){
   const slot=firstEligibleProductionSlot(p.c.items,item,i=>e.safe(i)&&
    e.explicit(i,'inventory')?.action!=='keep'&&e.explicit(i,'production')?.action!=='keep');
   if(slot<0)noteDeferred(step.kind,step.item,'no-safe-matching-inventory-slot');
   return attempt(()=>slot>=0&&mutate(slot,r));
  }
  if(step.kind==='farm'){
   updateMaterials();
   e.note(materials.length?'Materialauftrag: '+step.item+' bei '+materials[0].monster:'Kein erlaubter Farmweg im Zeitbudget: '+step.item);
  }return false;
 }
 function updateMaterials(){if(!goal||plan[0]?.kind!=='farm'){materials=[];return;}const step=plan[0];materials=materialSources(p.G,step.item,step.quantity,allowedMonsters(),cfg.production.maxFarmHours,bot.observations?.rate,{state:p.root?.S??p.parent?.S,confidence:cfg.production.farmConfidence,questAllowed:q=>!!p.c.s?.[q]}).slice(0,5).map(r=>({...r,objective:intent?.objective??knowledgeFingerprint(goalKey(goal)),priority:goal.priority??0,utilityPerHour:goal.utilityPerHour??0,expires:Date.now()+cfg.general.messageTtlMs*2,recipient:goal.recipient,sourceFingerprint:knowledgeFingerprint([p.G.monsters[r.monster],p.G.drops?.monsters?.[r.monster]])}));}
 function reservedQuantity(i,recipient=''){
  // Moving loot to the sole production hub preserves its purpose. Retain
  // completed gear promised to this farmer, but forward recipe/upgrade inputs
  // and other farmers' allocations instead of freezing them on every carrier.
  if(me.role==='farmer'&&recipient===cfg.party.merchant){
   return goals().filter(g=>g.gearSlot&&g.character===me.name||g.recipient===me.name)
    .filter(g=>g.item===i.name&&g.level===(i.level??0)&&variantMatches(i,g))
    .reduce((n,g)=>n+Math.max(0,g.quantity-(deliveries[goalKey(g)]?.quantity??0)),0);
  }
  // This is the GROSS physical demand. purposeReservations consumes observed
   // stock in recursion; subtracting it once more would release team gear.
   if(cfg.production.purposeAllocation)return demand(null,recipient,i).quantity(i);
  let n=0;for(const g of goals())if(!g.recipient&&(bot.me.role==='merchant'||g.gearSlot&&g.character===bot.me.name)&&g.item===i.name&&g.level===(i.level??0))n=Math.max(n,g.quantity);
  const allocated=plan.reservations?.find(r=>r.item===i.name&&r.level===(i.level??0));n=goal&&(goal.item!==i.name||goal.level!==(i.level??0))?n+(allocated?.quantity??0):Math.max(n,allocated?.quantity??0);
  n+=Math.max(0,...[...waiting.values()].filter(w=>w.until>Date.now()).flatMap(w=>w.reservations.filter(r=>r.item===i.name&&r.level===(i.level??0)).map(r=>r.quantity)));
  if(goal?.recipient&&goal.recipient!==recipient&&goal.item===i.name&&goal.level===(i.level??0))n=Math.max(n,goal.quantity-(deliveries[goalKey(goal)]?.quantity??0));return Math.max(0,n);
 }
 function requestHelper(item,quantity=1,guard=null){
  if(me.role!=='merchant'||!cfg.production.enabled||!cfg.production.autonomy||
    !cfg.production.autoHelpers||!cfg.production.acquireBy?.includes('npc')||
    !/^(?:(?:scroll|cscroll)[0-3]|offering[0-3]?)$/.test(item)||
    !['uscroll','cscroll','offering'].includes(p.G.items?.[item]?.type)||
    !Number.isSafeInteger(quantity)||quantity<1||quantity>3)return false;
  const now=Date.now();for(const [name,r] of helperRequests)
   if(r.until<=now)helperRequests.delete(name);
  if(!helperRequests.has(item)&&helperRequests.size>=8)return false;
  const old=helperRequests.get(item);
  helperRequests.set(item,{quantity:Math.max(quantity,old?.quantity??0),
   until:now+300000,next:old?.next??0,guard});return true;
 }
 function helperSupply(){
  if(me.role!=='merchant'||!bot.running||bot.journal||bot.inventoryBlocked||
    bot.logistics?.reserved||bot.free()<1||
    !cfg.production.enabled||!cfg.production.autonomy||!cfg.production.autoHelpers)return false;
  const now=Date.now();
  for(const [name,r] of helperRequests){
   if(r.until<=now||r.guard&&!r.guard()||e.count({name,level:0})>=r.quantity){
    helperRequests.delete(name);continue;
   }
   if(r.next>now)continue;
   const price=p.G.items?.[name]?.g;
   if(!e.npcFor(name)||!Number.isSafeInteger(price)||price<=0||
      cfg.merchant.budgetMode!=='account-loss'&&price>cfg.production.helperMaxPrice){r.next=now+60000;continue;}
   const isOffering=p.G.items?.[name]?.type==='offering';
   const rule={enabled:true,name:'Autonomer '+(isOffering?'Offering':'Scroll')+'-Helper '+name,item:name,
    action:'buy',batch:1,maxCount:isOffering?1:3,maxPrice:cfg.merchant.budgetMode==='account-loss'?Number.MAX_SAFE_INTEGER:cfg.production.helperMaxPrice,
    goldBudget:cfg.production.helperMaxPrice,lossBudget:0,keep:0,teamReserve:0};
   r.next=now+30000;
   const accepted=e.npcBuy({name,level:0},rule,1,
     ()=>cfg.production.enabled&&cfg.production.autoHelpers&&
       r.until>Date.now()&&(!r.guard||r.guard())&&e.count({name,level:0})<r.quantity);
   if(accepted||bot.movement.order?.owner==='economy'||bot.journal)return true;
  }
  return false;
 }
 function canRecordDelivery(item,to){const matching=goals().filter(g=>g.recipient===to&&g.item===item.name&&g.level===(item.level??0));if(Object.keys(deliveries).length+matching.filter(g=>!Object.hasOwn(deliveries,goalKey(g))).length<=1024)return true;e.note('Ziellieferungsjournal voll; abgeschlossene alte Ziele manuell prüfen');return false;}
 return {invalidate(){planAt=0;goalsCache=null;rulesCache=null;},mutate,craft,exchange,captureExchangeRoute,resumeExchangeRoute,planGoals,progress(){const h=bot.transport.fresh(cfg.party.merchant);return (h?.materials??[]).filter(r=>r.objective&&typeof r.item==='string').map(r=>({objective:r.objective,item:r.item,quantity:qtyRaw({name:r.item,level:0})})).slice(0,5);},tick,recordDelivery,canRecordDelivery,derivedRule,effectiveRules,matchesOutput,reservedQuantity,requestHelper,helperSupply,outputCount,owns:item=>!!goal&&(item===goal.item||plan.some(s=>s.item===item)||(plan.reservations??[]).some(s=>s.item===item)),get activeGoal(){return goal;},materials:()=>{if(cfg.general.testLogging===undefined)return materials;const first=materials[0];if(!first)return [];const plan=planMaterialQuotas(first,bot.farmers,
  name=>bot.transport.fresh(name),p.realm(),{freeReserve:cfg.farming.freeSlots});
 return [{...first,...plan}];},
 reserved:i=>reservedQuantity(i)>0,
 farmTargets(){const merchant=bot.transport.fresh(cfg.party.merchant);if(!merchant?.running||!Array.isArray(merchant.materials))return null;const allowed=bot.teamPlan?.candidates()??(bot.me.farmTargets.length?bot.me.farmTargets:cfg.farming.targets);for(const request of merchant.materials){if(request.expires&&request.expires<Date.now()||!allowed.includes(request.monster)||!Number.isFinite(request.quantity)||request.quantity<=0)continue;const r=e.explicit({name:request.item,level:0},'acquisition');if((r?.action==='farm'||!r&&cfg.production.autonomy)&&qty(request.item,0)<Math.min(r?.targetCount??request.quantity,materialQuotaCap(request,bot.me.name)))return [request.monster];}return null;},
 status:()=>({intent:intent?{objective:intent.objective,phase:intent.phase,recipient:intent.recipient}:null,intentBlocked,autonomy:!!cfg.production.autonomy,marketDeferred:[...marketDeferred.values()].filter(x=>x.until>Date.now()).slice(0,20),waiting:[...waiting.values()],goal:goal?.name??null,blocked:planningReason,toolGoals:goals().filter(g=>g.name.startsWith('Werkzeug: ')).map(g=>({item:g.item,priority:g.priority,available:qtyRaw({name:g.item,level:0})+(p.c.slots?.mainhand?.name===g.item?1:0)})),materialRequests:materials.slice(0,5).map(x=>({item:x.item,monster:x.monster,quantity:x.quantity})),farmOrderReceipts:materials.length?bot.farmers.filter(name=>{const h=bot.transport.fresh(name);return h?.materialAck?.objective===materials[0].objective&&h.materialAck.item===materials[0].item&&h.materialAck.monster===materials[0].monster;}):[],steps:plan.slice(0,20),reservations:(plan.reservations??[]).slice(0,20),deliveries:goals().filter(g=>g.recipient).slice(0,20).map(g=>({goal:g.name,slot:g.gearSlot,quantity:deliveries[goalKey(g)]?.quantity??0,target:g.quantity}))}),close(){preview=null;plan=[];goal=null;materials=[];planningReason=null;}};
}
