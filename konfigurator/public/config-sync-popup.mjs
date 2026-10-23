import {GAME_ORIGINS} from './relay-protocol.mjs';
import {CONFIG_READY,CONFIG_RELEASE,CONFIG_ERROR,CONFIG_MAX_MESSAGE_CHARS,
 gameRequest} from './config-sync-protocol.mjs';

const state=document.getElementById('state');
const button=document.getElementById('activate');
let started=false,requested=false;
if(!window.opener){
 button.disabled=true;
 state.textContent='Kein öffnendes Adventure-Land-Fenster vorhanden.';
}
button.addEventListener('click',()=>{
 if(started||!window.opener)return;
 started=true;button.disabled=true;
 state.textContent='Freigabe erteilt. Prüfe die authentifizierte Spielanfrage …';
 // No private data is included in the handshake.
 for(const origin of GAME_ORIGINS){
  try{window.opener.postMessage({type:CONFIG_READY},origin);}catch{}
 }
});
window.addEventListener('message',async event=>{
 if(!started||requested)return;
 const incoming=gameRequest(event,window.opener);
 if(!incoming)return;
 requested=true;
 const reply=(type,fields={})=>{
  try{incoming.source.postMessage({type,nonce:incoming.nonce,...fields},incoming.origin);}
  catch{state.textContent='Antwort an das Spiel-Fenster nicht möglich.';}
 };
 try{
  state.textContent='Lade ausschließlich die signierte private Revision …';
  const response=await fetch('/api/profile-sync/delivery',{
   method:'GET',credentials:'same-origin',cache:'no-store',
   redirect:'error',referrerPolicy:'no-referrer'
  });
  if(!(response.headers.get('content-type')??'').includes('application/json'))
   throw Error('Cloudflare-Anmeldung oder JSON-Antwort fehlt');
  const body=await response.json();
  if(!response.ok||body?.ok!==true||
   body.format!=='albot-config-delivery/v1'||!body.release)
   throw Error(response.status===404?'Kein signierter Release vorhanden':
    'Signierter Release nicht abrufbar (HTTP '+response.status+')');
  if(JSON.stringify(body.release).length>CONFIG_MAX_MESSAGE_CHARS)
   throw Error('Signierter Release überschreitet die Größenbegrenzung');
  reply(CONFIG_RELEASE,{release:body.release});
  state.textContent='Signierter Release an das Spielfenster übergeben. Die Ingame-Signaturprüfung entscheidet über die Annahme. Es wurde nichts aktiviert.';
 }catch(error){
  const message=String(error?.message??'Unbekannter Fehler').slice(0,120);
  reply(CONFIG_ERROR,{message});
  state.textContent='Keine Übergabe: '+message;
 }
});
