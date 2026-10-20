import {GAME_ORIGINS,RELAY_READY_TYPE,RELAY_MESSAGE_TYPE,acceptRelayMessage,relayBucket} from './relay-protocol.mjs';
import {TELEMETRY_MIN_INTERVAL_MS} from './free-tier.mjs';

const $=id=>document.getElementById(id);
const state=$('state'),result=$('result'),button=$('activate'),counter=$('counter');
let activated=false,successful=0;
const lastAttempt=new Map();
if(!window.opener){
 button.disabled=true;
 state.textContent='Kein öffnendes Adventure-Land-Fenster erkannt. Starte dieses Relay aus deinem Spielfenster.';
}
button.addEventListener('click',()=>{
 if(activated||!window.opener)return;
 activated=true;button.disabled=true;
 state.textContent='Empfang aktiviert. Warte auf Spiel-Snapshots.';
 // A ready signal carries no credentials or game data. The browser delivers
 // only to the matching target origin, never to an arbitrary opener.
 for(const origin of GAME_ORIGINS){
  try{window.opener.postMessage({type:RELAY_READY_TYPE},origin);}catch{}
 }
});
window.addEventListener('message',async event=>{
 if(!activated)return;
 const accepted=acceptRelayMessage(event,window.opener);
 if(!accepted){
  if(event.data?.type===RELAY_MESSAGE_TYPE&&GAME_ORIGINS.includes(event.origin))
   result.textContent='Spiel-Nachricht erkannt, aber Fensterzuordnung oder Datenformat ungültig.';
  return;
 }
 result.textContent='Spiel-Snapshot empfangen. Prüfe Cloudflare-Speicherung …';
 const bucket=relayBucket(accepted.packet);
 if(!bucket)return;
 const now=Date.now();
 const previous=lastAttempt.get(bucket);
 // Throttle *attempts*, including network failures/HTTP 429. No retry loop.
 if(previous!==undefined&&now-previous<TELEMETRY_MIN_INTERVAL_MS){
  result.textContent='Wartezeit aktiv: erneuter Upload frühestens nach 120 Sekunden.';
  return;
 }
 lastAttempt.set(bucket,now);
 try{
  const response=await fetch('/api/relay-ingest',{
   method:'POST',credentials:'same-origin',cache:'no-store',
   headers:{'content-type':'application/json'},body:accepted.serialized
  });
  if(!(response.headers.get('content-type')??'').includes('application/json'))
   throw Error('Access-Anmeldung abgelaufen oder unerwartete Antwort');
  const body=await response.json();
  if(!response.ok||body?.ok!==true){
   result.textContent=response.status===429?
    'D1-Free-Drosselung aktiv. Bitte mindestens 120 Sekunden warten.':
    'Upload abgewiesen (HTTP '+response.status+').';
   return;
  }
  successful++;
  counter.textContent='Erfolgreiche Uploads: '+successful;
  result.textContent='Letzter erfolgreicher Upload: '+new Date().toLocaleTimeString('de-DE')+
   ' ('+(accepted.packet.kind==='bank'?'Bankpack':'Charakter')+').';
 }catch{
  result.textContent='Netzwerk- oder Anmeldefehler. Kein automatischer Retry.';
 }
});
