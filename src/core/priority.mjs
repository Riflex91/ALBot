export function createPriorityScheduler(bot){
 const waiting=new Map();let selected=[];
 const classes={emergency:4,safety:3,normal:2,background:1};
 return {run(jobs){const now=Date.now(),ids=new Set(jobs.map(j=>j.id));for(const id of waiting.keys())if(!ids.has(id))waiting.delete(id);for(const j of jobs)if(!waiting.has(j.id))waiting.set(j.id,now);
  const sorted=jobs.filter(j=>!j.until||j.until>now).sort((a,b)=>(classes[b.kind]??2)-(classes[a.kind]??2)||((b.priority??0)+Math.min(10,(now-waiting.get(b.id))/30000))-((a.priority??0)+Math.min(10,(now-waiting.get(a.id))/30000))||waiting.get(a.id)-waiting.get(b.id)||a.id.localeCompare(b.id));selected=[];
  for(const job of sorted){if(!bot.running)break;if(job.guard&&!job.guard())continue;const result=job.run();if(result){selected.push(job.id);waiting.set(job.id,now);if(job.exclusive)break;}}
 },status:()=>({selected:[...selected],waiting:waiting.size}),close(){waiting.clear();selected=[];}};
}
