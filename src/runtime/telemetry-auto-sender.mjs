import {observedCharacterTelemetry,observedBankTelemetry} from './telemetry-snapshot.mjs';

// Automatic read-only telemetry. No popup, no per-session confirmation.
// The caller supplies a write-only telemetry credential from its PRIVATE CODE
// slot; the public signed runtime, profile, dashboard and logs contain none.
// This is the existing token-protected /api/ingest, not the Access dashboard.
export const ALBOT_AUTO_TELEMETRY_URL='https://albot-konfigurator.hansijuergenlul.workers.dev/api/ingest';
export const AUTO_TELEMETRY_INTERVAL_MS=120_000;
export const AUTO_TELEMETRY_TIMEOUT_MS=15_000;
const AUTO_TELEMETRY_MAX_BYTES=32_768;
const validKey=value=>typeof value==='string'&&value.length>=32&&value.length<=256&&
 /^[\x21-\x7e]+$/.test(value)&&!value.includes(':')&&!value.includes('\\');
const validTime=t=>Number.isSafeInteger(t)&&t>=0;
export function createAutomaticTelemetrySender({
 fetcher,getCredential,getCharacter,getRealm,getBankDefinitions,
 role='farmer',isRunning=()=>true,now=()=>Date.now()
}={}){
 if([fetcher,getCredential,getCharacter,getRealm,getBankDefinitions,isRunning,now]
   .some(f=>typeof f!=='function'))
  throw Error('Automatic telemetry requires private credentials and read-only providers');
 let disposed=false,bankIndex=0,inFlight=false,activeController=null;
 let lastCharacter=null,lastBank=null,lastCharacterSuccess=null,lastBankSuccess=null;
 let lastResult='not-started',lastError=null;
 const fail=value=>{lastResult=value;lastError=value;};
 const status=()=>{
  let configured=false;
  try{configured=validKey(getCredential());}catch{}
  return {mode:'automatic',configured,
   disposed,inFlight,intervalMs:AUTO_TELEMETRY_INTERVAL_MS,
   lastAttempt:lastCharacter===null?lastBank:lastBank===null?lastCharacter:
    Math.max(lastCharacter,lastBank),
   lastCharacter,lastBank,lastCharacterSuccess,lastBankSuccess,lastResult,lastError};
 };
 async function sendOnce(){
  const result={character:false,bank:false};
  if(disposed||inFlight||!isRunning())return result;
  let key;
  try{key=getCredential();}catch{return result;}
  if(!validKey(key)){fail('credential-missing');return result;}
  const t=now();
  if(!validTime(t))return result;
  const sendCharacter=lastCharacter===null||t-lastCharacter>=AUTO_TELEMETRY_INTERVAL_MS;
  const sendBank=role==='merchant'&&(lastBank===null||t-lastBank>=AUTO_TELEMETRY_INTERVAL_MS);
  if(!sendCharacter&&!sendBank)return result;
  const packets=[];
  // Mark attempts before any async work. Never retry failures aggressively.
  if(sendCharacter){
   lastCharacter=t;
   try{const packet=observedCharacterTelemetry(getCharacter(),getRealm());
    if(packet)packets.push(packet);}catch{}
  }
  if(sendBank){
   lastBank=t;
   try{
    const packs=observedBankTelemetry(getCharacter(),getRealm(),getBankDefinitions());
    if(packs.length){packets.push(packs[bankIndex%packs.length]);bankIndex++;}
   }catch{}
  }
  if(!packets.length){fail('no-valid-snapshot');return result;}
  inFlight=true;
  try{
   for(const packet of packets){
    if(disposed)break;
    let body;
    try{body=JSON.stringify(packet);}catch{continue;}
    if(body.length>AUTO_TELEMETRY_MAX_BYTES){fail('packet-too-large');continue;}
    // Bound each browser request; an indefinitely pending fetch must never
    // prevent later 120-second cycles or retain a stale CODE-frame sender.
    const controller=typeof AbortController==='function'?new AbortController():null;
    if(controller)activeController=controller;
    const timeout=controller?setTimeout(()=>controller.abort(),AUTO_TELEMETRY_TIMEOUT_MS):null;
    try{
     const response=await fetcher(ALBOT_AUTO_TELEMETRY_URL,{
      method:'POST',mode:'cors',credentials:'omit',cache:'no-store',
      redirect:'error',referrerPolicy:'no-referrer',
      headers:{'content-type':'application/json',authorization:'Bearer '+key},
      ...(controller?{signal:controller.signal}:{}),
      body
     });
     const payload=response.ok&&
      (response.headers?.get('content-type')??'').includes('application/json')?
      await response.json():null;
     if(response.ok&&payload?.ok===true){
      result[packet.kind]=true;
      if(packet.kind==='bank')lastBankSuccess=t;else lastCharacterSuccess=t;
      lastResult=packet.kind+'-success';
     }else fail(packet.kind+'-rejected-'+(Number.isInteger(response.status)?response.status:'unknown'));
    }catch{fail(packet.kind+'-network-error');}
    finally{if(timeout!==null)clearTimeout(timeout);
     if(activeController===controller)activeController=null;}
   }
  }finally{inFlight=false;}
  return result;
 }
 return {sendOnce,status,dispose(){disposed=true;activeController?.abort();}};
}
