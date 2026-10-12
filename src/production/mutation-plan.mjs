// Finite stochastic dynamic programme. A state contains all remaining copies
// and helper resources; failure branches never manufacture replacement items.
export function finiteMutationPlan({counts,helpers,resources,price,chance,maxLevel,minChance=.65,budget=0,margin=0,maxSteps=8,maxStates=12000,compound=false}){
 const factor=compound?3:1,memo=new Map();let states=0,truncated=false;
 const stop=stock=>stock.reduce((n,q,l)=>n+q*price(l),0);
 function solve(stock,left,money,steps){
  const sale=stop(stock),base={value:sale,action:'sell'};
  if(!Number.isFinite(sale)||!steps)return base;
  const key=JSON.stringify([stock,left,money,steps]);if(memo.has(key))return memo.get(key);
  if(++states>maxStates){truncated=true;return base;}
  let best=base;
  for(let level=0;level<Math.min(maxLevel,stock.length-1);level++){
   if(stock[level]<factor)continue;
   for(const h of helpers){
    const cost=h.costAt?.(level)??h.cost,p=chance(level,h);
    if(!Number.isFinite(cost)||cost<0||cost>money||!Number.isFinite(p)||p<minChance||p>1||
      h.uses.some(([id,q])=>!(left[id]>=q)))continue;
    const remaining=[...left];for(const [id,q] of h.uses)remaining[id]-=q;
    const success=[...stock],failure=[...stock];success[level]-=factor;success[level+1]++;
    if(!h.preserves)failure[level]-=factor;
    const value=p*solve(success,remaining,money-cost,steps-1).value+
      (1-p)*solve(failure,remaining,money-cost,steps-1).value-cost;
    if(value>best.value&&value>sale*(1+margin))best={value,action:compound?'compound':'upgrade',level,helper:h};
   }
  }
  memo.set(key,best);return best;
 }
 if(!Array.isArray(counts)||counts.length>13||counts.some(q=>!Number.isSafeInteger(q)||q<0||q>42)||
   resources.some(q=>!Number.isSafeInteger(q)||q<0)||!Number.isFinite(budget)||budget<0)return {action:'sell',reason:'invalid-finite-state'};
 const answer=solve([...counts],[...resources],budget,Math.min(12,maxSteps));
 // Exhausting the search cannot certify an optimum. Do not trade on a
 // partial tree that may favour whichever helper happened to be visited first.
 return truncated?{action:'bank',reason:'finite-search-limit',states}:{...answer,states,reason:'finite-resource-policy'};
}
