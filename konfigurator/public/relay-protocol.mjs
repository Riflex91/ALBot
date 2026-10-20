// No credentials cross the game/Access origin boundary. This is a
// deliberately small and strict, browser-only postMessage contract.
export const GAME_ORIGINS=Object.freeze([
 'https://adventure.land','https://www.adventure.land'
]);
export const RELAY_MESSAGE_TYPE='albot.telemetry.v1';
export const RELAY_READY_TYPE='albot.relay.ready.v1';
export const MAX_RELAY_MESSAGE_CHARS=32_768;
export function acceptRelayMessage(event,expectedSource){
 if(!expectedSource||!event||event.source!==expectedSource||
    !GAME_ORIGINS.includes(event.origin))return null;
 const incoming=event.data;
 if(!incoming||typeof incoming!=='object'||Array.isArray(incoming)||
    incoming.type!==RELAY_MESSAGE_TYPE)return null;
 const packet=incoming.packet;
 if(!packet||typeof packet!=='object'||Array.isArray(packet)||
    packet.version!==1||!['character','bank'].includes(packet.kind)||
    !packet.data||typeof packet.data!=='object'||Array.isArray(packet.data))return null;
 try{
  const serialized=JSON.stringify(packet);
  if(serialized.length>MAX_RELAY_MESSAGE_CHARS)return null;
  return {packet,serialized};
 }catch{return null;}
}
export function relayBucket(packet){
 if(packet?.kind==='bank')return 'bank';
 const name=packet?.data?.name;
 if(packet?.kind==='character'&&typeof name==='string'&&
    /^[a-zA-Z0-9_]{1,100}$/.test(name))return 'character:'+name;
 return null;
}
