// Optional aggregate backup only. Cloud responses never authorize game actions.
export function createCloudSync(bot){
 const {p,me}=bot,c=p.root.ALBotCloudConfig??{},key='albot:cloud:v1:'+me.name;
 let busy=false,closed=false,next=0,status='disabled',controller=null;
 const enabled=()=>c.enabled===true&&me.role==='merchant'&&
  /^https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev\/?$/.test(c.url??'')&&
  typeof c.token==='string'&&c.token.length>=32&&typeof p.root.fetch==='function'&&
  typeof TextEncoder==='function'&&typeof AbortController==='function';
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
  const body=JSON.stringify(payload);
  if(new TextEncoder().encode(body).length>16384){status='payload-limit';return;}
  busy=true;status='sending';controller=new AbortController();
  const timeout=setTimeout(()=>controller?.abort(),10000);
  try{
   const response=await p.root.fetch(c.url.replace(/\/$/,'')+'/snapshot',{
    method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+c.token},
    body,signal:controller.signal});
   status=response.ok?'stored':response.status===429?'quota-exhausted':'cloud-unavailable';
   await response.body?.cancel?.();
  }catch{status='offline';}finally{clearTimeout(timeout);busy=false;controller=null;}
 }
 return {tick,status:()=>({enabled:enabled(),state:status,nextAt:next,busy}),
  close(){closed=true;controller?.abort();},resume(){closed=false;}};
}
