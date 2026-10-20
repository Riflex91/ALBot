import {observedCharacterTelemetry,observedBankTelemetry} from './telemetry-snapshot.mjs';

// Staged game-side, READ-ONLY bridge. Not included in the signed runtime yet.
// Opening the popup must be a direct user gesture; do not auto-open on game ticks.
export const ALBOT_RELAY_URL='https://albot-konfigurator.hansijuergenlul.workers.dev/relay.html';
export const GAME_RELAY_INTERVAL_MS=120_000;
const ALBOT_TELEMETRY_MESSAGE='albot.telemetry.v1';
const ALBOT_TELEMETRY_READY='albot.relay.ready.v1';
const ALBOT_RELAY_MAX_CHARS=32_768;
const telemetryTimeValid=value=>Number.isSafeInteger(value)&&value>=0;
export function createGameRelaySender({
 gameWindow,getCharacter,getRealm,getBankDefinitions,role='farmer',
 now=()=>Date.now(),relayUrl=ALBOT_RELAY_URL,onReady=()=>{}
}={}){
 if(!gameWindow||typeof gameWindow.addEventListener!=='function'||
    typeof gameWindow.removeEventListener!=='function'||
    typeof gameWindow.open!=='function'||
    [getCharacter,getRealm,getBankDefinitions,now,onReady].some(x=>typeof x!=='function'))
  throw Error('Game relay requires explicit browser and read-only data providers');
 const url=new URL(relayUrl),canonical=new URL(ALBOT_RELAY_URL);
 if(url.origin!==canonical.origin||url.pathname!=='/relay.html'||
    url.search||url.hash)throw Error('Unapproved ALBot relay destination');
 let popup=null,ready=false,closed=false,bankIndex=0;
 let lastCharacter=null,lastBank=null;
 function hasWindow(){
  if(closed||!popup)return false;
  try{return popup.closed!==true;}catch{return false;}
 }
 const listener=event=>{
  if(closed||!hasWindow()||event.source!==popup||
     event.origin!==url.origin||event.data?.type!==ALBOT_TELEMETRY_READY)return;
  if(ready)return; // No duplicate handshakes or re-entry.
  ready=true;
  try{onReady();}catch{}
 };
 gameWindow.addEventListener('message',listener);
 function open(){
  if(closed)return false;
  if(hasWindow())return true;
  ready=false;
  popup=gameWindow.open(url.href,'_blank','width=800,height=850');
  return hasWindow();
 }
 function post(packet){
  if(!hasWindow()||!ready||!packet)return false;
  let body;try{body=JSON.stringify(packet);}catch{return false;}
  if(body.length>ALBOT_RELAY_MAX_CHARS)return false;
  try{popup.postMessage({type:ALBOT_TELEMETRY_MESSAGE,packet},url.origin);return true;}
  catch{return false;}
 }
 function sendOnce(){
  const result={character:false,bank:false};
  if(!ready||!hasWindow())return result;
  const t=now();
  if(!telemetryTimeValid(t))return result;
  if(lastCharacter===null||t-lastCharacter>=GAME_RELAY_INTERVAL_MS){
   // Mark attempts *before* postMessage: no aggressive retries on popup errors.
   lastCharacter=t;
   let packet=null;
   try{packet=observedCharacterTelemetry(getCharacter(),getRealm());}catch{}
   result.character=post(packet);
  }
  if(role==='merchant'&&(lastBank===null||t-lastBank>=GAME_RELAY_INTERVAL_MS)){
   lastBank=t;
   let candidates=[];try{
    candidates=observedBankTelemetry(getCharacter(),getRealm(),getBankDefinitions());
   }catch{}
   if(candidates.length){
    const packet=candidates[bankIndex%candidates.length];
    bankIndex++;
    result.bank=post(packet);
   }
  }
  return result;
 }
 function disconnect(){
  if(closed)return;
  closed=true;ready=false;popup=null;
  gameWindow.removeEventListener('message',listener);
 }
 function status(){return {connected:hasWindow()&&ready,opened:hasWindow(),disposed:closed,
  intervalMs:GAME_RELAY_INTERVAL_MS,lastCharacter,lastBank};}
 return {open,sendOnce,disconnect,status};
}
