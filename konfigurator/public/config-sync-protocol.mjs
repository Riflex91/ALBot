import {GAME_ORIGINS,isOpenerFrameSource} from './relay-protocol.mjs';

export const CONFIG_POPUP_URL='https://albot-konfigurator.hansijuergenlul.workers.dev/config-sync.html';
export const CONFIG_POPUP_ORIGIN=new URL(CONFIG_POPUP_URL).origin;
export const CONFIG_READY='albot.config.ready.v1';
export const CONFIG_REQUEST='albot.config.request.v1';
export const CONFIG_RELEASE='albot.config.release.v1';
export const CONFIG_ERROR='albot.config.error.v1';
export const CONFIG_MAX_MESSAGE_CHARS=950_000;
const NONCE=/^[a-f0-9]{32}$/;

export function validSyncNonce(nonce){return typeof nonce==='string'&&NONCE.test(nonce);}
export function gameRequest(event,opener){
 if(!event||!GAME_ORIGINS.includes(event.origin)||
  !isOpenerFrameSource(event.source,opener))return null;
 const d=event.data;
 if(!d||typeof d!=='object'||Array.isArray(d)||
   d.type!==CONFIG_REQUEST||!validSyncNonce(d.nonce))return null;
 return {nonce:d.nonce,source:event.source,origin:event.origin};
}
export function popupResponse(event,popup,nonce){
 if(!event||event.source!==popup||event.origin!==CONFIG_POPUP_ORIGIN||
  !validSyncNonce(nonce))return null;
 const d=event.data;
 if(!d||typeof d!=='object'||Array.isArray(d)||
  ![CONFIG_RELEASE,CONFIG_ERROR].includes(d.type)||d.nonce!==nonce)return null;
 if(d.type===CONFIG_ERROR)
  return {error:typeof d.message==='string'?d.message.slice(0,120):'delivery-failed'};
 if(!d.release||typeof d.release!=='object'||Array.isArray(d.release))return null;
 try{
  if(JSON.stringify(d.release).length>CONFIG_MAX_MESSAGE_CHARS)return null;
 }catch{return null;}
 return {release:d.release};
}
export function generateSyncNonce(cryptoObj){
 if(typeof cryptoObj?.getRandomValues!=='function')throw Error('Sichere Zufallsquelle fehlt');
 const bytes=new Uint8Array(16);cryptoObj.getRandomValues(bytes);
 return [...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');
}
