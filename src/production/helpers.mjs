import {fingerprint,surplusQuantity} from '../core/policy.mjs';
import {finiteMutationPlan} from './mutation-plan.mjs';
// Official upgrade/compound previews can exceed one after grace bonuses.
// Preserve the raw quote for diagnostics; only probability math is clamped.
export function serverMutationChance(result){
 const raw=typeof result==='number'?result:result?.chance??result?.success_chance;
 return typeof raw==='number'&&Number.isFinite(raw)&&raw>=0?Math.min(1,raw):null;
}
export function mutationContext(bot,item){
 const G=bot.p.G;
 return JSON.stringify([G.version,item,(bot.p.c.items??[]).map(i=>fingerprint(i)),
  (bot.p.c.items??[]).filter(Boolean).map(i=>[i.name,G.items?.[i.name]]),
  G.upgrades,G.compounds,bot.cfg.production,bot.cfg.items]);
}
export function mutationHelpers(bot,item,kind){
 const {p,cfg}=bot,e=bot.economy,grade=p.call('item_grade',item);
 if(!Number.isFinite(grade)||grade>=4)return [];
 const usable=(i,n)=>{
  const r=e.rules(i);return e.safe(i)&&r?.action!=='keep'&&
   surplusQuantity(e.count(i),bot.production?.reservedQuantity?.(i)??0,r?.keep??0,r?.teamReserve??0)>0;
 };
 const rows=p.c.items.map((i,slot)=>({i,slot,m:p.G.items?.[i?.name]})).filter(r=>r.i&&r.m&&['uscroll','cscroll','offering'].includes(r.m.type)&&usable(r.i,r.slot));
 const scrolls=rows.filter(r=>r.m.type===(kind==='compound'?'cscroll':'uscroll')&&r.m.grade>=grade);
 const offerings=[null,...rows.filter(r=>r.m.type==='offering')];
 const result=[];
 for(const s of scrolls)for(const o of offerings){
  const price=x=>x?Math.max(e.value(x.i),Number.isFinite(x.m.g)?x.m.g:0):0;
  const cost=price(s)+price(o);if(!Number.isFinite(cost)||cfg.merchant.budgetMode!=='account-loss'&&cost>cfg.production.helperMaxPrice)continue;
  if(result.some(r=>r.scroll===s.i.name&&r.offering===(o?.i.name??'')))continue;
  result.push({scroll:s.i.name,scrollSlot:s.slot,offering:o?.i.name??'',offeringSlot:o?.slot??null,
   cost,preserves:kind==='upgrade'&&s.m.grade===3.6});
 }
 return result.sort((a,b)=>a.cost-b.cost).slice(0,24);
}
export function bestMutationHelper(quotes,{inputValue,outputValue,minChance,margin=0,factor=1}){
 const stop=inputValue*factor;let best={action:'sell',ev:inputValue,reason:'preview-stop-value'};
 for(const q of quotes){
  if(!Number.isFinite(q.chance)||q.chance<minChance||q.chance>1||!Number.isFinite(q.cost)||q.cost<0)continue;
  const value=q.chance*outputValue+(1-q.chance)*(q.preserves?inputValue:0)-q.cost;
  if(value>Math.max(stop*(1+margin),best.ev*factor))best={...q,action:factor===3?'compound':'upgrade',ev:value/factor,reason:'server-preview-helper-comparison'};
 }
 return best;
}
export function planMutationHelpers(bot,item,quotes,kind,minChance){
 if(!bot.cfg.production.finiteHelpers)return bestMutationHelper(quotes,{inputValue:bot.economy.value(item),
  outputValue:bot.economy.value({...item,level:(item.level??0)+1}),minChance,margin:bot.cfg.production.minImprovement,factor:kind==='compound'?3:1});
 const {p,cfg}=bot,start=item.level??0,max=Math.min(12,cfg.production.autoProfitMaxLevel??start+1),counts=Array(max+1).fill(0);
 if(start>=max)return {action:'sell',ev:bot.economy.value(item)};
 for(let l=start;l<=max;l++){const candidate={...item,level:l},rule=bot.economy.explicit(candidate);
  counts[l]=rule?.action==='keep'?0:Math.min(42,surplusQuantity(bot.economy.count(candidate),bot.production?.reservedQuantity(candidate)??0,rule?.keep??0,rule?.teamReserve??0));
 }
 const slots=[...new Set(quotes.flatMap(q=>[q.scrollSlot,...(q.offeringSlot===null?[]:[q.offeringSlot])]))];
 const resources=slots.map(n=>{const i=p.c.items[n],rule=i&&bot.economy.rules(i);return !i||rule?.action==='keep'?0:
  Math.min(8,i.q??1,surplusQuantity(bot.economy.count(i),bot.production?.reservedQuantity(i)??0,rule?.keep??0,rule?.teamReserve??0));});
 const helpers=quotes.map(q=>({...q,uses:[[slots.indexOf(q.scrollSlot),1],...(q.offeringSlot===null?[]:[[slots.indexOf(q.offeringSlot),1]])]}));
 const plan=finiteMutationPlan({counts,resources,helpers,maxLevel:max,minChance,compound:kind==='compound',
  price:l=>bot.economy.value({...item,level:l}),budget:cfg.merchant.budgetMode==='account-loss'?Number.MAX_SAFE_INTEGER:cfg.production.helperMaxPrice,margin:cfg.production.minImprovement,
  chance:(l,h)=>l===start?h.chance:!h.offering&&h.scroll===(kind==='compound'?'cscroll':'scroll')+p.call('item_grade',{...item,level:l})?
   bot.intelligence?.chance(item.name,l,kind):null});
 if(plan.action===kind&&plan.level!==start)return {action:'bank',ev:bot.economy.value(item),reason:'another-level-first'};
 return {...plan.helper,...plan,ev:plan.value/Math.max(1,counts.reduce((n,q)=>n+q,0))};
}
