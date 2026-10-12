// Optional aggregate backup only. Cloud responses never authorize game actions.
export function createCloudSync(bot){
 const {p,me}=bot,c=p.root.ALBotCloudConfig??{},key='albot:cloud:v1:'+me.name;
 let busy=false,closed=false,next=0,status='disabled',controller=null,advice=[];
 const configured=()=>c.enabled===true&&
  /^https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev\/?$/.test(c.url??'')&&
  typeof c.token==='string'&&c.token.length>=32&&typeof p.root.fetch==='function'&&
  typeof TextEncoder==='function'&&typeof AbortController==='function';
 const enabled=()=>configured()&&me.role==='merchant';
 async function readJSON(response){
  if(!response.body?.getReader)return null;const reader=response.body.getReader(),parts=[];let size=0;
  try{while(true){const r=await reader.read();if(r.done)break;size+=r.value.byteLength;if(size>16384)throw Error('cloud-response-limit');parts.push(r.value);}}
  finally{await reader.cancel();}
  const all=new Uint8Array(size);let at=0;for(const part of parts){all.set(part,at);at+=part.byteLength;}
  return size?JSON.parse(new TextDecoder().decode(all)):null;
 }
 async function restore(){
  if(!configured()||bot.running||busy)return false;
  const previous=p.read(key+':restore');if(previous&&Date.now()-previous<3600000)return false;
  if(!p.write(key+':restore',Date.now()))return false;
  busy=true;const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),10000);
  try{const response=await p.root.fetch(c.url.replace(/\/$/,'')+'/restore',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+c.token},body:JSON.stringify({character:me.name}),signal:abort.signal});
   if(!response.ok){status='restore-unavailable';await response.body?.cancel();return false;}const value=await readJSON(response),restored=bot.adaptive?.restore(value?.adaptive)??false;status=restored?'restored':'restore-rejected';return restored;
  }catch{return false;}finally{clearTimeout(timer);busy=false;}
 }
 async function tick(){
  if(closed||!enabled()||busy||!bot.running||Date.now()<next)return;
  next=Date.now()+3600000;
  const day=new Date().toISOString().slice(0,10),old=p.read(key);
  if(old&&(!Number.isSafeInteger(old.used)||old.used<0||typeof old.day!=='string'||old.day>day)){status='invalid-budget';return;}
  const used=old?.day===day?old.used:0;
  if(used>=24){status='daily-limit';return;}
  if(!p.write(key,{day,used:used+1})){status='storage-unavailable';return;}
  const payload={version:1,character:me.name,at:Date.now(),
   learning:bot.learning?.status()?.rows??[]};
  const team=[{character:me.name,adaptive:bot.adaptive?.snapshot()},...(bot.farmers??[]).filter(n=>n!==me.name).map(n=>{
   const h=bot.transport.fresh(n);return h?.running&&h.realm===p.realm()?{character:n,adaptive:h.adaptive}:null;
  })].filter(x=>x?.adaptive).slice(0,4);
  if(team.length)payload.team=team;
  const body=JSON.stringify(payload);
  if(new TextEncoder().encode(body).length>16384){status='payload-limit';return;}
  busy=true;status='sending';controller=new AbortController();
  const timeout=setTimeout(()=>controller?.abort(),10000);
  try{
   const response=await p.root.fetch(c.url.replace(/\/$/,'')+'/snapshot',{
    method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+c.token},
    body,signal:controller.signal});
   status=response.ok?'stored':response.status===429?'quota-exhausted':'cloud-unavailable';
   if(response.ok){const value=await readJSON(response);advice=Array.isArray(value?.advice)?value.advice.filter(x=>bot.teamNames.includes(x.character)&&Array.isArray(x.proposals)&&x.proposals.length<=5).slice(0,4):[];}
   else await response.body?.cancel?.();
  }catch{status='offline';}finally{clearTimeout(timeout);busy=false;controller=null;}
 }
 return {tick,restore,advice:()=>advice,status:()=>({enabled:enabled(),state:status,nextAt:next,busy}),
  close(){closed=true;controller?.abort();},resume(){closed=false;}};
}
