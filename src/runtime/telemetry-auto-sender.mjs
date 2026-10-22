import {observedCharacterTelemetry,observedBankTelemetry} from './telemetry-snapshot.mjs';

// Automatic read-only telemetry. No popup, no per-session confirmation.
// The caller supplies a write-only telemetry credential from its PRIVATE CODE
// slot; the public signed runtime, profile, dashboard and logs contain none.
// This is the existing token-protected /api/ingest, not the Access dashboard.
export const ALBOT_AUTO_TELEMETRY_URL='https://albot-konfigurator.hansijuergenlul.workers.dev/api/ingest';
export const AUTO_TELEMETRY_INTERVAL_MS=120_000;
export const AUTO_TELEMETRY_TIMEOUT_MS=15_000;
const AUTO_TELEMETRY_MAX_BYTES=32_768;
const AUTO_BANK_OBSERVE_INTERVAL_MS=250;
const AUTO_MAX_PENDING_BANK_PACKS=24;
const BANK_MAPS=new Set(['bank','bank_b','bank_u']);
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
 let disposed=false,inFlight=false,activeController=null;
 // A bounded, in-memory queue retains *observed* bank packs after a short visit.
 // Never infer unvisited packs or persist bank contents or credentials.
 const pendingBank=new Map(),seenInVisit=new Map();
 let bankVisitMap=null,lastBankScan=null,lastBankCapture=null;
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
   lastCharacter,lastBank,lastCharacterSuccess,lastBankSuccess,lastResult,lastError,
   lastBankCapture,pendingBankPacks:pendingBank.size};
 };
 // Capture only complete packs observed on the actual bank map. A revisit,
 // or a change to a loaded pack, is new evidence; unchanged tick samples are not.
 // This is deliberately a read-only observation, not a bank action.
 function observeBank(){
  if(disposed||role!=='merchant'||!isRunning())return false;
  let character,t;
  try{character=getCharacter();t=now();}catch{return false;}
  if(!validTime(t))return false;
  const map=character?.map;
  if(!BANK_MAPS.has(map)){
   bankVisitMap=null;seenInVisit.clear();lastBankScan=null;
   return false;
  }
  if(bankVisitMap!==map){
   bankVisitMap=map;seenInVisit.clear();lastBankScan=null;
  }
  if(lastBankScan!==null&&t-lastBankScan<AUTO_BANK_OBSERVE_INTERVAL_MS)return false;
  lastBankScan=t;
  let packs;
  try{packs=observedBankTelemetry(character,getRealm(),getBankDefinitions());}
  catch{return false;}
  for(const packet of packs){
   const pack=packet.data.pack;
   // Fingerprints contain inventory observations only and never leave this sender.
   const fingerprint=JSON.stringify(packet.data);
   if(seenInVisit.get(pack)===fingerprint)continue;
   if(!pendingBank.has(pack)&&pendingBank.size>=AUTO_MAX_PENDING_BANK_PACKS)continue;
   seenInVisit.set(pack,fingerprint);
   pendingBank.set(pack,packet);
   lastBankCapture=t;
  }
  return pendingBank.size>0&&!inFlight&&
   (lastBank===null||t-lastBank>=AUTO_TELEMETRY_INTERVAL_MS);
 }
 async function sendOnce(){
  const result={character:false,bank:false};
  if(disposed||inFlight||!isRunning())return result;
  let key;
  try{key=getCredential();}catch{return result;}
  if(!validKey(key)){fail('credential-missing');return result;}
  // Try to capture the first bank observation even before the next game tick.
  // A missing bank snapshot must NOT consume the bank's 120-second send slot.
  observeBank();
  const t=now();
  if(!validTime(t))return result;
  const sendCharacter=lastCharacter===null||t-lastCharacter>=AUTO_TELEMETRY_INTERVAL_MS;
  const sendBank=role==='merchant'&&pendingBank.size>0&&
   (lastBank===null||t-lastBank>=AUTO_TELEMETRY_INTERVAL_MS);
  if(!sendCharacter&&!sendBank)return result;
  const packets=[];
  // Mark only real attempts. Retain queued bank evidence until accepted.
  if(sendCharacter){
   lastCharacter=t;
   try{const packet=observedCharacterTelemetry(getCharacter(),getRealm());
    if(packet)packets.push(packet);}catch{}
  }
  if(sendBank){
   lastBank=t;
   packets.push(pendingBank.values().next().value);
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
      if(packet.kind==='bank'){
       lastBankSuccess=t;
       // Do not discard a newer observation captured during this request.
       if(pendingBank.get(packet.data.pack)===packet)pendingBank.delete(packet.data.pack);
      }else lastCharacterSuccess=t;
      lastResult=packet.kind+'-success';lastError=null;
     }else fail(packet.kind+'-rejected-'+(Number.isInteger(response.status)?response.status:'unknown'));
    }catch{fail(packet.kind+'-network-error');}
    finally{if(timeout!==null)clearTimeout(timeout);
     if(activeController===controller)activeController=null;}
   }
  }finally{
   inFlight=false;
   // A bank snapshot might have been observed while a character upload was
   // in flight. Flush it immediately when eligible, even after leaving bank.
   if(!disposed&&pendingBank.size&&isRunning()&&
      (lastBank===null||now()-lastBank>=AUTO_TELEMETRY_INTERVAL_MS))
    void sendOnce();
  }
  return result;
 }
 return {sendOnce,observeBank,status,dispose(){
  disposed=true;activeController?.abort();pendingBank.clear();seenInVisit.clear();
 }};
}
