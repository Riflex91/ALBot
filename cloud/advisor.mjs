export function validAdaptive(x){
 return x?.version===1&&Array.isArray(x.rows)&&x.rows.length<=16&&Object.keys(x).every(k=>['version','rows'].includes(k))&&
  x.rows.every(r=>r&&/^[a-zA-Z0-9_-]{1,64}$/.test(r.target)&&/^[a-zA-Z0-9_-]{1,80}$/.test(r.context)&&
   ['samples','failures','seconds','reward','at'].every(k=>Number.isFinite(r[k])&&r[k]>=0)&&
   Number.isSafeInteger(r.samples)&&r.samples<=10000&&Number.isSafeInteger(r.failures)&&r.failures<=r.samples&&
   r.at<=Date.now()&&Date.now()-r.at<86400000&&Object.keys(r).every(k=>['target','context','samples','failures','seconds','reward','at'].includes(k)));
}
export async function advise(env,snapshots){
 if(env.AI_ENABLED!=='true'||env.AI_FREE_PLAN_CONFIRMED!=='true'||!env.AI)return [];
 const candidates=snapshots.flatMap(s=>validAdaptive(s.adaptive)?s.adaptive.rows.filter(r=>r.samples>=5).map(r=>({character:s.character,...r})):[]).slice(0,16);
 if(!candidates.length)return [];
 const result=await env.AI.run('@cf/meta/llama-3.2-1b-instruct',{
  messages:[{role:'system',content:'Return only JSON {"weights":[{"index":0,"factor":1}]}. Rank the supplied measured farming results. At most 5 entries. Factor must be 0.5 to 1.1. Never suggest actions, code or budgets. Rows with failures cannot receive factor above 1.'},
   {role:'user',content:JSON.stringify(candidates.map((r,index)=>({index,samples:r.samples,failures:r.failures,seconds:r.seconds,reward:r.reward})))}],
  max_tokens:256,temperature:0,response_format:{type:'json_object'}});
 let parsed;try{parsed=typeof result.response==='string'?JSON.parse(result.response):result.response;}catch{return [];}
 if(!parsed||Object.keys(parsed).some(k=>k!=='weights')||!Array.isArray(parsed.weights)||parsed.weights.length>5)return [];
 const grouped=new Map();
 for(const w of parsed.weights){const c=candidates[w?.index];
  if(!c||!Number.isInteger(w.index)||Object.keys(w).some(k=>!['index','factor'].includes(k))||!Number.isFinite(w.factor)||w.factor<.5||w.factor>1.1||c.failures>0&&w.factor>1)return [];
  const list=grouped.get(c.character)??[];list.push({target:c.target,context:c.context,factor:w.factor,expires:Date.now()+3600000});grouped.set(c.character,list);
 }
 return [...grouped].map(([character,proposals])=>({character,proposals}));
}
