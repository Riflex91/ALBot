import {fingerprint} from '../core/policy.mjs';
export function mutationContext(bot,item){
 const G=bot.p.G;
 return JSON.stringify([G.version,item,(bot.p.c.items??[]).map(i=>fingerprint(i)),
  (bot.p.c.items??[]).filter(Boolean).map(i=>[i.name,G.items?.[i.name]]),
  bot.cfg.production,bot.cfg.items]);
}
export function mutationHelpers(bot,item,kind){
 const {p,cfg}=bot,e=bot.economy,grade=p.call('item_grade',item);
 if(!Number.isFinite(grade)||grade>=4)return [];
 const usable=(i,n)=>{
  const r=e.rules(i);return e.safe(i)&&r?.action!=='keep'&&
   e.count(i)>(r?.keep??0)+(r?.teamReserve??0)+(bot.production?.reservedQuantity?.(i)??0);
 };
 const rows=p.c.items.map((i,slot)=>({i,slot,m:p.G.items?.[i?.name]})).filter(r=>r.i&&r.m&&['uscroll','cscroll','offering'].includes(r.m.type)&&usable(r.i,r.slot));
 const scrolls=rows.filter(r=>r.m.type===(kind==='compound'?'cscroll':'uscroll')&&r.m.grade>=grade);
 const offerings=[null,...rows.filter(r=>r.m.type==='offering')];
 const result=[];
 for(const s of scrolls)for(const o of offerings){
  const price=x=>x?Math.max(e.value(x.i),Number.isFinite(x.m.g)?x.m.g:0):0;
  const cost=price(s)+price(o);if(!Number.isFinite(cost)||cost>cfg.production.helperMaxPrice)continue;
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
