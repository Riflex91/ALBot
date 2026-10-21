import {GAME_ORIGINS,RELAY_READY_TYPE,RELAY_MESSAGE_TYPE,acceptRelayMessage,relayBucket} from './relay-protocol.mjs';
import {TELEMETRY_MIN_INTERVAL_MS} from './free-tier.mjs';

const $=id=>document.getElementById(id);
const state=$('state'),result=$('result'),button=$('activate'),counter=$('counter');
const characterResult=$('character-result'),bankResult=$('bank-result');
let activated=false,successful=0,successfulCharacters=0,successfulBanks=0;
const receivedAt=()=>new Date().toLocaleTimeString('de-DE');
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
 const {packet,serialized}=accepted;
 const bank=packet.kind==='bank';
 const kindResult=bank?bankResult:characterResult;
 const label=bank?'Bank ('+packet.data.pack+')':'Charakter ('+packet.data.name+')';
 const bucket=relayBucket(packet);
 if(!bucket){
  kindResult.textContent=label+': Paketzuordnung ungültig; nicht gesendet.';
  return;
 }
 const now=Date.now();
 const previous=lastAttempt.get(bucket);
 if(previous!==undefined&&now-previous<TELEMETRY_MIN_INTERVAL_MS){
  kindResult.textContent=label+': lokaler Mindestabstand aktiv (120 Sekunden).';
  return;
 }
 lastAttempt.set(bucket,now);
 kindResult.textContent=label+': Snapshot um '+receivedAt()+' empfangen; Cloudflare-Speicherung läuft …';
 try{
  const response=await fetch('/api/relay-ingest',{
   method:'POST',credentials:'same-origin',cache:'no-store',
   headers:{'content-type':'application/json'},body:serialized
  });
  if(!(response.headers.get('content-type')??'').includes('application/json'))
   throw Error('non-json');
  const body=await response.json();
  if(!response.ok||body?.ok!==true){
   const explanation=response.status===429?'D1-Free-Drosselung aktiv (HTTP 429)':
    'Upload abgewiesen (HTTP '+response.status+
    (typeof body?.error==='string'?'; '+body.error.slice(0,120):'')+')';
   kindResult.textContent=label+': '+explanation;
   result.textContent='Letztes Ereignis: '+label+' um '+receivedAt()+' nicht gespeichert.';
   return;
  }
  successful++;
  if(bank)successfulBanks++;else successfulCharacters++;
  counter.textContent='Erfolgreiche Uploads: '+successful+
   ' (Charakter: '+successfulCharacters+'; Bank: '+successfulBanks+')';
  kindResult.textContent=label+': zuletzt erfolgreich um '+receivedAt()+' gespeichert.';
  result.textContent='Letztes Ereignis: '+label+' erfolgreich.';
 }catch{
  kindResult.textContent=label+': Netzwerk-, Anmelde- oder Serverantwortfehler; kein automatischer Retry.';
  result.textContent='Letztes Ereignis: '+label+' um '+receivedAt()+' fehlgeschlagen.';
 }
});
