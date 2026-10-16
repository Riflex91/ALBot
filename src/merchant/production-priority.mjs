import {identity} from '../core/policy.mjs';

// No extra authority to mutate stock: unique scheduler identity only.
// Two equal stacks can pass or fail independently; a deferred slot must not
// put every same-name item on cooldown.
export function merchantItemTaskId(phase,rule,item,slot){
 if(!['inventory','production'].includes(phase)||!rule||
    typeof item?.name!=='string'||!Number.isSafeInteger(slot)||slot<0)return null;
 return phase+':'+JSON.stringify([slot,rule.name??'',rule.action??'',
  item.name,item.level??0,identity(item),rule.recipient??'']);
}

// Keep ONLY a recently admitted goal whose priority remains comparable.
// No hold for a speculative/unexecuted plan, missing goal, urgent high-priority
// work or expired admissions. Used to reduce recipe churn while an action is
// actively in progress, never to authorize a protected item operation.
export function prioritizeAdmittedProductionGoal(ranked,{
 admittedKey=null,admittedAt=0,now=Date.now(),keyOf,
 scoreOf,maxHoldMs=45000,maxPriorityDeficit=15
}={}){
 if(!Array.isArray(ranked)||!ranked.length)return [];
 const jobs=[...ranked];
 if(typeof keyOf!=='function'||typeof scoreOf!=='function'||
    typeof admittedKey!=='string'||!admittedKey||
    !Number.isFinite(admittedAt)||admittedAt<=0||
    !Number.isFinite(now)||now<admittedAt||
    now-admittedAt>maxHoldMs)return jobs;
 const at=jobs.findIndex(j=>keyOf(j)===admittedKey);
 if(at<=0)return jobs;
 const old=jobs[at],first=jobs[0],oldScore=scoreOf(old),bestScore=scoreOf(first);
 if(!Number.isFinite(oldScore)||!Number.isFinite(bestScore)||
    bestScore-oldScore>maxPriorityDeficit)return jobs;
 jobs.splice(at,1);
 jobs.unshift(old);
 return jobs;
}

// A market search only admits movement, not an item transaction.
// Keep the goal stable for a market buy only after executor/journal admission.
export function admittedProductionAction(step,accepted,{journal=false,pending=false}={}){
 return accepted===true&&(step?.kind!=='marketBuy'||journal===true||pending===true);
}

// Keep a purely speculative market request out of the active production slot
// only after an actual observed no-offer visit. Any visible matching listing
// or expiration immediately restores normal planning/price guards.
export function deferNoOfferMarketPlan(step,market){
 if(step?.kind!=='marketBuy'||typeof market?.offerWaitMs!=='function')return 0;
 const wait=market.offerWaitMs({name:step.item,level:step.level??0});
 return Number.isFinite(wait)&&wait>0?wait:0;
}

// Never select a locked or explicitly protected first copy when another
// identical physical stack is suitable. The caller supplies its live guards;
// this helper does not grant mutation authority.
export function firstEligibleProductionSlot(items,item,eligible){
 if(!Array.isArray(items)||!item||typeof eligible!=='function')return -1;
 const wanted=identity(item);
 return items.findIndex(x=>!!x&&identity(x)===wanted&&eligible(x));
}
