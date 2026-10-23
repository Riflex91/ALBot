import {FULL_DESCRIPTOR} from '../config/full.mjs';
import {validateProfile} from '../../editor/lib/contract.mjs';
import {verifySignedConfigRelease} from '../../konfigurator/public/config-sync-contract.mjs';
import {CONFIG_POPUP_URL,CONFIG_POPUP_ORIGIN,CONFIG_READY,CONFIG_REQUEST,
 CONFIG_RELEASE,CONFIG_ERROR,popupResponse,generateSyncNonce}
 from '../../konfigurator/public/config-sync-protocol.mjs';

// A conservative READ-ONLY preview bridge, not a runtime configuration updater.
// A trusted key/target must be pinned in the user's personal CODE, never from
// the popup or network. No ACK falsely claims application of this profile.
export function createConfigSyncPreview({
 gameWindow,cryptoObject,readTrust,readStorage,now=()=>Date.now()
}={}){
 if(!gameWindow||typeof gameWindow.open!=='function'||
  typeof gameWindow.addEventListener!=='function'||
  typeof gameWindow.removeEventListener!=='function'||
  typeof readTrust!=='function'||typeof readStorage!=='function'||
  typeof now!=='function')throw Error('Config preview requires an actual browser');
 let popup=null,nonce=null,asked=false,disposed=false,verified=null,error=null,inFlight=false;
 const prepared=()=>{
  const trust=readTrust();
  if(!trust||typeof trust!=='object'||!trust.publicJwk||typeof trust.target!=='string'||
   !/^[A-Za-z0-9_.:/-]{1,128}$/.test(trust.target)||
   typeof cryptoObject?.getRandomValues!=='function'||
   typeof cryptoObject?.subtle?.verify!=='function')
   throw Error('Independently pinned P-256 key and account target are required');
  return trust;
 };
 function appliedCursor(target){
  // Failure to read or parse this record must deny the preview rather than
  // silently interpreting a corrupted high-water mark as sequence zero.
  const storage=readStorage();
  if(!storage||typeof storage.getItem!=='function')
   throw Error('Durable local rollback journal unavailable');
  const raw=storage.getItem('albot:config:applied:v1:'+target);
  if(raw===null)return 0;
  if(typeof raw!=='string'||raw.length>512)throw Error('Rollback journal corrupted');
  let obj;try{obj=JSON.parse(raw);}catch{throw Error('Rollback journal corrupted');}
  if(!obj||obj.target!==target||!Number.isSafeInteger(obj.sequence)||
   obj.sequence<1||!/^[a-f0-9]{64}$/.test(obj.sha256??''))
   throw Error('Rollback journal corrupted');
  return obj.sequence;
 }
 const hasPopup=()=>{
  if(disposed||!popup)return false;
  try{return popup.closed!==true;}catch{return false;}
 };
 const listener=async event=>{
  if(disposed||!hasPopup()||event.source!==popup||event.origin!==CONFIG_POPUP_ORIGIN)return;
  if(event.data?.type===CONFIG_READY&&!asked){
   asked=true;
   try{popup.postMessage({type:CONFIG_REQUEST,nonce},CONFIG_POPUP_ORIGIN);}
   catch{error='Keine bestätigte Spielanfrage möglich';}
   return;
  }
  if(inFlight||!asked)return;
  const response=popupResponse(event,popup,nonce);
  if(!response)return;
  asked=false;
  if(response.error){error=response.error;return;}
  inFlight=true;
  try{
   const trust=prepared();
   const applied=appliedCursor(trust.target);
   const verifiedRelease=await verifySignedConfigRelease(response.release,{
    pinnedPublicJwk:trust.publicJwk,target:trust.target,
    minimumSequence:applied,now:now(),subtle:cryptoObject.subtle
   });
   if(!response.release.profile||response.release.profile.schemaId!==FULL_DESCRIPTOR.schemaId)
    throw Error('Unexpected profile schema');
   const errors=validateProfile(FULL_DESCRIPTOR,response.release.profile.config);
   if(errors.length)throw Error('Full-v1 schema validation rejected the signed profile');
   // Only metadata are retained. No profile is persisted, applied or ACKed.
   verified={sequence:verifiedRelease.sequence,sha256:verifiedRelease.sha256,
    target:trust.target,verifiedAt:now(),applied:false};
   error=null;
  }catch(e){
   verified=null;
   error=String(e?.message??e).slice(0,140);
  }finally{inFlight=false;}
 };
 gameWindow.addEventListener('message',listener);
 function open(){
  if(disposed||hasPopup())return false;
  try{const trust=prepared();appliedCursor(trust.target);}
  catch(e){error=String(e?.message??e).slice(0,140);return false;}
  try{nonce=generateSyncNonce(cryptoObject);}
  catch(e){error=String(e?.message??e).slice(0,140);return false;}
  asked=false;verified=null;error=null;
  try{popup=gameWindow.open(CONFIG_POPUP_URL,'_blank','width=760,height=750');}
  catch{popup=null;}
  return hasPopup();
 }
 const status=()=>{
  let ready=false,reason=null,appliedHighwater=null;
  try{const t=prepared();appliedHighwater=appliedCursor(t.target);ready=true;}
  catch(e){reason=String(e?.message??e).slice(0,140);}
  return {mode:'preview-only',configured:ready,reason,opened:hasPopup(),
   inFlight,verified:verified?{...verified}:null,appliedHighwater,
   lastError:error,applied:false,acknowledged:false,disposed};
 };
 function dispose(){
  if(disposed)return;
  disposed=true;popup=null;nonce=null;asked=false;verified=null;
  gameWindow.removeEventListener('message',listener);
 }
 return {open,status,dispose};
}
