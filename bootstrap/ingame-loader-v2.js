/* ALBot auto bootstrap v2 · signed release channel */
(function(root){"use strict";
 const channel="https://raw.githubusercontent.com/Riflex91/ALBot/codex/w00-w01-readonly-disposition-20261018/dist/albot.release.json",publicKey={"kty":"EC","crv":"P-256","x":"WfyqE61B8by0RWCnj96sqGtFeCaHU7uwM9V3nSrvZgw","y":"2wO75T3_F_R5yl1wMFqWCzT4uOVrM85uEbkYtjuML4g","ext":true,"key_ops":["verify"]};
 const report=(phase,reason=null,version=null)=>{root.ALBotBootstrapStatus={
  phase,reason,version,channel};};
 const decode=s=>Uint8Array.from(root.atob(s.replace(/-/g,"+").replace(/_/g,"/")),
  c=>c.charCodeAt(0));
 const bytes=s=>new root.TextEncoder().encode(s);
 const digest=async data=>Array.from(new Uint8Array(
  await root.crypto.subtle.digest("SHA-256",data)),n=>
  n.toString(16).padStart(2,"0")).join("");
 const request=async(url,max)=>{
  const ctrl=new root.AbortController();
  const timer=root.setTimeout?.(()=>ctrl.abort(),15000);
  try{
   const res=await root.fetch(url,{method:"GET",mode:"cors",
    credentials:"omit",cache:"no-store",signal:ctrl.signal});
   if(!res.ok)throw Error("HTTP "+res.status+" from "+url);
   const data=await res.arrayBuffer();
   if(data.byteLength<1||data.byteLength>max)
    throw Error("Unexpected download size");
   return data;
  }finally{if(timer!==undefined)root.clearTimeout?.(timer);}
 };
 report("checking-manifest");
 const task=(async()=>{
  if(typeof root.fetch!=="function"||!root.crypto?.subtle||
     typeof root.TextEncoder!=="function"||typeof root.TextDecoder!=="function"||
     typeof root.atob!=="function"||typeof root.AbortController!=="function")
   throw Error("Required fetch or browser cryptography is unavailable");
  const manifest=JSON.parse(new root.TextDecoder("utf-8",{fatal:true})
   .decode(await request(channel,16384)));
  if(!manifest||manifest.format!=="albot-release-v1"||
     !Number.isSafeInteger(manifest.sequence)||manifest.sequence<1||
     typeof manifest.version!=="string"||manifest.version.length>80||
     typeof manifest.runtimeUrl!=="string"||
     !manifest.runtimeUrl.startsWith("https://raw.githubusercontent.com/Riflex91/ALBot/")||
     !Number.isSafeInteger(manifest.bytes)||manifest.bytes<1||
     manifest.bytes>8388608||
     !/^[a-f0-9]{64}$/.test(manifest.sha256??"")||
     !/^[A-Za-z0-9_-]{86}$/.test(manifest.signature??""))
   throw Error("Invalid release manifest");
  const message=JSON.stringify([manifest.format,manifest.sequence,
   manifest.version,manifest.runtimeUrl,manifest.bytes,manifest.sha256]);
  const key=await root.crypto.subtle.importKey("jwk",publicKey,
   {name:"ECDSA",namedCurve:"P-256"},false,["verify"]);
  if(!await root.crypto.subtle.verify({name:"ECDSA",hash:"SHA-256"},
    key,decode(manifest.signature),bytes(message)))
   throw Error("Release signature invalid; refusing code execution");
  let storage=null;try{storage=root.localStorage;}catch{}
  const storeKey="albot:release:max-sequence:v1";
  try{const previous=Number(storage?.getItem(storeKey)??0);
   if(Number.isSafeInteger(previous)&&previous>manifest.sequence)
    throw Error("Release downgrade rejected");
  }catch(e){if(e.message==="Release downgrade rejected")throw e;}
  report("loading-runtime",null,manifest.version);
  const raw=await request(manifest.runtimeUrl,8388608);
  if(raw.byteLength!==manifest.bytes||await digest(raw)!==manifest.sha256)
   throw Error("Runtime SHA-256 or byte length mismatch");
  const source=new root.TextDecoder("utf-8",{fatal:true}).decode(raw);
  if(!source.startsWith("/* ALBot "+manifest.version+" "))
   throw Error("Runtime release version mismatch");
  (0,eval)(source);
  const state=root.ALBot?.status?.();
  if(!state)throw Error("ALBot runtime did not expose status");
  if(root.ALBotConfig?.general?.autostart===true&&state.running!==true)
   throw Error("ALBot autostart refused: "+(state.reason??"unknown"));
  try{storage?.setItem(storeKey,String(manifest.sequence));}catch{}
  report(state.running===true?"running":"loaded",null,manifest.version);
  try{root.game_log?.("ALBot "+manifest.version+": Signatur, SHA-256 und Autostart OK");}catch{}
  return true;
 })();
 root.ALBotBootstrapReady=task;
 task.catch(e=>{report("blocked",String(e?.message??e));
  root.console?.error?.("[ALBot auto bootstrap]",e);
  try{root.game_log?.("ALBot Bootstrap blockiert: "+e.message);}catch{}
 });
})(globalThis);
