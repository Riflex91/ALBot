import {estimateRoutes} from './costs.mjs';
import {materialSources,materialDrops} from './materials.mjs';
import {identity,fingerprint,variantCount} from '../core/policy.mjs';
import {planProduction} from './planner.mjs';
import {findRecipe,recipeIngredients} from './recipes.mjs';
import {ITEM_RULE} from '../../editor/lib/schema.mjs';
import {defaultsFor,phaseOf} from '../../editor/lib/contract.mjs';
export function createProduction(bot){
 const {p,cfg,exec}=bot,e=bot.economy;let preview=null,plan=[],goal=null,materials=[],planningReason=null;
 const waiting=new Map();
 const deliveryKey='albot:production:'+bot.me.name+':deliveries',goalKey=g=>JSON.stringify([g.name,g.item,g.level,g.quantity,g.recipient,...(g.gearSlot?[g.gearSlot]:[])]);
 let deliveries=p.read(deliveryKey)??{};if(!deliveries||typeof deliveries!=='object'||Array.isArray(deliveries))deliveries={};
 const goals=()=>{const tools=cfg.production.autonomy&&bot.me.role==='merchant'?['fishing','mining'].filter(k=>cfg.merchant[k]).map(k=>({name:'Werkzeug: '+k,enabled:true,item:k==='fishing'?'rod':'pickaxe',level:0,quantity:1,recipient:'',budget:cfg.merchant.toolBudget,priority:-1000})).filter(g=>p.c.slots?.mainhand?.name!==g.item):[];return [...cfg.production.goals,...(bot.gear?.goals()??[]),...tools].filter(g=>g.enabled).sort((a,b)=>b.priority-a.priority);};
 function recordDelivery(j){
  if(j.kind!=='send'||!j.id||!j.to||typeof j.item!=='object')return true;if(Object.values(deliveries).some(x=>x.last?.includes(j.id)))return true;const next=structuredClone(deliveries);let changed=false,remaining=j.quantity;
  for(const g of goals().filter(g=>g.recipient===j.to&&g.item===j.item.name&&g.level===j.item.level)){
   const key=goalKey(g),old=next[key]??{quantity:0,last:[]};if(!Number.isFinite(old.quantity)||!Array.isArray(old.last))return false;const take=Math.min(remaining,Math.max(0,g.quantity-old.quantity));if(take<=0)continue;
   next[key]={quantity:old.quantity+take,last:[...old.last,j.id].slice(-32)};changed=true;remaining-=take;if(!remaining)break;
  }
  if(changed){if(Object.keys(next).length>1024)return false;if(!p.write(deliveryKey,next))return false;deliveries=next;}return true;
 }
 function matchesOutput(i){const r=e.explicit(i,'production'),recipe=r?.recipe&&r.action==='craft'?findRecipe(p.G,i.name,r.recipe)?.recipe:null;return !recipe?.output?.data||JSON.stringify(i.data)===JSON.stringify(recipe.output.data);}
 function reserveOther(name,level,g=goal){const pending=Math.max(0,...[...waiting.entries()].filter(([key,w])=>key!==goalKey(g??{})&&w.until>Date.now()).flatMap(([,w])=>w.reservations.filter(r=>r.item===name&&r.level===level).map(r=>r.quantity)));if(g?.item===name&&g.level===level)return pending;return pending+goals().filter(x=>!x.recipient&&(bot.me.role==='merchant'||x.gearSlot&&x.character===bot.me.name)&&x.item===name&&x.level===level).reduce((n,x)=>Math.max(n,x.quantity),0);}
 const qty=(name,level,g=goal)=>{let total=0,reserve=0;const groups=new Map();for(const i of p.c.items){const r=i&&e.explicit(i);if(i?.name===name&&(i.level??0)===level&&matchesOutput(i)&&r?.action!=='keep'&&!i.l&&!i.b){total+=i.q??1;groups.set(identity(i),(groups.get(identity(i))??0)+(i.q??1));reserve=Math.max(reserve,(r?.keep??0)+(r?.teamReserve??0));}}if(p.G.items[name]?.compound&&groups.size)total=Math.max(...groups.values());return Math.max(0,total-reserve-reserveOther(name,level,g));};
 function generated(action,item,quantity,g=goal){return {...defaultsFor(ITEM_RULE),name:'Automatisch: '+(g?.name??'Material')+' / '+action+' / '+item.name,role:bot.me.role,character:bot.me.name,item:item.name,minLevel:item.level??0,maxLevel:item.level??0,action,priority:g?.priority??0,targetCount:quantity,maxCount:quantity,batch:Math.max(1,quantity),maxPrice:cfg.production.helperMaxPrice??100000,goldBudget:g?.budget??0,lossBudget:cfg.production.lossBudget,minChance:cfg.production.minChance,targetLevel:(item.level??0)+1};}
 function effectiveRules(){
  if(!cfg.production.autonomy||!cfg.production.enabled)return cfg.items;
  const extra=[],assigned=new Set();for(const g of goals()){
   const key=g.item+':'+g.level;if(g.recipient&&g.recipient!==bot.me.name&&(deliveries[goalKey(g)]?.quantity??0)<g.quantity&&!assigned.has(key)){assigned.add(key);extra.push({...generated('send',{name:g.item,level:g.level},g.quantity-(deliveries[goalKey(g)]?.quantity??0),g),recipient:g.recipient});}
   if(g.gearSlot&&(!g.recipient||g.recipient===bot.me.name))extra.push({...generated('equip',{name:g.item,level:g.level},g.quantity,g),slot:g.gearSlot});
  }
  // Receiving characters derive only their explicitly configured gear demand.
  for(const g of cfg.production.gearTargets??[])if(g.enabled&&g.character===bot.me.name&&!(p.c.slots?.[g.slot]?.name===g.item&&(p.c.slots[g.slot].level??0)>=g.level))extra.push({...generated('equip',{name:g.item,level:g.level},1,g),slot:g.slot});
  for(const g of cfg.production.goals)if(g.enabled&&g.recipient===bot.me.name)extra.push(generated('keep',{name:g.item,level:g.level},g.quantity,g));
  if(bot.me.role==='merchant'){for(const step of plan)if(step.kind==='farm')extra.push(generated('keep',{name:step.item,level:step.level},step.quantity+qtyRaw({name:step.item,level:step.level})));}
  else {const merchant=bot.transport.fresh(cfg.party.merchant);for(const request of merchant?.materials??[])if(Number.isSafeInteger(request.quantity)&&request.quantity>0&&request.quantity<=1000000)extra.push({...generated('send',{name:request.item,level:0},request.quantity),recipient:cfg.party.merchant});}
  return [...cfg.items,...extra];
 }
 function derivedRule(item,phase){
  if(!cfg.production.autonomy||!cfg.production.enabled)return null;
  if(phase==='inventory')return effectiveRules().slice(cfg.items.length).find(r=>r.item===item.name&&r.minLevel===(item.level??0))??null;
  const step=plan.find(s=>s.item===item.name&&s.level===(item.level??0)&&phaseOf(s.kind)===phase);if(!step||!goal)return null;
  return {...generated(step.kind,item,Math.max(1,qtyRaw(item)+step.quantity)),targetLevel:step.targetLevel??(item.level??0)+1,recipe:step.recipe??''};
 }
 const qtyRaw=item=>p.c.items.reduce((n,i)=>n+(i?.name===item.name&&(i.level??0)===(item.level??0)&&!i.l&&!i.b?(i.q??1):0),0);
 function mergeFor(item,required,r){
  const slots=p.c.items.map((i,n)=>({i,n})).filter(({i})=>i&&identity(i)===identity(item)&&e.safe(i)&&e.explicit(i)?.action!=='keep');
  const pair=slots.flatMap(a=>slots.filter(b=>b.n!==a.n&&(a.i.q??1)+(b.i.q??1)<=(p.G.items[item.name]?.s??1)).map(b=>[a,b])).sort((a,b)=>(b[0].i.q+b[1].i.q)-(a[0].i.q+a[1].i.q))[0];
  if(!pair)return false;const [a,b]=pair,sum=(a.i.q??1)+(b.i.q??1),before=e.count(item);
  return e.perform('inventory.merge',{slots:[a.n,b.n],rule:r,call:()=>p.call('swap',a.n,b.n),observe:()=>e.count(item)===before&&((p.c.items[a.n]?.q===sum&&!p.c.items[b.n])||(p.c.items[b.n]?.q===sum&&!p.c.items[a.n])),details:{item:item.name,quantity:sum,required}});
 }
 function capacity(consumed=[],output=null){
  if(bot.free()>cfg.merchant.minFreeSlots||consumed.some(({slot,quantity})=>(p.c.items[slot]?.q??1)===quantity))return true;
  if(output&&p.c.items.some(i=>i&&identity(i)===identity(output)&&(i.q??1)<(p.G.items[i.name]?.s??1)))return true;
  e.note('Arbeitsplätze fehlen: freigegebene Bank-/Verkaufsregeln oder freie Slots erforderlich');return false;
 }
 function outputCount(name,r){const data=findRecipe(p.G,name,r.recipe)?.recipe.output?.data;return p.c.items.reduce((n,i)=>n+(i?.name===name&&(i.level??0)===0&&(data===undefined||JSON.stringify(i.data)===JSON.stringify(data))?(i.q??1):0),0);}
 function mutate(slot,r){
  const i={...p.c.items[slot]},kind=r.action;if(!e.remaining(r)||!cfg.production.enabled||!cfg.production[kind]||!e.safe(i)||!p.G.items[i.name]?.[kind]||(i.level??0)>=r.targetLevel)return false;
  const inputs=[slot];if(kind==='compound')for(let n=0;n<p.c.items.length&&inputs.length<3;n++)if(n!==slot&&e.safe(p.c.items[n])&&identity(i)===identity(p.c.items[n]))inputs.push(n);
  if(kind==='compound'&&inputs.length!==3)return false;
  if(e.count(i)-inputs.length<r.keep+r.teamReserve+reserveOther(i.name,i.level??0))return false;
  const scrollName=r.scroll||((kind==='compound'?'cscroll':'scroll')+p.call('item_grade',i));
  const usable=x=>{const rule=x&&e.rules(x);return e.safe(x)&&rule?.action!=='keep'&&e.count(x)>(rule?rule.keep+rule.teamReserve:0)+reserveOther(x.name,x.level??0);};
  const scroll=p.c.items.findIndex(x=>x?.name===scrollName&&usable(x));const offering=r.offering?p.c.items.findIndex(x=>x?.name===r.offering&&usable(x)):null;
  if(scroll<0||(r.offering&&offering<0)){e.note('Produktion benötigt '+scrollName+(r.offering?' / '+r.offering:''));return false;}
  const slots=[...inputs,scroll,...(offering===null?[]:[offering])];if(new Set(slots).size!==slots.length)return false;
  const d=e.destination('newupgrade')??e.destination('upgrade');if(!e.travel(d,kind))return false;
  const key=kind+':'+slots.map(n=>fingerprint(p.c.items[n])).join('|');
  const args=kind==='compound'?[...inputs,scroll,offering]:[slot,scroll,offering];
  if(preview?.key!==key||Date.now()-preview.time>5000){
   if(exec.busy('economy'))return false;preview={key,time:Date.now(),chance:null,cost:null};const token=preview;
   const accepted=exec.run('production.preview',['economy'],()=>bot.running,()=>Promise.resolve(p.call(kind,...args,true)).then(result=>{if(preview!==token||!bot.running)return;const raw=typeof result==='number'?result:result?.chance??result?.success_chance;token.chance=Number(raw);token.cost=result?.cost??0;}),{delay:1000});if(!accepted)preview=null;return accepted;
  }
  const chance=preview.chance,cost=preview.cost;
  if(!Number.isFinite(chance)||chance>1||chance<Math.max(r.minChance,cfg.production.minChance)||!Number.isFinite(cost)||cost<0){e.note('Upgrade/Compound: Chance oder Kosten nicht freigegeben');return false;}
  const loss=slots.reduce((sum,n)=>sum+e.value(p.c.items[n]),0),before=e.count(i),next={...i,level:(i.level??0)+1},after=e.count(next),scrollBefore=p.c.items[scroll].q??1;
  return e.perform(kind,{slots,cost,loss,rule:r,guard:()=>e.at(d)&&preview?.key===key&&Date.now()-preview.time<5000,
   call:()=>p.call(kind,...args),observe:()=>{
    const consumed=p.c.items[scroll]?.name!==scrollName||(p.c.items[scroll]?.q??1)<scrollBefore;
    return consumed&&!p.c.q?.[kind]&&(e.count(next)>after||e.count(i)<=before-inputs.length);
   },details:{item:i.name,before,quantity:inputs.length,targetLevel:next.level},timeout:45000});
 }
 function craft(name,r){
  const found=findRecipe(p.G,name,r.recipe),recipe=found?.recipe;if(!e.remaining(r)||!cfg.production.enabled||!cfg.production.craft||!recipe)return false;
  const yieldCount=recipe.q??recipe.quantity??1;if(!Number.isSafeInteger(yieldCount)||yieldCount<1||outputCount(name,r)+yieldCount>Math.min(r.targetCount,r.maxCount))return false;
  const slots=[],requirements=[];
  for(const {quantity:q,item:id,level} of recipeIngredients(recipe)){const slot=p.c.items.findIndex((i,n)=>{const keep=i&&e.rules(i);return i?.name===id&&(i.level??0)===level&&e.safe(i)&&!slots.includes(n)&&(i.q??1)>=q&&keep?.action!=='keep'&&e.count(i)-q>=(keep?keep.keep+keep.teamReserve:0)+reserveOther(id,level);});if(slot<0){const candidate=p.c.items.find(i=>i?.name===id&&(i.level??0)===level&&e.safe(i));return candidate?mergeFor(candidate,q,r):false;}slots.push(slot);requirements.push({item:{...p.c.items[slot]},before:e.count(p.c.items[slot]),q});}
  if(!slots.length||slots.length>9||!Number.isFinite(recipe.cost))return false;
  const questNpc=recipe.quest&&(p.G.npcs?.[recipe.quest]?recipe.quest:Object.entries(p.G.npcs??{}).find(([,n])=>n.quest===recipe.quest)?.[0]),d=e.destination(questNpc||'craftsman');if(recipe.quest&&!questNpc){e.note('Rezept-Arbeitsplatz fehlt: '+recipe.quest);return false;}
  const item={name,level:0,data:recipe.output?.data},total=()=>p.c.items.reduce((n,i)=>n+(i?.name===name&&(i.level??0)===(item.level??0)&&(item.data===undefined||JSON.stringify(i.data)===JSON.stringify(item.data))?i.q??1:0),0),before=total();
  if(!capacity(slots.map((slot,n)=>({slot,quantity:requirements[n].q})),item)||!e.travel(d,'Craft '+name))return false;
  return e.perform('craft',{slots,cost:recipe.cost,rule:r,guard:()=>e.at(d),call:()=>p.call('craft',...slots),observe:()=>total()>before&&requirements.every(x=>e.count(x.item)<=x.before-x.q),details:{item:name,recipe:found.key,before},timeout:45000});
 }
 function exchange(slot,r){
  const i={...p.c.items[slot]},q=p.G.items[i.name]?.e;if(!e.remaining(r)||!cfg.production.enabled||!cfg.production.exchange||!Number.isSafeInteger(q)||q<1||e.spare(slot,r)<q)return false;
  if(e.count(i)-q<r.keep+r.teamReserve+reserveOther(i.name,i.level??0))return false;
  if(r.recipe){if(!materialDrops(p.G,p.G.drops?.[i.name]).some(x=>x.item===r.recipe)){e.note('Exchange-Ziel nicht in Spieldaten: '+r.recipe);return false;}if(qty(r.recipe,0)>=Math.min(r.targetCount,r.maxCount))return false;}
  if(!capacity([{slot,quantity:q}]))return false;
  const quest=p.G.items[i.name]?.quest,npc=quest&&Object.entries(p.G.npcs??{}).find(([,n])=>n.quest===quest)?.[0];
  const d=e.destination(npc||'exchange');if(!e.travel(d,'Exchange'))return false;const before=e.count(i);
  return e.perform('exchange',{slots:[slot],rule:r,guard:()=>e.at(d)&&e.spare(slot,r)>=q,call:()=>p.call('exchange',slot),observe:()=>!p.c.q?.exchange&&!p.c.items.some(x=>x?.name==='placeholder')&&e.count(i)<=before-q,details:{item:i.name,quantity:q,before},timeout:45000});
 }
 function planGoals(){
  plan=[];goal=null;materials=[];planningReason=null;if(!cfg.production.enabled||bot.me.role!=='merchant')return;
  for(const g of goals()){
   const wait=waiting.get(goalKey(g));if(wait?.until>Date.now())continue;if(wait)waiting.delete(goalKey(g));
   const delivered=g.recipient?(deliveries[goalKey(g)]?.quantity??0):0,needed=Math.max(0,g.quantity-delivered);
   if(!needed)continue;if(qty(g.item,g.level,g)>=needed){if(g.recipient){goal=g;break;}continue;}
   try{goal=g;
    const permit=(name,level,kind)=>{if(['craft','exchange','upgrade','compound'].includes(kind)&&!cfg.production[kind])return false;const item={name,level},phase=phaseOf(kind),r=e.explicit(item,phase);return r?r.action===kind&&e.remaining(r)&&(!['upgrade','compound'].includes(kind)||r.targetLevel>level):!!cfg.production.autonomy;};
    // Historical profiles retain their explicit-rule planner and fixed ordering.
    const options=cfg.production.autonomy?{permit,recipeFor:(name,level)=>e.explicit({name,level},'production')?.recipe??'',helpers:(name,level,kind)=>{
     const r=e.explicit({name,level},'production'),grade=p.call('item_grade',{name,level}),scroll=r?.scroll||((kind==='compound'?'cscroll':'scroll')+grade);
     return [{item:scroll,quantity:1},...(r?.offering?[{item:r.offering,quantity:1}]:[])];
    },score:step=>routeScore(step,new Set(),0)}:{};
    plan=planProduction({G:p.G,item:g.item,level:g.level,quantity:needed,stock:qty,bank:(name,level)=>bot.bank.stock?.(name,level)??bot.bank.packs().reduce((n,[,items])=>n+items.reduce((s,i)=>s+(i?.name===name&&(i.level??0)===level&&!i.l&&!i.b&&e.explicit(i)?.action!=='keep'?(i.q??1):0),0),0),canBuy:name=>!!e.npcFor(name),allowed:cfg.production.acquireBy,maxDepth:cfg.production.maxChainDepth,...options});
   }catch(err){plan=[];goal=null;planningReason=err.message;e.note(err.message);continue;}planningReason=null;break;
  }
 }
 function routeScore(step){
  const key=step.item+':'+step.level,permit=(name,level,kind)=>{if(kind==='exchange'&&step.sources?.length===1&&name!==step.sources[0][0])return false;if(['craft','exchange','upgrade','compound'].includes(kind)&&!cfg.production[kind])return false;const r=e.explicit({name,level},phaseOf(kind));return !r||r.action===kind&&e.remaining(r)&&(!['upgrade','compound'].includes(kind)||r.targetLevel>level);};
  const capped=(name,level,price)=>{const r=e.explicit({name,level},'acquisition');return Number.isFinite(price)&&price>0&&price<=(r?.maxPrice??cfg.production.helperMaxPrice)?price:Infinity;};
  const rows=estimateRoutes({G:p.G,item:step.item,level:step.level,quantity:step.quantity,stock:(name,level)=>name+':'+level===key?0:qty(name,level),bank:(name,level)=>name+':'+level===key?0:bot.bank.stock?.(name,level)??bot.bank.packs().reduce((n,[,items])=>n+items.reduce((v,i)=>v+(i?.name===name&&(i.level??0)===level&&e.safe(i)&&e.explicit(i)?.action!=='keep'?(i.q??1):0),0),0),allowed:cfg.production.acquireBy,permit,
   npcPrice:name=>e.npcFor(name)?capped(name,0,p.G.items[name]?.g):Infinity,marketPrice:(name,level)=>capped(name,level,bot.market.quote?.({name,level})??e.explicit({name,level},'acquisition')?.maxPrice??cfg.production.helperMaxPrice),
   farmHours:(name,q)=>materialSources(p.G,name,q,allowedMonsters(),cfg.production.maxFarmHours,bot.observations?.rate)[0]?.estimatedHours??Infinity,
   travelHours:(kind,name)=>(bot.observations?.travelMs(kind==='buy'?e.npcFor(name):kind==='craft'?e.destination('craftsman'):kind==='retrieve'?{map:'bank',x:0,y:-100}:e.destination(kind==='marketBuy'?'citizen22':kind==='exchange'?'exchange':'newupgrade'))??60000)/3600000,
   helpers:(name,level,kind)=>{const r=e.explicit({name,level},'production');return [{item:r?.scroll||((kind==='compound'?'cscroll':'scroll')+p.call('item_grade',{name,level})),quantity:1},...(r?.offering?[{item:r.offering,quantity:1}]:[])];},
   chance:(name,level)=>Math.max(cfg.production.minChance,e.explicit({name,level},'production')?.minChance??0),recipeFor:(name,level)=>e.explicit({name,level},'production')?.recipe??'',strategy:cfg.production.strategy,goldPerHour:cfg.production.goldPerHour,maxDepth:cfg.production.maxChainDepth});
  return rows.find(r=>r.kind===step.kind)?.score??Infinity;
 }
 const allowedMonsters=()=>[...new Set(cfg.characters.filter(c=>c.enabled&&c.role==='farmer'&&(!bot.farmers||bot.farmers.includes(c.name))).flatMap(c=>c.farmTargets.length?c.farmTargets:cfg.farming.targets))];
 function tick(){
  if(!goal||!plan.length)return false;
  if(cfg.production.autonomy&&cfg.merchant.bank&&cfg.production.acquireBy.includes('bank')&&!bot.bank.observed){bot.bank.inspect();return true;}
  const step=plan[0],item={name:step.item,level:step.level};
  const r=e.rules(item,['buy','retrieve','farm','marketBuy'].includes(step.kind)?'acquisition':'production');
  if(!r||r.action!==step.kind){e.note('Produktionskette benötigt explizite '+step.kind+'-Regel für '+step.item);return false;}
  if(!e.remaining(r))return false;
  const attempt=fn=>{const accepted=fn();if(cfg.general.testLogging!==undefined&&!accepted&&!bot.movement.order&&!bot.journal&&!exec.pending.size){const entry={goal:goal.name,item:step.item,kind:step.kind,reservations:structuredClone(plan.reservations??[]),reason:bot.reason||'Voraussetzungen/Angebot fehlen',until:Date.now()+30000};waiting.set(goalKey(goal),entry);if(waiting.size>64)waiting.delete(waiting.keys().next().value);bot.event('production.wait',entry);}return accepted;};
  if(step.kind==='buy')return attempt(()=>e.npcBuy(item,{...r,goldBudget:Math.min(r.goldBudget,goal.budget)},step.quantity));
  if(step.kind==='retrieve')return attempt(()=>bot.bank.retrieve(item,r,step.quantity));
  if(step.kind==='craft')return attempt(()=>craft(step.item,r));if(step.kind==='marketBuy')return attempt(()=>bot.market.buy(item,r));if(step.kind==='exchange'){const slot=p.c.items.findIndex(i=>i&&identity(i)===identity(item));return attempt(()=>slot>=0&&exchange(slot,r));}
  if(['upgrade','compound'].includes(step.kind)){const slot=p.c.items.findIndex(i=>i&&identity(i)===identity(item));return attempt(()=>slot>=0&&mutate(slot,r));}
  if(step.kind==='farm'){
   materials=materialSources(p.G,step.item,step.quantity,allowedMonsters(),cfg.production.maxFarmHours,bot.observations?.rate).slice(0,5);
   e.note(materials.length?'Materialauftrag: '+step.item+' bei '+materials[0].monster:'Kein erlaubter Farmweg im Zeitbudget: '+step.item);
  }return false;
 }
 function reservedQuantity(i,recipient=''){
  let n=0;for(const g of goals())if(!g.recipient&&(bot.me.role==='merchant'||g.gearSlot&&g.character===bot.me.name)&&g.item===i.name&&g.level===(i.level??0))n=Math.max(n,g.quantity);
  const allocated=plan.reservations?.find(r=>r.item===i.name&&r.level===(i.level??0));n=goal&&(goal.item!==i.name||goal.level!==(i.level??0))?n+(allocated?.quantity??0):Math.max(n,allocated?.quantity??0);
  n+=Math.max(0,...[...waiting.values()].filter(w=>w.until>Date.now()).flatMap(w=>w.reservations.filter(r=>r.item===i.name&&r.level===(i.level??0)).map(r=>r.quantity)));
  if(goal?.recipient&&goal.recipient!==recipient&&goal.item===i.name&&goal.level===(i.level??0))n=Math.max(n,goal.quantity-(deliveries[goalKey(goal)]?.quantity??0));return Math.max(0,n);
 }
 function canRecordDelivery(item,to){const matching=goals().filter(g=>g.recipient===to&&g.item===item.name&&g.level===(item.level??0));if(Object.keys(deliveries).length+matching.filter(g=>!Object.hasOwn(deliveries,goalKey(g))).length<=1024)return true;e.note('Ziellieferungsjournal voll; abgeschlossene alte Ziele manuell prüfen');return false;}
 return {mutate,craft,exchange,planGoals,tick,recordDelivery,canRecordDelivery,derivedRule,effectiveRules,matchesOutput,reservedQuantity,outputCount,owns:item=>!!goal&&(item===goal.item||plan.some(s=>s.item===item)||(plan.reservations??[]).some(s=>s.item===item)),get activeGoal(){return goal;},materials:()=>materials,
 reserved:i=>reservedQuantity(i)>0,
 farmTargets(){const merchant=bot.transport.fresh(cfg.party.merchant);if(!merchant?.running||!Array.isArray(merchant.materials))return null;const allowed=bot.me.farmTargets.length?bot.me.farmTargets:cfg.farming.targets;for(const request of merchant.materials){if(!allowed.includes(request.monster)||!Number.isFinite(request.quantity)||request.quantity<=0)continue;const r=e.explicit({name:request.item,level:0},'acquisition');if((r?.action==='farm'||!r&&cfg.production.autonomy)&&qty(request.item,0)<Math.min(r?.targetCount??request.quantity,request.quantity))return [request.monster];}return null;},
 status:()=>({autonomy:!!cfg.production.autonomy,waiting:[...waiting.values()],goal:goal?.name??null,blocked:planningReason,steps:plan.slice(0,20),reservations:(plan.reservations??[]).slice(0,20),deliveries:goals().filter(g=>g.recipient).slice(0,20).map(g=>({goal:g.name,slot:g.gearSlot,quantity:deliveries[goalKey(g)]?.quantity??0,target:g.quantity}))}),close(){preview=null;plan=[];goal=null;materials=[];planningReason=null;}};
}
