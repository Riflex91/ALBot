import {createHash} from 'node:crypto';
import {Script} from 'node:vm';

export const DEFAULT_RUNTIME_URL=
 'https://raw.githubusercontent.com/Riflex91/ALBot/codex/w00-w01-readonly-disposition-20261018/dist/albot.runtime.js';

export function personalPrefix(source){
 if(typeof source!=='string')throw Error('Personal code missing');
 const marker=source.indexOf('/* ALBot ');
 if(marker<100)throw Error('Missing runtime/config boundary');
 const prefix=source.slice(0,marker),assignment=prefix.indexOf('globalThis.ALBotConfig=');
 if(!prefix.startsWith('// ALBot ')||assignment<0||
    !prefix.slice(assignment).trimEnd().endsWith('};'))
  throw Error('Unexpected personal configuration boundary');
 new Script(prefix);
 return prefix;
}

export function createBootstrap({prefix,runtime,url=DEFAULT_RUNTIME_URL}){
 if(typeof prefix!=='string'||!prefix.startsWith('// ALBot ')||
    !prefix.includes('globalThis.ALBotConfig='))throw Error('Missing personal prefix');
 if(typeof runtime!=='string'||!runtime.startsWith('/* ALBot '))
  throw Error('Missing ALBot runtime');
 const u=new URL(url);
 if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)
  throw Error('Bootstrap URL must be an exact HTTPS resource');
 const digest=createHash('sha256').update(runtime,'utf8').digest('hex');
 const bytes=Buffer.byteLength(runtime,'utf8');
 const script=[
  '/* ALBot bootstrap v1 · SHA-256 pinned */',
  '(function(root){"use strict";',
  ' const url=__URL__,expected=__SHA__;',
  ' const report=(phase,reason)=>{root.ALBotBootstrapStatus={phase,reason:reason??null,url,expectedSha256:expected}};',
  ' report("loading");',
  ' const task=(async()=>{',
  '  if(typeof root.fetch!=="function"||!root.crypto?.subtle||',
  '     typeof root.TextDecoder!=="function"||typeof root.AbortController!=="function")',
  '   throw Error("Browser lacks fetch, SHA-256 or AbortController");',
  '  const ctrl=new root.AbortController();',
  '  const timer=root.setTimeout?.(()=>ctrl.abort(),15000);',
  '  try{',
  '   const response=await root.fetch(url,{method:"GET",mode:"cors",',
  '    credentials:"omit",cache:"no-store",signal:ctrl.signal});',
  '   if(!response.ok)throw Error("Runtime HTTP "+response.status);',
  '   const raw=await response.arrayBuffer();',
  '   if(raw.byteLength===0||raw.byteLength>8388608)',
  '    throw Error("Unexpected runtime byte length");',
  '   const hash=Array.from(new Uint8Array(',
  '    await root.crypto.subtle.digest("SHA-256",raw)),x=>',
  '    x.toString(16).padStart(2,"0")).join("");',
  '   if(hash!==expected)throw Error("Runtime SHA-256 mismatch; refusing execution");',
  '   const source=new root.TextDecoder("utf-8",{fatal:true}).decode(raw);',
  '   if(!source.startsWith("/* ALBot "))',
  '    throw Error("Unexpected runtime header");',
  '   // Global eval runs in the existing CODE runner, never in a new closure.',
  '   (0,eval)(source);',
  '   const state=root.ALBot?.status?.();',
  '   if(!state)throw Error("ALBot runtime did not expose status");',
  '   if(root.ALBotConfig?.general?.autostart===true&&state.running!==true)',
  '    throw Error("ALBot autostart refused: "+(state.reason??"unknown reason"));',
  '   report(state.running===true?"running":"loaded");',
  '   try{root.game_log?.("ALBot Bootstrap: SHA-256 OK; Autostart "+',
  '     (state.running===true?"AKTIV":"inaktiv"));}catch{}',
  '   return true;',
  '  }finally{if(timer!==undefined)root.clearTimeout?.(timer);}',
  ' })();',
  ' root.ALBotBootstrapReady=task;',
  ' task.catch(e=>{',
  '  report("blocked",String(e?.message??e));',
  '  root.console?.error?.("[ALBot bootstrap]",e);',
  '  try{root.game_log?.("ALBot Bootstrap blockiert: "+e.message);}catch{}',
  ' });',
  '})(globalThis);'
 ].join('\n');
 const bootstrap=prefix+script.replace('__URL__',JSON.stringify(u.href))
  .replace('__SHA__',JSON.stringify(digest))+'\n';
 new Script(bootstrap);
 return {code:bootstrap,sha256:digest,runtimeBytes:bytes,
  bootstrapBytes:Buffer.byteLength(bootstrap,'utf8'),url:u.href};
}
