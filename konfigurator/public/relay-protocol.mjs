// No credentials cross the game/Access origin boundary. This is a
// deliberately small and strict, browser-only postMessage contract.
export const GAME_ORIGINS=Object.freeze([
 'https://adventure.land','https://www.adventure.land'
]);
export const RELAY_MESSAGE_TYPE='albot.telemetry.v1';
export const RELAY_READY_TYPE='albot.relay.ready.v1';
export const MAX_RELAY_MESSAGE_CHARS=32_768;
// Adventure Land's CODE runner executes in a child frame of the game window.
// The popup is opened via gameWindow.open(), so window.opener is the *parent*
// game window, while postMessage's browser-controlled event.source is the
// executing CODE frame. Accept only opener or its bounded descendants, never
// an arbitrary tab or other window, and retain the exact game-origin check.
// Cross-origin WindowProxy exposes frames/length but may throw in some
// browsers; inspection must fail closed.
export function isOpenerFrameSource(source,opener){
 if(!source||!opener)return false;
 if(source===opener)return true;
 const visited=new Set([opener]);
 const pending=[opener];
 let inspected=0;
 for(let at=0;at<pending.length&&inspected<128;at++){
  let children,length;
  try{children=pending[at].frames;length=children?.length;}catch{continue;}
  if(!Number.isSafeInteger(length)||length<0||length>64)continue;
  for(let n=0;n<length&&inspected<128;n++){
   inspected++;
   let child;
   try{child=children[n];}catch{continue;}
   if(!child||visited.has(child))continue;
   if(child===source)return true;
   visited.add(child);pending.push(child);
  }
 }
 return false;
}
export function acceptRelayMessage(event,expectedSource){
 if(!event||!GAME_ORIGINS.includes(event.origin)||
    !isOpenerFrameSource(event.source,expectedSource))return null;
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
