// Deploy only to an independently configured Workers FREE account plan.
// Every downstream reservation is persisted in one SQLite Durable Object.
const json=(value,status=200)=>Response.json(value,{status});
export async function boundedText(request,max=16384){
 const reader=request.body?.getReader();if(!reader)return '';
 const chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;
  size+=value.byteLength;if(size>max)throw Error('payload-limit');chunks.push(value);
 }}finally{await reader.cancel();}
 const all=new Uint8Array(size);let at=0;for(const chunk of chunks){all.set(chunk,at);at+=chunk.length;}
 return new TextDecoder().decode(all);
}
export function validSnapshot(x,roster){
 return x?.version===1&&roster.includes(x.character)&&Number.isSafeInteger(x.at)&&
  Math.abs(Date.now()-x.at)<300000&&Array.isArray(x.learning)&&x.learning.length<=64&&
  Object.keys(x).every(k=>['version','character','at','learning'].includes(k))&&
  x.learning.every(r=>r&&typeof r.key==='string'&&/^[a-zA-Z0-9:._-]{1,99}$/.test(r.key)&&
   ['failures','samples','randomFailures','at','retryMs'].every(k=>r[k]===undefined||Number.isSafeInteger(r[k])&&r[k]>=0)&&
   Object.keys(r).every(k=>['key','failures','samples','randomFailures','at','last','retryMs'].includes(k))&&
   ['confirmed','returned','unknown','timeout','rejected','randomFailure'].includes(r.last));
}
export function reserveBudget(old,bytes,now=Date.now()){
 const day=new Date(now).toISOString().slice(0,10);
 if(old&&(!Number.isSafeInteger(old.totalBytes)||old.totalBytes<0||
   !Number.isSafeInteger(old.requests)||old.requests<0||typeof old.day!=='string'||old.day>day))return null;
 const requests=old?.day===day?old.requests:0,totalBytes=old?.totalBytes??0;
 // Lifetime cap bounds B2 growth even without deletion or lifecycle success.
 if(requests>=24||!Number.isSafeInteger(bytes)||bytes>16384||bytes<1||totalBytes+bytes>1048576)return null;
 return {day,requests:requests+1,totalBytes:totalBytes+bytes};
}
async function checkedFetch(url,options){
 const r=await fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(10000)});
 if(!r.ok){await r.body?.cancel();throw Error('provider-rejected');}return r;
}
const b2URL=s=>{const u=new URL(s);if(u.protocol!=='https:'||!/(^|\.)backblazeb2\.com$/.test(u.hostname)||u.username||u.password)throw Error('invalid-b2-host');return u;};
async function archiveB2(env,text,name){
 const auth=await (await checkedFetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account',{
  headers:{Authorization:'Basic '+btoa(env.B2_KEY_ID+':'+env.B2_APPLICATION_KEY)}})).json();
 const api=b2URL(auth.apiUrl);
 const upload=await (await checkedFetch(new URL('/b2api/v2/b2_get_upload_url',api),{
  method:'POST',headers:{Authorization:auth.authorizationToken,'Content-Type':'application/json'},body:JSON.stringify({bucketId:env.B2_BUCKET_ID})})).json();
 const bytes=new TextEncoder().encode(text);
 const digest=await crypto.subtle.digest('SHA-1',bytes);
 const sha=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
 const response=await checkedFetch(b2URL(upload.uploadUrl),{method:'POST',headers:{Authorization:upload.authorizationToken,
  'X-Bz-File-Name':encodeURIComponent(name),'X-Bz-Content-Sha1':sha,'Content-Type':'application/json'},body:bytes});
 await response.body?.cancel();
}
export class BudgetLedger {
 constructor(ctx,env){this.ctx=ctx;this.env=env;}
 async fetch(request){
  const env=this.env;
  if(env.FREE_PLANS_CONFIRMED!=='true')return json({error:'setup-required'},503);
  const checked=Date.parse(env.BUDGET_VERIFIED_AT??'');
  if(!Number.isFinite(checked)||Date.now()<checked||Date.now()-checked>7*86400000)return json({error:'budget-review-required'},503);
  let snapshot,text;
  try{text=await boundedText(request);snapshot=JSON.parse(text);}catch{return json({error:'invalid-payload'},400);}
  const roster=(env.CHARACTERS??'').split(',').map(s=>s.trim()).filter(Boolean);
  if(!roster.length||roster.length>4||!validSnapshot(snapshot,roster))return json({error:'invalid-snapshot'},400);
  const bytes=new TextEncoder().encode(text).length;
  // A transaction protects all clients and restarts. Reserve worst case:
  // one Supabase request and three B2 requests, with no automatic retries.
  const permit=await this.ctx.storage.transaction(async tx=>{
   const old=await tx.get('budget'),next=reserveBudget(old,bytes);if(!next)return false;
   const last=await tx.get('last:'+snapshot.character);
   if(last&&snapshot.at<=last)return false;
   await tx.put('budget',next);await tx.put('last:'+snapshot.character,snapshot.at);return true;
  });
  if(!permit)return json({error:'quota-or-duplicate'},429);
  const result={supabase:'disabled',backblaze:'disabled'};
  if(env.SUPABASE_ENABLED==='true'){
   try{
    const url=new URL(env.SUPABASE_URL);
    if(url.protocol!=='https:'||!url.hostname.endsWith('.supabase.co')||url.username||url.password)throw Error('url');
    const r=await checkedFetch(new URL('/rest/v1/albot_learning?on_conflict=character',url),{
     method:'POST',headers:{apikey:env.SUPABASE_SERVICE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_KEY,
      'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},
     body:JSON.stringify({character:snapshot.character,observed_at:new Date(snapshot.at).toISOString(),snapshot})});
    await r.body?.cancel();result.supabase='stored';
   }catch{result.supabase='failed';}
  }
  if(env.B2_ENABLED==='true'){
   try{await archiveB2(env,text,'albot/'+snapshot.character+'/'+snapshot.at+'.json');result.backblaze='stored';}
   catch{result.backblaze='failed';}
  }
  return json(result,Object.values(result).includes('failed')?502:200);
 }
}
export default {async fetch(request,env){
 const origin=request.headers.get('Origin'),allowed=(env.ALLOWED_ORIGINS??'https://adventure.land').split(',');
 const headers={'Access-Control-Allow-Origin':origin&&allowed.includes(origin)?origin:'https://adventure.land',
  'Access-Control-Allow-Headers':'Authorization,Content-Type','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'};
 const reply=r=>{for(const [k,v] of Object.entries(headers))r.headers.set(k,v);return r;};
 if(origin&&!allowed.includes(origin))return reply(json({error:'origin'},403));
 if(request.method==='OPTIONS')return reply(new Response(null,{status:204}));
 if(new URL(request.url).pathname!=='/snapshot'||request.method!=='POST')return reply(json({error:'not-found'},404));
 if(!env.BOT_TOKEN||env.BOT_TOKEN.length<32||request.headers.get('Authorization')!=='Bearer '+env.BOT_TOKEN)return reply(json({error:'unauthorized'},401));
 try{return reply(await env.BUDGET.get(env.BUDGET.idFromName('albot-v1')).fetch(request));}
 catch{return reply(json({error:'unavailable'},503));}
}};
