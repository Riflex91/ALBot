// Quantiles of kills needed for k Bernoulli successes. Larger requests use a
// labelled normal estimate; these are planning estimates, never guarantees.
export function killQuantile(probability,k,quantile){if(!(probability>0&&probability<=1)||!Number.isSafeInteger(k)||k<1)return Infinity;if(probability===1)return k;
 if(k>128)return Math.ceil((k+(quantile>=.9?1.282:0)*Math.sqrt(k*(1-probability)))/probability);
 const enough=n=>{let term=Math.exp(n*Math.log1p(-probability)),sum=term;for(let j=1;j<k;j++){term*=((n-j+1)/j)*probability/(1-probability);sum+=term;}return 1-Math.min(1,sum)>=quantile;};
 let lo=k,hi=Math.max(k,Math.ceil(k/probability));while(!enough(hi)&&hi<1e12)hi*=2;while(lo<hi){const mid=Math.floor((lo+hi)/2);if(enough(mid))hi=mid;else lo=mid+1;}return lo;
}
export function materialEvent(G,monster,state={},now=Date.now()){const m=G.monsters?.[monster]??{},mapEvents=Object.entries(G.events??{}).filter(([id,e])=>id===monster||e?.type===monster||e?.monster===monster||e?.monsters?.includes?.(monster));const id=m.event??mapEvents[0]?.[0];if(!id)return {required:false,active:true,id:null,ends:null};const row=state[id];const raw=row?.expires??row?.end??row?.endsAt??row?.endAt??row?.end_time??row?.expiresAt;let ends=typeof raw==='number'?raw:Date.parse(raw??'');if(Number.isFinite(ends)&&ends<100000000000)ends*=1000;if(!Number.isFinite(ends))ends=null;return {required:true,id,active:!!row&&row?.live!==false&&row?.active!==false&&(!ends||ends>now),ends};}
