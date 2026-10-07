// Small planning cache; no telemetry, sockets, or persistent combat log.
export function createObservations(bot){
 const {p,cfg}=bot,hits=new Map(),dead=new Map(),rates=new Map(),trips=new Map();let since=Date.now(),realm=p.realm(),team='';
 function roster(){return bot.farmers.map(name=>{const x=name===bot.me.name?{class:p.c.ctype,level:p.c.level,gear:bot.gear?.snapshot()}:bot.transport.fresh(name);return [name,x?.class,x?.level,x?.gear?.slots];});}
 function sample(){const raw=JSON.stringify(roster());let hash=2166136261;for(let n=0;n<raw.length;n++)hash=Math.imul(hash^raw.charCodeAt(n),16777619);const signature=(hash>>>0).toString(16);if(realm!==p.realm()||team!==signature||Date.now()-since>=300000){realm=p.realm();team=signature;since=Date.now();rates.clear();hits.clear();dead.clear();}for(const [id,x] of hits)if(Date.now()-x.at>30000)hits.delete(id);for(const [id,at] of dead)if(Date.now()-at>30000)dead.delete(id);}
 function hit(data){if(!bot.running)return;const target=bot.entity(data?.target);if(data?.actor!==bot.me.name||!(data.damage>0)||target?.type!=='monster')return;if(hits.size>=128)hits.delete(hits.keys().next().value);hits.set(data.target,{monster:target.mtype,at:Date.now()});if(data.kill===true)credit(data.target);}
 function credit(id){const x=hits.get(id);if(!x||dead.has(id))return;if(dead.size>=256)dead.delete(dead.keys().next().value);dead.set(id,Date.now());hits.delete(id);rates.set(x.monster,(rates.get(x.monster)??0)+1);if(rates.size>32)rates.delete(rates.keys().next().value);}
 function death(data){if(!bot.running||(data?.actor??data?.hid??data?.killer)!==bot.me.name)return;credit(data.id);}
 function heartbeat(){const elapsed=Date.now()-since;return {team,realm,elapsed,rows:[...rates].slice(0,10).map(([monster,kills])=>({monster,kills}))};}
 function rate(monster){const rows=[heartbeat(),...bot.farmers.filter(n=>n!==bot.me.name).map(n=>{const h=bot.transport.fresh(n);return h?.running&&!h.rip&&h.realm===realm?h.performance:null;})].filter(x=>x&&x.team===team&&x.realm===realm&&Number.isFinite(x.elapsed)&&x.elapsed>=60000);
  // Each context credits only its own server-confirmed killing blow. These
  // disjoint counts may be summed without counting shared hits more than once.
  const values=rows.map(x=>{const row=x.rows?.find(r=>r.monster===monster);return row&&Number.isSafeInteger(row.kills)&&row.kills>0&&row.kills<100000?{kills:row.kills,rate:row.kills*3600000/x.elapsed}:null;}).filter(x=>x&&x.rate<=100000);
  return values.reduce((n,x)=>n+x.kills,0)>=3?{value:values.reduce((n,x)=>n+x.rate,0),source:'observed-team'}:{value:cfg.production.fallbackKillsPerHour??20,source:'configured-estimate'};
 }
 function travel(from,to,elapsed){if(!from||!to||!Number.isFinite(elapsed)||elapsed<0||elapsed>120000)return;const key=from+'>'+to,old=trips.get(key);trips.set(key,{ms:old?(old.ms+elapsed)/2:elapsed,at:Date.now()});if(trips.size>32)trips.delete(trips.keys().next().value);}
 function travelMs(destination){if(!destination)return 0;const old=trips.get(p.c.map+'>'+destination.map);if(old&&Date.now()-old.at<21600000)return old.ms;const d=Math.hypot((p.c.real_x??p.c.x??0)-destination.x,(p.c.real_y??p.c.y??0)-destination.y);return (d/(cfg.production.travelSpeed??50)+(destination.map===p.c.map?0:60))*1000;}
 return {sample,hit,death,heartbeat,rate,travel,travelMs,close(){team='';since=Date.now();hits.clear();dead.clear();rates.clear();}};
}
