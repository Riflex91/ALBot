import {FULL_DESCRIPTOR} from '../config/full.mjs';
import {validateProfile} from '../../editor/lib/contract.mjs';

// Separate game-side verification, independent of the Worker signer.
// This code only previews a verified revision: NEVER mutates ALBotConfig,
// bot.cfg, a journal, or reports an applied/acknowledged configuration.
const CONFIG_PREVIEW_URL='https://albot-konfigurator.hansijuergenlul.workers.dev/config-sync.html';
const CONFIG_PREVIEW_ORIGIN='https://albot-konfigurator.hansijuergenlul.workers.dev';
const CONFIG_PREVIEW_LIMIT=950000;
const CONFIG_PREVIEW_NONCE=/^[a-f0-9]{32}$/;
const CONFIG_PREVIEW_HEX=/^[a-f0-9]{64}$/;
const CONFIG_PREVIEW_B64=/^[A-Za-z0-9_-]{86}$/;
const CONFIG_PREVIEW_TARGET=/^[A-Za-z0-9_.:/-]{1,128}$/;
const CONFIG_PREVIEW_ENC=new TextEncoder();

function configPreviewCanonical(x,depth=0,seen=new Set(),counter={n:0}){
 if(depth>32||++counter.n>150000)throw Error('Config canonical bounds exceeded');
 if(x===null||typeof x==='string'||typeof x==='boolean')return JSON.stringify(x);
 if(typeof x==='number'&&Number.isFinite(x))return JSON.stringify(x);
 if(!x||typeof x!=='object'||seen.has(x))throw Error('Invalid config object');
 seen.add(x);let output;
 if(Array.isArray(x))output='['+x.map(v=>configPreviewCanonical(v,depth+1,seen,counter)).join(',')+']';
 else{
  if(Object.getPrototypeOf(x)!==Object.prototype&&Object.getPrototypeOf(x)!==null)
   throw Error('Invalid profile prototype');
  const fields=[];
  for(const key of Object.keys(x).sort()){
   if(['__proto__','constructor','prototype'].includes(key)||x[key]===undefined)
    throw Error('Invalid profile property');
   fields.push(JSON.stringify(key)+':'+configPreviewCanonical(x[key],depth+1,seen,counter));
  }
  output='{'+fields.join(',')+'}';
 }
 seen.delete(x);
 return output;
}
function configPreviewMessage(release){
 return 'ALBOT-CONFIG-RELEASE-V1\\n'+JSON.stringify([
  release.format,release.schemaId,release.target,release.sequence,
  release.issuedAt,release.expiresAt,release.sha256
 ]);
}
export async function configPreviewVerify(release,pinned,target,minSequence,t,subtle){
 if(!pinned||pinned.kty!=='EC'||pinned.crv!=='P-256'||
  !/^[A-Za-z0-9_-]{43}$/.test(pinned.x??'')||
  !/^[A-Za-z0-9_-]{43}$/.test(pinned.y??'')||pinned.d!==undefined||
  !release||release.format!=='albot-config-release/v1'||
  release.schemaId!=='albot.full/v1'||release.target!==target||
  !Number.isSafeInteger(release.sequence)||release.sequence<=minSequence||
  !Number.isSafeInteger(release.issuedAt)||release.issuedAt>t||
  !Number.isSafeInteger(release.expiresAt)||release.expiresAt<=t||
  release.expiresAt-release.issuedAt>7*86400000||
  !CONFIG_PREVIEW_HEX.test(release.sha256??'')||
  !CONFIG_PREVIEW_B64.test(release.signature??''))
  throw Error('Config signature preconditions failed');
 const profile=release.profile;
 if(!profile||profile.format!=='albot-profile'||profile.formatVersion!==1||
  profile.schemaId!=='albot.full/v1'||!profile.config||
  typeof profile.config!=='object'||Array.isArray(profile.config))
  throw Error('Invalid complete config profile');
 const bytes=CONFIG_PREVIEW_ENC.encode(configPreviewCanonical(profile));
 if(bytes.byteLength>850000)throw Error('Signed profile too large');
 const digest=Array.from(new Uint8Array(await subtle.digest('SHA-256',bytes)),
  n=>n.toString(16).padStart(2,'0')).join('');
 if(digest!==release.sha256)throw Error('Signed profile digest mismatch');
 const raw=release.signature.replace(/-/g,'+').replace(/_/g,'/');
 const signature=Uint8Array.from(atob(raw+'='.repeat((4-raw.length%4)%4)),
  c=>c.charCodeAt(0));
 if(signature.length!==64)throw Error('Invalid signature length');
 const key=await subtle.importKey('jwk',pinned,
  {name:'ECDSA',namedCurve:'P-256'},false,['verify']);
 if(!(await subtle.verify({name:'ECDSA',hash:'SHA-256'},key,signature,
  CONFIG_PREVIEW_ENC.encode(configPreviewMessage(release)))))
  throw Error('Signed profile signature mismatch');
 const errors=validateProfile(FULL_DESCRIPTOR,profile.config);
 if(errors.length)throw Error('Full-v1 profile validation failed');
 return {sequence:release.sequence,sha256:digest};
}

export function createConfigSyncPreview({
 gameWindow,cryptoObject,readTrust,readStorage,staging=null,now=()=>Date.now()
}={}){
 if(!gameWindow||typeof gameWindow.open!=='function'||
  typeof gameWindow.addEventListener!=='function'||
  typeof gameWindow.removeEventListener!=='function'||
  typeof readTrust!=='function'||typeof readStorage!=='function'||
  typeof now!=='function'||staging!==null&&
   (typeof staging.stage!=='function'||typeof staging.status!=='function'||
    typeof staging.dispose!=='function'))
  throw Error('Config preview requires an actual browser');
 let popup=null,nonce=null,asked=false,consumed=false,disposed=false;
 let verified=null,error=null,inFlight=false;
 const prepared=()=>{
  const trust=readTrust();
  if(!trust||typeof trust!=='object'||!trust.publicJwk||
   !CONFIG_PREVIEW_TARGET.test(trust.target??'')||
   typeof cryptoObject?.getRandomValues!=='function'||
   typeof cryptoObject?.subtle?.verify!=='function')
   throw Error('Independent pinned P-256 key and account target required');
  return trust;
 };
 function appliedCursor(target){
  const storage=readStorage();
  if(!storage||typeof storage.getItem!=='function')
   throw Error('Durable local rollback journal unavailable');
  const raw=storage.getItem('albot:config:applied:v1:'+target);
  if(raw===null)return 0;
  if(typeof raw!=='string'||raw.length>512)throw Error('Rollback journal corrupted');
  let obj;try{obj=JSON.parse(raw);}catch{throw Error('Rollback journal corrupted');}
  if(!obj||obj.target!==target||!Number.isSafeInteger(obj.sequence)||
   obj.sequence<1||!CONFIG_PREVIEW_HEX.test(obj.sha256??''))
   throw Error('Rollback journal corrupted');
  return obj.sequence;
 }
 const hasPopup=()=>{
  if(disposed||!popup)return false;
  try{return popup.closed!==true;}catch{return false;}
 };
 const listener=async event=>{
  if(disposed||consumed||!hasPopup()||
   event.source!==popup||event.origin!==CONFIG_PREVIEW_ORIGIN)return;
  if(event.data?.type==='albot.config.ready.v1'&&!asked){
   asked=true;
   try{popup.postMessage({type:'albot.config.request.v1',nonce},CONFIG_PREVIEW_ORIGIN);}
   catch{error='No verified browser request possible';}
   return;
  }
  if(inFlight||!asked)return;
  const d=event.data;
  if(!d||typeof d!=='object'||Array.isArray(d)||
   !CONFIG_PREVIEW_NONCE.test(d.nonce??'')||d.nonce!==nonce||
   !['albot.config.release.v1','albot.config.error.v1'].includes(d.type))return;
  asked=false;consumed=true;
  if(d.type==='albot.config.error.v1'){
   error=typeof d.message==='string'?d.message.slice(0,120):'delivery-failed';
   return;
  }
  if(!d.release||typeof d.release!=='object'||Array.isArray(d.release))return;
  try{if(JSON.stringify(d.release).length>CONFIG_PREVIEW_LIMIT)return;}
  catch{return;}
  inFlight=true;
  try{
   const trust=prepared(),applied=appliedCursor(trust.target);
   const checked=await configPreviewVerify(d.release,trust.publicJwk,
    trust.target,applied,now(),cryptoObject.subtle);
   if(staging&&!(await staging.stage(d.release)))
    throw Error('Character staging rejected: '+(staging.status().lastError??'unavailable'));
   // Staging never applies the profile; only an account/character-scoped
   // receipt exists, and the private release stays in ephemeral memory.
   verified={...checked,target:trust.target,verifiedAt:now(),
    expiresAt:d.release.expiresAt,
    pinnedX:trust.publicJwk.x,pinnedY:trust.publicJwk.y,applied:false};
   error=null;
  }catch(e){
   verified=null;error=String(e?.message??e).slice(0,140);
  }finally{inFlight=false;}
 };
 gameWindow.addEventListener('message',listener);
 function open(){
  if(disposed||hasPopup())return false;
  try{
   const trust=prepared();appliedCursor(trust.target);
   if(staging&&!staging.status().configured)
    throw Error('Character staging unavailable: '+(staging.status().reason??'storage'));
  }catch(e){error=String(e?.message??e).slice(0,140);return false;}
  try{
   const bytes=new Uint8Array(16);
   cryptoObject.getRandomValues(bytes);
   nonce=[...bytes].map(n=>n.toString(16).padStart(2,'0')).join('');
  }catch(e){error=String(e?.message??e).slice(0,140);return false;}
  asked=false;consumed=false;verified=null;error=null;
  try{popup=gameWindow.open(CONFIG_PREVIEW_URL,'_blank','width=760,height=750');}
  catch{popup=null;}
  return hasPopup();
 }
 const status=()=>{
  // Querying staging revalidates current trust, local journal, character and
  // TTL without leaking signed profile or runtime configuration bytes.
  const stagedStatus=staging?.status()??null;
  let ready=false,reason=null,appliedHighwater=null,currentTrust=null;
  try{const t=prepared();currentTrust=t;
   appliedHighwater=appliedCursor(t.target);ready=true;}
  catch(e){reason=String(e?.message??e).slice(0,140);}
  // A preview is not a standing authorization. Expiration, a changed trust
  // pin, a newer applied cursor, or an unreadable journal invalidates it.
  if(verified&&(now()>=verified.expiresAt||!ready||
    verified.target!==currentTrust?.target||
    verified.pinnedX!==currentTrust?.publicJwk.x||
    verified.pinnedY!==currentTrust?.publicJwk.y||
    appliedHighwater===null||appliedHighwater>=verified.sequence||
    staging&&(!stagedStatus?.staged?.memoryVerified||
     stagedStatus.staged.sequence!==verified.sequence||
     stagedStatus.staged.sha256!==verified.sha256))){
   verified=null;
   error='Verified preview expired or invalidated; reopen the signed preview';
  }
  return {mode:staging?'verified-stage-only':'preview-only',
   configured:ready&&(!staging||stagedStatus?.configured===true),
   reason:ready&&staging&&!stagedStatus?.configured?stagedStatus?.reason:reason,
   opened:hasPopup(),inFlight,verified:verified?{...verified}:null,
   staged:stagedStatus?.staged??null,stageInFlight:stagedStatus?.inFlight??false,
   appliedHighwater,lastError:error,readyForActivation:false,
   applied:false,acknowledged:false,disposed};
 };
 function dispose(){
  if(disposed)return;
  disposed=true;popup=null;nonce=null;asked=false;consumed=true;verified=null;
  gameWindow.removeEventListener('message',listener);
  staging?.dispose();
 }
 return {open,status,dispose};
}
