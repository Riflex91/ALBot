import {materialSources} from './materials.mjs';
import {identity,fingerprint,variantCount} from '../core/policy.mjs';
import {planProduction} from './planner.mjs';
export function createProduction(bot){
 const {p,cfg,exec}=bot,e=bot.economy;let preview=null,plan=[],goal=null,materials=[];
 const qty=(name,level)=>p.c.items.reduce((n,i)=>n+(i?.name===name&&(i.level??0)===level&&(e.rules(i)?.action!=='keep')&&!i.l&&!i.b?(i.q??1):0),0);
 function mutate(slot,r){
  const i={...p.c.items[slot]},kind=r.action;if(!e.remaining(r)||!cfg.production.enabled||!cfg.production[kind]||!e.safe(i)||!p.G.items[i.name]?.[kind]||(i.level??0)>=r.targetLevel)return false;
  const inputs=[slot];if(kind==='compound')for(let n=0;n<p.c.items.length&&inputs.length<3;n++)if(n!==slot&&e.safe(p.c.items[n])&&identity(i)===identity(p.c.items[n]))inputs.push(n);
  if(kind==='compound'&&inputs.length!==3)return false;
  if(e.count(i)-inputs.length<r.keep+r.teamReserve)return false;
  const scrollName=r.scroll||((kind==='compound'?'cscroll':'scroll')+p.call('item_grade',i));
  const usable=x=>{const rule=x&&e.rules(x);return e.safe(x)&&rule?.action!=='keep'&&(!rule||e.count(x)>rule.keep+rule.teamReserve);};
  const scroll=p.c.items.findIndex(x=>x?.name===scrollName&&usable(x));const offering=r.offering?p.c.items.findIndex(x=>x?.name===r.offering&&usable(x)):null;
  if(scroll<0||(r.offering&&offering<0)){e.note('Produktion benötigt '+scrollName+(r.offering?' / '+r.offering:''));return false;}
  const slots=[...inputs,scroll,...(offering===null?[]:[offering])];if(new Set(slots).size!==slots.length)return false;
  const d=e.destination('newupgrade')??e.destination('upgrade');if(!e.travel(d,kind))return false;
  const key=kind+':'+slots.map(n=>fingerprint(p.c.items[n])).join('|');
  const args=kind==='compound'?[...inputs,scroll,offering]:[slot,scroll,offering];
  if(preview?.key!==key||Date.now()-preview.time>5000){
   if(exec.busy('economy'))return false;preview={key,time:Date.now(),chance:null,cost:null};const token=preview;
   const accepted=exec.run('production.preview',['economy'],()=>bot.running,()=>Promise.resolve(p.call(kind,...args,true)).then(result=>{if(preview!==token||!bot.running)return;const raw=typeof result==='number'?result:result?.chance??result?.success_chance;token.chance=Number(raw);token.cost=0;}),{delay:1000});if(!accepted)preview=null;return accepted;
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
  const recipe=p.G.craft?.[name];if(!e.remaining(r)||!cfg.production.enabled||!cfg.production.craft||!recipe||recipe.quest)return false;
  const yieldCount=recipe.q??recipe.quantity??1;if(!Number.isSafeInteger(yieldCount)||yieldCount<1||e.count({name,level:0})+yieldCount>Math.min(r.targetCount,r.maxCount))return false;
  const slots=[],requirements=[];
  for(const [q,id,level=0] of recipe.items??[]){const slot=p.c.items.findIndex((i,n)=>{const keep=i&&e.rules(i);return i?.name===id&&(i.level??0)===level&&e.safe(i)&&!slots.includes(n)&&(i.q??1)>=q&&keep?.action!=='keep'&&e.count(i)-q>=(keep?keep.keep+keep.teamReserve:0);});if(slot<0)return false;slots.push(slot);requirements.push({item:{...p.c.items[slot]},before:e.count(p.c.items[slot]),q});}
  if(!slots.length||slots.length>9||!Number.isFinite(recipe.cost))return false;
  const d=e.destination('craftsman');if(!e.travel(d,'Craft '+name))return false;const item={name,level:0},before=e.count(item);
  return e.perform('craft',{slots,cost:recipe.cost,rule:r,guard:()=>e.at(d),call:()=>p.call('craft',...slots),observe:()=>e.count(item)>before&&requirements.every(x=>e.count(x.item)<=x.before-x.q),details:{item:name,before},timeout:45000});
 }
 function exchange(slot,r){
  const i={...p.c.items[slot]},q=p.G.items[i.name]?.e;if(!e.remaining(r)||!cfg.production.enabled||!cfg.production.exchange||!Number.isSafeInteger(q)||q<1||e.spare(slot,r)<q)return false;
  const quest=p.G.items[i.name]?.quest,npc=quest&&Object.entries(p.G.npcs??{}).find(([,n])=>n.quest===quest)?.[0];
  const d=e.destination(npc||'exchange');if(!e.travel(d,'Exchange'))return false;const before=e.count(i);
  return e.perform('exchange',{slots:[slot],rule:r,guard:()=>e.at(d)&&e.spare(slot,r)>=q,call:()=>p.call('exchange',slot),observe:()=>!p.c.q?.exchange&&!p.c.items.some(x=>x?.name==='placeholder')&&e.count(i)<=before-q,details:{item:i.name,quantity:q,before},timeout:45000});
 }
 function planGoals(){
  plan=[];goal=null;materials=[];if(!cfg.production.enabled)return;
  for(const g of cfg.production.goals.filter(g=>g.enabled).sort((a,b)=>b.priority-a.priority)){
   if(qty(g.item,g.level)>=g.quantity)continue;
   try{plan=planProduction({G:p.G,item:g.item,level:g.level,quantity:g.quantity,stock:qty,bank:(name,level)=>bot.bank.packs().reduce((n,[,items])=>n+items.reduce((s,i)=>s+(i?.name===name&&(i.level??0)===level&&!i.l&&!i.b?(i.q??1):0),0),0),canBuy:name=>!!e.npcFor(name),allowed:cfg.production.acquireBy,maxDepth:cfg.production.maxChainDepth});goal=g;}catch(err){e.note(err.message);}break;
  }
 }
 function tick(){
  if(!goal||!plan.length)return false;const step=plan[0],item={name:step.item,level:step.level};
  const r=e.rules(item,['buy','retrieve','farm','marketBuy'].includes(step.kind)?'acquisition':'production');
  if(!r||r.action!==step.kind){e.note('Produktionskette benötigt explizite '+step.kind+'-Regel für '+step.item);return false;}
  if(!e.remaining(r))return false;
  if(step.kind==='buy')return e.npcBuy(item,{...r,goldBudget:Math.min(r.goldBudget,goal.budget)},step.quantity);
  if(step.kind==='retrieve')return bot.bank.retrieve(item,r,step.quantity);
  if(step.kind==='craft')return craft(step.item,r);if(step.kind==='marketBuy')return bot.market.buy(item,r);if(step.kind==='exchange'){const slot=p.c.items.findIndex(i=>i&&identity(i)===identity(item));return slot>=0&&exchange(slot,r);}
  if(['upgrade','compound'].includes(step.kind)){const slot=p.c.items.findIndex(i=>i&&identity(i)===identity(item));return slot>=0&&mutate(slot,r);}
  if(step.kind==='farm'){
   const allowed=[...new Set(cfg.characters.filter(c=>c.enabled&&c.role==='farmer').flatMap(c=>c.farmTargets.length?c.farmTargets:cfg.farming.targets))];
   materials=materialSources(p.G,step.item,step.quantity,allowed,cfg.production.maxFarmHours).slice(0,5);
   e.note(materials.length?'Materialauftrag: '+step.item+' bei '+materials[0].monster:'Kein erlaubter Farmweg im Zeitbudget: '+step.item);
  }return false;
 }
 return {mutate,craft,exchange,planGoals,tick,get activeGoal(){return goal;},materials:()=>materials,
 reserved:i=>!!goal&&((i.name===goal.item&&(i.level??0)===goal.level&&!goal.recipient)||plan.some(s=>s.item===i.name&&(i.level??0)===s.level&&s.kind!=='farm')),
 farmTargets(){const merchant=bot.transport.fresh(cfg.party.merchant);if(!merchant?.running||!Array.isArray(merchant.materials))return null;const allowed=bot.me.farmTargets.length?bot.me.farmTargets:cfg.farming.targets;for(const request of merchant.materials){if(!allowed.includes(request.monster)||!Number.isFinite(request.quantity)||request.quantity<=0)continue;const r=e.rules({name:request.item,level:0},'acquisition');if(r?.action==='farm'&&qty(request.item,0)<Math.min(r.targetCount,request.quantity))return [request.monster];}return null;},
 status:()=>({goal:goal?.name??null,steps:plan.slice(0,20)}),close(){preview=null;plan=[];goal=null;materials=[];}};
}
