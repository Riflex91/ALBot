import {validatePolicyDocument,EMPTY_POLICIES} from '../public/policy.mjs';
import {FULL_DESCRIPTOR} from '../../src/config/full.mjs';
import {importProfile,envelope} from '../../editor/lib/contract.mjs';
import {storeTelemetry,MAX_STORED_CHARACTERS,MAX_STORED_BANK_PACKS,SNAPSHOT_READ_TTL_MS} from './telemetry-store.mjs';
import {TELEMETRY_MIN_INTERVAL_MS} from '../public/free-tier.mjs';
import {GAME_ORIGINS} from '../public/relay-protocol.mjs';
import {latestBankPackViews} from './bank-view.mjs';
// Cloudflare Access is required for every page/API read and mutation. Never
// expose GitHub credentials to the browser or published Adventure Land code.
const json=(x,status=200,extra={})=>new Response(JSON.stringify(x),{
 status,headers:{'content-type':'application/json;charset=utf-8',
 'cache-control':'no-store','x-content-type-options':'nosniff',...extra}});
const failure=(message,status=400)=>json({ok:false,error:message},status);
const asString=x=>typeof x==='string'?x:'';
function accessHost(env){
 const raw=asString(env.CF_ACCESS_TEAM_DOMAIN).replace(/^https?:\/\//,'').replace(/\/.*$/,'');
 return /^[a-zA-Z0-9.-]+\.cloudflareaccess\.com$/.test(raw)?raw:null;
}
const decode64=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4)),x=>x.charCodeAt(0));
function parseJwt(jwt){
 if(typeof jwt!=='string'||jwt.length>16000||jwt.split('.').length!==3)throw Error('JWT-Format');
 const [a,b,c]=jwt.split('.');
 const header=JSON.parse(new TextDecoder().decode(decode64(a)));
 const payload=JSON.parse(new TextDecoder().decode(decode64(b)));
 return {header,payload,data:new TextEncoder().encode(a+'.'+b),signature:decode64(c)};
}
export async function validateAccess(request,env,fetcher=fetch){
 const host=accessHost(env);
 const audience=asString(env.CF_ACCESS_AUD),allowed=asString(env.ALLOWED_EMAIL).trim().toLowerCase();
 if(!host||!audience||!allowed)return {ok:false,status:503,reason:'Cloudflare Access ist noch nicht eingerichtet'};
 try{
  const token=request.headers.get('CF-Access-Jwt-Assertion');
  if(!token)return {ok:false,status:401,reason:'Cloudflare Access Anmeldung erforderlich'};
  const jwt=parseJwt(token);
  if(jwt.header.alg!=='RS256'||typeof jwt.header.kid!=='string'||jwt.header.kid.length>180)
   return {ok:false,status:401,reason:'Ungültige JWT-Signaturmethode'};
  const {payload}=jwt;
  const epoch=Math.floor(Date.now()/1000);
  const aud=Array.isArray(payload.aud)?payload.aud:[payload.aud];
  if(payload.iss!=='https://'+host||!aud.includes(audience)||
     typeof payload.exp!=='number'||payload.exp<=epoch||
     typeof payload.nbf==='number'&&payload.nbf>epoch+30||
     typeof payload.iat==='number'&&payload.iat>epoch+30||
     asString(payload.email).toLowerCase()!==allowed)
   return {ok:false,status:403,reason:'Cloudflare Access Anspruch abgelehnt'};
  const response=await fetcher('https://'+host+'/cdn-cgi/access/certs',{
   headers:{accept:'application/json'}});
  if(!response.ok)return {ok:false,status:503,reason:'Access-Schlüssel nicht verfügbar'};
  const keys=await response.json();
  const jwk=(keys.keys??[]).find(k=>k.kid===jwt.header.kid&&k.kty==='RSA');
  if(!jwk)return {ok:false,status:401,reason:'Access-Schlüssel unbekannt'};
  const key=await crypto.subtle.importKey('jwk',jwk,
   {name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  const valid=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,jwt.signature,jwt.data);
  return valid?{ok:true,email:payload.email}:
   {ok:false,status:401,reason:'Access-Signatur ungültig'};
 }catch{return {ok:false,status:401,reason:'Ungültiges Access-Token'};}
}
function settings(env){
 const repository=asString(env.CONFIG_REPO),branch=asString(env.CONFIG_BRANCH)||'main',
  path=asString(env.CONFIG_PATH)||'albot/item-policies.json';
 if(!/^[\w.-]+\/[\w.-]+$/.test(repository)||
    !/^[a-zA-Z0-9._/-]{1,120}$/.test(branch)||branch.includes('..')||
    !/^[a-zA-Z0-9._/-]{1,180}$/.test(path)||path.includes('..')||
    path.startsWith('/')||path.endsWith('/'))return null;
 return {repository,branch,path};
}
function b64(s){
 const bytes=new TextEncoder().encode(s);
 let string='';for(const x of bytes)string+=String.fromCharCode(x);
 return btoa(string);
}
function unb64(s){return new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g,'')),x=>x.charCodeAt(0)));}
async function github(env,path,method='GET',body=null,fetcher=fetch){
 const token=asString(env.GITHUB_TOKEN);
 if(!token||token.length<10)return failure('GitHub-Token fehlt in Worker-Secrets',503);
 const s=settings(env);if(!s)return failure('Privates GitHub-Konfigurationsrepository fehlt',503);
 const isProfile=path==='/api/profile';
 const profilePath=asString(env.PROFILE_PATH)||'albot/profile.json';
 if(isProfile&&(!/^[a-zA-Z0-9._/-]{1,180}$/.test(profilePath)||
    profilePath.includes('..')||profilePath===s.path||
    profilePath.startsWith('/')||profilePath.endsWith('/')))
  return failure('Privater Profilpfad ist ungültig',503);
 const u=new URL('https://api.github.com/repos/'+s.repository+'/contents/'+
  (isProfile?profilePath:s.path));
 if(method==='GET')u.searchParams.set('ref',s.branch);
 const r=await fetcher(u.href,{method,headers:{
  authorization:'Bearer '+token,accept:'application/vnd.github+json',
  'x-github-api-version':'2022-11-28','user-agent':'ALBot-Konfigurator-Worker',
  ...(body?{'content-type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});
 if(r.status===404&&method==='GET')return {missing:true,sha:null,document:isProfile?null:EMPTY_POLICIES};
 if(!r.ok){
  const code=r.status===409||r.status===422?409:r.status===401||r.status===403?502:502;
  return failure(r.status===409||r.status===422?
   'GitHub-Konflikt: anderen Versionsstand neu laden':
   'GitHub konnte die Konfiguration nicht bearbeiten ('+r.status+')',code);
 }
 const data=await r.json();
 if(method==='PUT')return {commit:data.commit?.sha??null,sha:data.content?.sha??null};
 try{
  if(data.type!=='file'||typeof data.sha!=='string'||typeof data.content!=='string')
   return failure('Ungültiger GitHub-Dateieintrag',502);
  let document=JSON.parse(unb64(data.content));
  if(isProfile){
   document=envelope(FULL_DESCRIPTOR,importProfile(FULL_DESCRIPTOR,document));
  }else{
   const errors=validatePolicyDocument(document);
   if(errors.length)return failure('Konfiguration auf GitHub ist ungültig: '+errors[0],502);
  }
  return {sha:data.sha,document,missing:false};
 }catch{return failure('GitHub-Konfiguration kann nicht gelesen werden',502);}
}
function validInventory(inv){
 return Array.isArray(inv)&&inv.length<=50&&inv.every(i=>i===null||
  i&&typeof i==='object'&&!Array.isArray(i)&&
  /^[a-zA-Z0-9_]{1,100}$/.test(i.name)&&
  Number.isSafeInteger(i.q)&&i.q>=1&&i.q<=10000000&&
  Number.isSafeInteger(i.level)&&i.level>=0&&i.level<=99);
}
function checkCharacter(d){
 if(!d||typeof d!=='object'||Array.isArray(d)||!/^.{1,100}$/.test(d.name??'')||
    !/^[a-zA-Z0-9_]{1,100}$/.test(d.name)||
    !/^[a-zA-Z0-9_]{1,60}$/.test(d.realm??'')||
    !/^[a-zA-Z0-9_]{1,80}$/.test(d.map??'')||
    !Number.isSafeInteger(d.level)||d.level<1||d.level>999||
    ![d.hp,d.mp,d.maxHp,d.maxMp,d.expPerHour,d.goldPerHour,d.x,d.y].every(Number.isFinite)||
    d.hp<0||d.mp<0||d.maxHp<0||d.maxMp<0||
    d.expPerHour<0||!validInventory(d.inventory))return false;
 return true;
}
function checkBank(d){
 return d&&typeof d==='object'&&!Array.isArray(d)&&
  /^items\d{1,2}$/.test(d.pack)&&/^[a-zA-Z0-9_]{1,80}$/.test(d.map)&&
  /^[a-zA-Z0-9_]{1,60}$/.test(d.realm)&&
  Array.isArray(d.slots)&&d.slots.length===42&&validInventory(d.slots)&&
  (d.slots.filter(Boolean).length<=42);
}
function sameBearer(a,b){
 if(!a||!b||a.length!==b.length)return false;
 let mismatch=0;for(let i=0;i<a.length;i++)mismatch|=a.charCodeAt(i)^b.charCodeAt(i);
 return mismatch===0;
}
function ingestAuth(req,env){
 const header=req.headers.get('authorization')??'';
 const secret=asString(env.INGEST_TOKEN);
 return secret.length>=32&&sameBearer(header,'Bearer '+secret);
}
async function ingest(request,env,requiresBearer=true){
 if(requiresBearer&&!ingestAuth(request,env))return failure('Ungültiger Telemetrie-Schlüssel',401);
 if(!env.DB)return failure('D1-Datenbank noch nicht konfiguriert',503);
 if(Number(request.headers.get('content-length')??0)>32768)return failure('Datenpaket zu groß',413);
 const body=await request.text();
 if(body.length>32768)return failure('Datenpaket zu groß',413);
 let d;try{d=JSON.parse(body);}catch{return failure('Ungültiges JSON');}
 const now=Date.now();
 if(d?.version!==1||!['character','bank'].includes(d.kind))return failure('Unbekanntes Telemetrieformat');
 if(d.kind==='character'? !checkCharacter(d.data):!checkBank(d.data))
  return failure('Ungültige '+(d.kind==='character'?'Charakter':'Bank')+'daten');
 const result=await storeTelemetry(env.DB,d.kind,d.data,now);
 if(!result.stored)return json({ok:false,error:'Telemetrie gedrosselt oder Tabellenlimit erreicht',
   retryAfterSeconds:result.retryAfterSeconds},429,{'retry-after':String(result.retryAfterSeconds)});
 return json({ok:true,receivedAt:now});
}
async function readSnapshots(env,table){
 if(!env.DB)return json({ok:true,configured:false,rows:[]});
 const limit=table==='character_snapshots'?MAX_STORED_CHARACTERS:MAX_STORED_BANK_PACKS;
 const s=await env.DB.prepare('SELECT updated_at,payload FROM '+table+
  ' WHERE updated_at >= ? ORDER BY updated_at DESC LIMIT '+limit)
  .bind(Date.now()-SNAPSHOT_READ_TTL_MS).all();
 const rows=[];
 for(const x of s.results??[])try{rows.push({observedAt:x.updated_at,...JSON.parse(x.payload)})}catch{}
 return json({ok:true,configured:true,
  rows:table==='bank_snapshots'?latestBankPackViews(rows):rows});
}
const secureHeaders={
 'x-frame-options':'DENY','x-content-type-options':'nosniff',
 'referrer-policy':'no-referrer','cache-control':'no-store',
 'content-security-policy':"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
};
function telemetryCors(req){
 // Both official Adventure Land game origins share the same private ingest
 // path. Reflect ONLY a known exact origin; never mirror arbitrary hosts.
 const origin=req.headers.get('origin');
 if(!origin)return {};
 if(!GAME_ORIGINS.includes(origin))return null;
 return {'access-control-allow-origin':origin,'vary':'Origin',
  'access-control-allow-methods':'POST, OPTIONS',
  'access-control-allow-headers':'Authorization, Content-Type',
  'access-control-max-age':'600'};
}
export async function handleRequest(request,env,ctx={},deps={}){
 const url=new URL(request.url),path=url.pathname,fetcher=deps.fetcher??fetch;
 if(path==='/api/ingest'){
  const cors=telemetryCors(request);
  if(cors===null)return failure('Origin nicht freigegeben',403);
  if(request.method==='OPTIONS')
   return new Response(null,{status:204,headers:cors});
  if(request.method!=='POST')return failure('Methode nicht erlaubt',405);
  try{
   const response=await ingest(request,env);
   const headers=new Headers(response.headers);
   for(const [name,value] of Object.entries(cors))headers.set(name,value);
   return new Response(response.body,{status:response.status,headers});
  }catch{return json({ok:false,error:'Telemetrie-Datenbankfehler'},503,cors);}
 }
 const auth=await validateAccess(request,env,fetcher);
 if(!auth.ok)return failure(auth.reason,auth.status);
 // Game submits through a user-authorized Access popup, never with the
 // Worker ingest secret in the public Adventure Land runtime.
 if(path==='/api/relay-ingest'){
  if(request.method!=='POST')return failure('Methode nicht erlaubt',405);
  if(request.headers.get('origin')!==url.origin)
   return failure('Ungültige Request-Herkunft',403);
  if((request.headers.get('content-type')??'').split(';')[0].trim().toLowerCase()!=='application/json')
   return failure('JSON erforderlich',415);
  try{return await ingest(request,env,false);}
  catch{return failure('Telemetrie-Datenbankfehler',503);}
 }
 if(!['GET','HEAD','PUT'].includes(request.method))return failure('Methode nicht erlaubt',405);
 if(request.method==='PUT'){
  if(request.headers.get('origin')!==url.origin)return failure('Ungültige Request-Herkunft',403);
  if(!['/api/policy','/api/profile'].includes(path))return failure('Keine Schreibschnittstelle',405);
  const limit=path==='/api/profile'?850000:100000;
  const size=Number(request.headers.get('content-length')??0);
  if(size>limit)return failure('Konfiguration zu groß',413);
  let value;try{
   const raw=await request.text();
   if(raw.length>limit)return failure('Konfiguration zu groß',413);
   value=JSON.parse(raw);
  }catch{return failure('Ungültige Konfiguration');}
  if(!value||typeof value!=='object'||!('sha' in value)||
     value.sha!==null&&!(typeof value.sha==='string'&&/^[a-f0-9]{40}$/.test(value.sha)))
   return failure('Versionskennung fehlt');
  let document=value.document;
  if(path==='/api/profile'){
   try{document=envelope(FULL_DESCRIPTOR,importProfile(FULL_DESCRIPTOR,document));}
   catch(e){return failure('Ungültiges ALBot-Profil: '+String(e.message).slice(0,240),422);}
  }else{
   const errors=validatePolicyDocument(document);
   if(errors.length)return failure(errors.join('; '),422);
  }
  const current=await github(env,path,'GET',null,fetcher);
  if(current instanceof Response)return current;
  if(current.sha!==value.sha)return failure('Die Konfiguration wurde zwischenzeitlich verändert. Bitte neu laden.',409);
  const s=settings(env);
  const write=await github(env,path,'PUT',{
   message:'config: update ALBot item policy from authenticated Konfigurator',
   branch:s.branch,content:b64(JSON.stringify(document,null,2)+'\n'),
   ...(current.sha?{sha:current.sha}:{})
  },fetcher);
  if(write instanceof Response)return write;
  return json({ok:true,sha:write.sha,commit:write.commit,published:false,applied:false});
 }
 if(path==='/api/health')return json({ok:true,ready:!!(settings(env)&&env.GITHUB_TOKEN&&env.DB),
  remoteRuntime:false,telemetryEnabled:!!(env.DB&&asString(env.INGEST_TOKEN).length>=32),
  telemetryLimits:{minIntervalSeconds:TELEMETRY_MIN_INTERVAL_MS/1000,
   maxCharacters:MAX_STORED_CHARACTERS,maxBankPacks:MAX_STORED_BANK_PACKS},
  message:'GitHub-Speicherung ist unabhängig von einer Ingame-Übernahme.'});
 if(path==='/api/policy'||path==='/api/profile'){
  const current=await github(env,path,'GET',null,fetcher);
  return current instanceof Response?current:json({ok:true,...current,published:false,applied:false});
 }
 if(path==='/api/catalog'||path==='/api/runtime-info'){
  const relative=path==='/api/catalog'?'editor/item-catalog.json':'dist/manifest.json';
  const repository=asString(env.PUBLIC_RUNTIME_REPO)||'Riflex91/ALBot';
  if(!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository))return failure('Ungültiges Runtime-Repository',503);
  const upstream=await fetcher('https://raw.githubusercontent.com/'+repository+'/main/'+relative,
   {headers:{accept:'application/json'}});
  if(!upstream.ok)return failure('Runtime-Informationen sind vorübergehend nicht erreichbar',502);
  const data=await upstream.json();
  if(path==='/api/catalog'){
   if(!Array.isArray(data?.items)||data.items.length>2000||data.items.some(i=>
      typeof i.id!=='string'||!/^[a-zA-Z0-9_]{1,100}$/.test(i.id)||
      typeof i.name!=='string'||i.name.length>180))
    return failure('Itemkatalog ist ungültig',502);
  }
  return json(data);
 }
 if(path==='/api/characters')return readSnapshots(env,'character_snapshots');
 if(path==='/api/bank')return readSnapshots(env,'bank_snapshots');
 if(path.startsWith('/api/'))return failure('Schnittstelle unbekannt',404);
 if(!env.ASSETS)return failure('Weboberfläche noch nicht bereitgestellt',503);
 const result=await env.ASSETS.fetch(request);
 const headers=new Headers(result.headers);
 for(const [k,v] of Object.entries(secureHeaders))headers.set(k,v);
 if(path==='/classic.html'){
  // The original editor ships one validated inline script and stylesheet.
  // Allow their exact build-time hashes, not blanket 'unsafe-inline'.
  const manifestResponse=await env.ASSETS.fetch(new URL('/classic-csp.json',url));
  if(!manifestResponse.ok)return failure('Werkstatt-Sicherheitsmanifest fehlt',503);
  let hashes;try{hashes=await manifestResponse.json();}catch{return failure('Werkstatt-Sicherheitsmanifest ungültig',503);}
  if(!/^[A-Za-z0-9+/]{43}=$/.test(hashes?.script??'')||
     !/^[A-Za-z0-9+/]{43}=$/.test(hashes?.style??''))
   return failure('Werkstatt-CSP-Hashes ungültig',503);
  headers.set('content-security-policy',
   "default-src 'none'; script-src 'self' 'sha256-"+hashes.script+
   "'; style-src 'self' 'sha256-"+hashes.style+
   "'; img-src 'self' data:; connect-src 'self'; font-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
 }
 return new Response(request.method==='HEAD'?null:result.body,{status:result.status,headers});
}
export default {fetch:handleRequest};
