// Deploy only to an independently configured Workers FREE account plan.
// Every downstream reservation is persisted in one SQLite Durable Object.
import {validAdaptive,advise} from './advisor.mjs';
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
 return x?.version===1&&/^[a-zA-Z0-9_-]{1,80}$/.test(x.character)&&roster.includes(x.character)&&Number.isSafeInteger(x.at)&&
  Math.abs(Date.now()-x.at)<300000&&Array.isArray(x.learning)&&x.learning.length<=64&&
  Object.keys(x).every(k=>['version','character','at','learning','team'].includes(k))&&
  (x.team===undefined||Array.isArray(x.team)&&x.team.length<=4&&x.team.every(s=>s&&roster.includes(s.character)&&validAdaptive(s.adaptive)&&Object.keys(s).every(k=>['character','adaptive'].includes(k))))&&
  x.learning.every(r=>r&&typeof r.key==='string'&&/^[a-zA-Z0-9:._-]{1,99}$/.test(r.key)&&
   ['failures','samples','randomFailures','at','retryMs'].every(k=>r[k]===undefined||Number.isSafeInteger(r[k])&&r[k]>=0)&&
   Object.keys(r).every(k=>['key','failures','samples','randomFailures','at','last','retryMs'].includes(k))&&
   ['confirmed','returned','unknown','timeout','rejected','randomFailure'].includes(r.last));
}
export function reserveBudget(old,bytes,now=Date.now(),boundedRetention=false){
 const day=new Date(now).toISOString().slice(0,10);
 if(old&&(!Number.isSafeInteger(old.totalBytes)||old.totalBytes<0||
   !Number.isSafeInteger(old.requests)||old.requests<0||typeof old.day!=='string'||old.day>day))return null;
 const requests=old?.day===day?old.requests:0,totalBytes=old?.totalBytes??0;
 // Lifetime cap bounds B2 growth even without deletion or lifecycle success.
 if(requests>=24||!Number.isSafeInteger(bytes)||bytes>16384||bytes<1||!Number.isSafeInteger(totalBytes+bytes)||!boundedRetention&&totalBytes+bytes>1048576)return null;
 return {day,requests:requests+1,totalBytes:totalBytes+bytes};
}
async function checkedFetch(url,options){
 const r=await fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(10000)});
 if(!r.ok){await r.body?.cancel();throw Error('provider-rejected');}return r;
}
const b2URL=s=>{const u=new URL(s);if(u.protocol!=='https:'||!/(^|\.)backblazeb2\.com$/.test(u.hostname)||u.username||u.password)throw Error('invalid-b2-host');return u;};
async function archiveB2(env,text,name,previous=null){
 const auth=await (await checkedFetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account',{
  headers:{Authorization:'Basic '+btoa(env.B2_KEY_ID+':'+env.B2_APPLICATION_KEY)}})).json();
 const api=b2URL(auth.apiUrl);
 if(previous){
  if(typeof previous.fileId!=='string'||typeof previous.fileName!=='string'||!previous.fileName.startsWith('albot/'))throw Error('archive-manifest');
  const removed=await checkedFetch(new URL('/b2api/v2/b2_delete_file_version',api),{method:'POST',headers:{Authorization:auth.authorizationToken,'Content-Type':'application/json'},body:JSON.stringify({fileId:previous.fileId,fileName:previous.fileName})});await removed.body?.cancel();
 }
 const upload=await (await checkedFetch(new URL('/b2api/v2/b2_get_upload_url',api),{
  method:'POST',headers:{Authorization:auth.authorizationToken,'Content-Type':'application/json'},body:JSON.stringify({bucketId:env.B2_BUCKET_ID})})).json();
 const bytes=new TextEncoder().encode(text);
 const digest=await crypto.subtle.digest('SHA-1',bytes);
 const sha=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
 const response=await checkedFetch(b2URL(upload.uploadUrl),{method:'POST',headers:{Authorization:upload.authorizationToken,
  'X-Bz-File-Name':encodeURIComponent(name),'X-Bz-Content-Sha1':sha,'Content-Type':'application/json'},body:bytes});
 const stored=await response.json();if(typeof stored.fileId!=='string'||stored.fileId.length>512||stored.fileName!==name)throw Error('archive-receipt');
 return {fileId:stored.fileId,fileName:name,bytes:bytes.length,at:Date.now()};
}
export class BudgetLedger {
 constructor(ctx,env){this.ctx=ctx;this.env=env;}
 async fetch(request){
  const env=this.env;
  if(env.FREE_PLANS_CONFIRMED!=='true')return json({error:'setup-required'},503);
  const checked=Date.parse(env.BUDGET_VERIFIED_AT??'');
  if(!Number.isFinite(checked)||Date.now()<checked||Date.now()-checked>7*86400000)return json({error:'budget-review-required'},503);
  const path=new URL(request.url).pathname;
  if(path==='/restore'){
   let input;try{input=JSON.parse(await boundedText(request,1024));}catch{return json({error:'payload'},400);}
   const roster=(env.CHARACTERS??'').split(',').map(s=>s.trim());
   if(!roster.includes(input?.character))return json({error:'character'},403);
   const permit=await this.ctx.storage.transaction(async tx=>{const next=reserveBudget(await tx.get('budget'),1,Date.now(),env.BOUNDED_RETENTION==='true');if(!next)return false;await tx.put('budget',next);return true;});
   if(!permit)return json({error:'quota'},429);
   const latest=await this.ctx.storage.get('snapshot:'+input.character);
   return json({adaptive:latest&&Date.now()-latest.at<86400000?latest.adaptive:null});
  }
  let snapshot,text;
  try{text=await boundedText(request);snapshot=JSON.parse(text);}catch{return json({error:'invalid-payload'},400);}
  const roster=(env.CHARACTERS??'').split(',').map(s=>s.trim()).filter(Boolean);
  if(!roster.length||roster.length>4||!validSnapshot(snapshot,roster))return json({error:'invalid-snapshot'},400);
  const bytes=new TextEncoder().encode(text).length;
  // A transaction protects all clients and restarts. Reserve worst case:
  // one Supabase request and at most four B2 requests, with no automatic retries.
  const permit=await this.ctx.storage.transaction(async tx=>{
   const mode=env.BOUNDED_RETENTION==='true'?'ring-v1':'lifetime-v1',previousMode=await tx.get('retention-mode');
   if(previousMode&&previousMode!==mode)return false;
   const old=await tx.get('budget'),next=reserveBudget(old,bytes,Date.now(),env.BOUNDED_RETENTION==='true');if(!next)return false;
   const subjects=await tx.get('subjects')??[];
   if(!Array.isArray(subjects)||subjects.some(x=>typeof x!=='string'))return false;
   const names=[...new Set([...subjects,snapshot.character,...(snapshot.team??[]).map(x=>x.character)])];
   if(names.length>4)return false;
   const last=await tx.get('last:'+snapshot.character);
   if(last&&snapshot.at<=last)return false;
   await tx.put('retention-mode',mode);await tx.put('subjects',names);await tx.put('budget',next);await tx.put('last:'+snapshot.character,snapshot.at);return true;
  });
  if(!permit)return json({error:'quota-or-duplicate'},429);
  for(const s of snapshot.team??[])await this.ctx.storage.put('snapshot:'+s.character,{adaptive:s.adaptive,at:snapshot.at});
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
   try{
    if(env.BOUNDED_RETENTION==='true'){
     // One durable pending marker precedes every remote operation. An unknown
     // upload/delete outcome freezes archival instead of accumulating versions.
     const archiveKey='archive:'+snapshot.character;
     const permitArchive=await this.ctx.storage.transaction(async tx=>{
      const a=await tx.get(archiveKey)??{rows:[],cursor:0};
      if(a.pending||!Array.isArray(a.rows)||a.rows.length>8||!Number.isSafeInteger(a.cursor)||a.cursor<0)return null;
      await tx.put(archiveKey,{...a,pending:true});return a;
     });
     if(!permitArchive)throw Error('archive-reconciliation-required');
     const index=permitArchive.cursor%8,previous=permitArchive.rows[index]??null;
     const stored=await archiveB2(env,text,'albot/'+snapshot.character+'/'+snapshot.at+'.json',previous);
     permitArchive.rows[index]=stored;await this.ctx.storage.put(archiveKey,{rows:permitArchive.rows,cursor:permitArchive.cursor+1,pending:false});
    }else await archiveB2(env,text,'albot/'+snapshot.character+'/'+snapshot.at+'.json');
    result.backblaze='stored';
   }
   catch{result.backblaze='failed';}
  }
  let advice=[];
  if(env.AI_ENABLED==='true'&&env.AI_FREE_PLAN_CONFIRMED==='true'&&(snapshot.team??[]).some(s=>s.adaptive.rows.some(r=>r.samples>=5))){
   const day=new Date().toISOString().slice(0,10);
   const aiPermit=await this.ctx.storage.transaction(async tx=>{if(await tx.get('ai-day')===day)return false;await tx.put('ai-day',day);return true;});
   if(aiPermit)try{advice=await advise(env,snapshot.team??[]);}catch{}
  }
  return json({...result,advice},Object.values(result).includes('failed')?502:200);
 }
}
export default {async fetch(request,env){
 const origin=request.headers.get('Origin'),allowed=(env.ALLOWED_ORIGINS??'https://adventure.land').split(',');
 const headers={'Access-Control-Allow-Origin':origin&&allowed.includes(origin)?origin:'https://adventure.land',
  'Access-Control-Allow-Headers':'Authorization,Content-Type','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'};
 const reply=r=>{for(const [k,v] of Object.entries(headers))r.headers.set(k,v);return r;};
 if(origin&&!allowed.includes(origin))return reply(json({error:'origin'},403));
 if(request.method==='OPTIONS')return reply(new Response(null,{status:204}));
 if(!['/snapshot','/restore'].includes(new URL(request.url).pathname)||request.method!=='POST')return reply(json({error:'not-found'},404));
 if(!env.BOT_TOKEN||env.BOT_TOKEN.length<32||request.headers.get('Authorization')!=='Bearer '+env.BOT_TOKEN)return reply(json({error:'unauthorized'},401));
 try{return reply(await env.BUDGET.get(env.BUDGET.idFromName('albot-v1')).fetch(request));}
 catch{return reply(json({error:'unavailable'},503));}
}};
