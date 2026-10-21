import {observedCharacterTelemetry,observedBankTelemetry} from './telemetry-snapshot.mjs';

// Automatic read-only telemetry. No popup, no per-session confirmation.
// The caller supplies a write-only telemetry credential from its PRIVATE CODE
// slot; the public signed runtime, profile, dashboard and logs contain none.
// This is the existing token-protected /api/ingest, not the Access dashboard.
export const ALBOT_AUTO_TELEMETRY_URL='https://albot-konfigurator.hansijuergenlul.workers.dev/api/ingest';
export const AUTO_TELEMETRY_INTERVAL_MS=120_000;
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
 let disposed=false,bankIndex=0,inFlight=false;
 let lastCharacter=null,lastBank=null,lastCharacterSuccess=null,lastBankSuccess=null;
 let lastResult='not-started';
 const status=()=>({mode:'automatic',configured:validKey(getCredential()),
  disposed,inFlight,intervalMs:AUTO_TELEMETRY_INTERVAL_MS,
  lastCharacter,lastBank,lastCharacterSuccess,lastBankSuccess,lastResult});
 async function sendOnce(){
  const result={character:false,bank:false};
  if(disposed||inFlight||!isRunning())return result;
  let key;
  try{key=getCredential();}catch{return result;}
  if(!validKey(key)){lastResult='credential-missing';return result;}
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
  if(!packets.length){lastResult='no-valid-snapshot';return result;}
  inFlight=true;
  try{
   for(const packet of packets){
    if(disposed)break;
    let body;
    try{body=JSON.stringify(packet);}catch{continue;}
    if(body.length>AUTO_TELEMETRY_MAX_BYTES){lastResult='packet-too-large';continue;}
    try{
     const response=await fetcher(ALBOT_AUTO_TELEMETRY_URL,{
      method:'POST',mode:'cors',credentials:'omit',cache:'no-store',
      redirect:'error',referrerPolicy:'no-referrer',
      headers:{'content-type':'application/json',authorization:'Bearer '+key},
      body
     });
     const payload=response.ok&&
      (response.headers?.get('content-type')??'').includes('application/json')?
      await response.json():null;
     if(response.ok&&payload?.ok===true){
      result[packet.kind]=true;
      if(packet.kind==='bank')lastBankSuccess=t;else lastCharacterSuccess=t;
      lastResult=packet.kind+'-success';
     }else lastResult=packet.kind+'-rejected-'+(Number.isInteger(response.status)?response.status:'unknown');
    }catch{lastResult=packet.kind+'-network-error';}
   }
  }finally{inFlight=false;}
  return result;
 }
 return {sendOnce,status,dispose(){disposed=true;}};
}
