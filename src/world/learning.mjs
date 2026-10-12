// Bounded aggregate learning, not a raw event log or an action authority.
export function createLearning(bot){
 const {p,me}=bot,key='albot:learning:v1:'+me.name,context=()=>String(p.G.version??'unknown')+':'+p.realm();
 const saved=p.read(key);let rows=saved?.version===1&&saved.context===context()&&Array.isArray(saved.rows)?saved.rows.filter(r=>
  r&&typeof r.key==='string'&&r.key.length<100&&Number.isSafeInteger(r.failures)&&r.failures>=0&&r.failures<=10&&
  Number.isSafeInteger(r.samples)&&r.samples>=0&&r.samples<=10000&&Number.isFinite(r.at)&&r.at<=Date.now()).slice(-64):[];
 let ctx=context(),dirty=false,lastSave=0,storage=true;
 function reset(){if(ctx!==context()){ctx=context();rows=[];dirty=true;}}
 function observe(type,data){
  if(type!=='action.end'||typeof data?.key!=='string')return;reset();
  const failure=['unknown','timeout','rejected'].includes(data.result);
  if(!failure&&data.result!=='confirmed'&&data.result!=='returned')return;
  let row=rows.find(r=>r.key===data.key);
  if(!row){row={key:data.key,failures:0,samples:0,at:0,randomFailures:0};rows.push(row);if(rows.length>64)rows.shift();}
  row.samples=Math.min(10000,row.samples+1);row.at=Date.now();
  row.failures=failure?Math.min(10,row.failures+1):0;
  if(data.outcome==='randomFailure')row.randomFailures=Math.min(10000,(row.randomFailures??0)+1);
  row.last=failure?data.result:data.outcome??data.result;dirty=true;
 }
 function retryDelay(action){reset();const row=rows.find(r=>r.key===action);
  return !row||Date.now()-row.at>3600000?3000:Math.min(60000,3000*2**Math.min(5,row.failures));
 }
 function flush(force=false){reset();if(!dirty||!force&&Date.now()-lastSave<30000)return;
  lastSave=Date.now();storage=p.write(key,{version:1,context:ctx,rows})!==false;if(storage)dirty=false;
 }
 return {observe,retryDelay,flush,status:()=>({context:ctx,storage,rows:rows.map(r=>({...r,retryMs:retryDelay(r.key)}))})};
}
