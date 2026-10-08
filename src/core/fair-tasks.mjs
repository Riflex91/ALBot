// Waiting age can override a normal hold, never a resource lock or live guard.
export function createFairTasks({holdMs=30000,starvationMs=120000,now=()=>Date.now()}={}){
 const waiting=new Map();let current=null,started=0;
 function rank(jobs){const time=now(),ids=new Set(jobs.map(j=>j.id));for(const id of waiting.keys())if(!ids.has(id))waiting.delete(id);
  for(const j of jobs)if(!waiting.has(j.id))waiting.set(j.id,time);
  const overdue=jobs.filter(j=>time-waiting.get(j.id)>=starvationMs).sort((a,b)=>waiting.get(a.id)-waiting.get(b.id)||(b.priority??0)-(a.priority??0)||a.id.localeCompare(b.id));
  const held=jobs.find(j=>j.id===current);
  const first=jobs.filter(j=>j.critical).sort((a,b)=>(b.priority??0)-(a.priority??0)||waiting.get(a.id)-waiting.get(b.id)||a.id.localeCompare(b.id))[0]??overdue[0]??(held&&time-started<holdMs?held:null);
  return [...(first?[first]:[]),...jobs.filter(j=>j!==first).sort((a,b)=>(b.priority??0)-(a.priority??0)||waiting.get(a.id)-waiting.get(b.id)||a.id.localeCompare(b.id))];
 }
 return {rank,selected(id){if(current!==id){current=id;started=now();}waiting.set(id,now());},clear(){current=null;waiting.clear();},status:()=>({task:current,since:started,waiting:waiting.size})};
}
