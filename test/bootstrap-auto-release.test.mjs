import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash,webcrypto,generateKeyPairSync,sign,verify,createPublicKey} from 'node:crypto';
import {createContext,runInContext,Script} from 'node:vm';
import {createAutoBootstrap,releaseMessage,AUTO_MANIFEST_URL}
 from '../scripts/auto-bootstrap-support.mjs';

const runtime=(version='0.10.9-candidate',running=true)=>
 '/* ALBot '+version+' · Full runtime */\n'+
 'globalThis.__Boots=(globalThis.__Boots||0)+1;\n'+
 'globalThis.ALBot={status:()=>({running:'+running+',reason:"test gate"})};\n';
const prefix='// ALBot personal\n'+
 'globalThis.ALBotConfig={"general":{"autostart":true},"x":7};\n';
const pair=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const key=pair.publicKey.export({format:'jwk'});
const url='https://raw.githubusercontent.com/Riflex91/ALBot/example/dist/albot.runtime.js';
const buf=s=>Buffer.from(s,'utf8');
function manifest(code,{version='0.10.9-candidate',sequence=1}={}){
 const m={format:'albot-release-v1',sequence,version,
  runtimeUrl:url,bytes:buf(code).length,
  sha256:createHash('sha256').update(code).digest('hex')};
 m.signature=sign('sha256',buf(releaseMessage(m)),{
  key:pair.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
 return m;
}
function scenario({code=runtime(),release=manifest(code),responses=null,
 storage=new Map()}={}){
 const calls=[],ctx=createContext({TextEncoder,TextDecoder,AbortController,
  setTimeout,clearTimeout,atob,crypto:webcrypto,URL,
  console:{error:()=>{}},
  localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},
  fetch:async(request,options)=>{
   calls.push({request,options});
   if(responses?.[request]==='error')throw Error('network unavailable');
   const data=responses?.[request]??(request===AUTO_MANIFEST_URL?
     JSON.stringify(release):code);
   if(data===null)return {ok:false,status:404};
   return {ok:true,status:200,arrayBuffer:async()=>Uint8Array.from(buf(data)).buffer};
  }});
 const made=createAutoBootstrap({prefix,publicKey:key});
 runInContext(made.code,ctx,{timeout:3000});
 return {ctx,calls,storage,made};
}
test('auto bootstrap is stable across runtime updates and keeps personal config',()=>{
 const a=createAutoBootstrap({prefix,publicKey:key});
 const b=createAutoBootstrap({prefix,publicKey:key});
 assert.equal(a.code,b.code);
 assert.ok(a.bootstrapBytes<65536);
 assert.ok(!a.code.includes(runtime()));
 assert.ok(a.code.startsWith(prefix));
 assert.ok(a.code.includes(AUTO_MANIFEST_URL));
 assert.doesNotThrow(()=>new Script(a.code));
});
test('signed manifest fetches, validates and launches autostart in two releases',async()=>{
 const shared=new Map(),first=scenario({storage:shared});
 assert.equal(await first.ctx.ALBotBootstrapReady,true);
 assert.equal(first.ctx.__Boots,1);
 assert.equal(first.ctx.ALBotBootstrapStatus.phase,'running');
 assert.equal(first.ctx.ALBotBootstrapStatus.version,'0.10.9-candidate');
 assert.equal(first.calls.length,2);
 assert.equal(first.calls[0].request,AUTO_MANIFEST_URL);
 assert.equal(first.calls[0].options.credentials,'omit');
 assert.equal(first.calls[1].options.cache,'no-store');
 const nextCode=runtime('0.10.10-candidate');
 const second=scenario({code:nextCode,release:manifest(nextCode,{
  version:'0.10.10-candidate',sequence:2}),storage:shared});
 assert.equal(second.made.code,first.made.code,'installed bootstrap stays unchanged');
 assert.equal(await second.ctx.ALBotBootstrapReady,true);
 assert.equal(second.ctx.ALBotBootstrapStatus.version,'0.10.10-candidate');
 assert.equal(shared.get('albot:release:max-sequence:v1'),'2');
});
test('invalid signature blocks runtime fetch and code execution',async()=>{
 const code=runtime(),m=manifest(code);m.sequence=99;
 const s=scenario({code,release:m});
 await assert.rejects(s.ctx.ALBotBootstrapReady,/signature invalid/);
 await Promise.resolve();
 assert.equal(s.ctx.ALBotBootstrapStatus.phase,'blocked');
 assert.equal(s.ctx.__Boots,undefined);
 assert.equal(s.calls.length,1);
});
test('tampered runtime is never evaluated after signed manifest verification',async()=>{
 const code=runtime(),m=manifest(code),s=scenario({release:m,
  code:code+'\nglobalThis.__Pwned=1;\n'});
 await assert.rejects(s.ctx.ALBotBootstrapReady,/SHA-256 or byte length mismatch/);
 await Promise.resolve();
 assert.equal(s.ctx.__Boots,undefined);
 assert.equal(s.ctx.__Pwned,undefined);
});
test('signed downgrade is rejected and cannot run even with a valid signature',async()=>{
 const storage=new Map([['albot:release:max-sequence:v1','20']]);
 const s=scenario({storage});
 await assert.rejects(s.ctx.ALBotBootstrapReady,/downgrade rejected/);
 assert.equal(s.calls.length,1);
});
test('missing browser dependencies and fetch failures fail closed',async()=>{
 const s=scenario({responses:{[AUTO_MANIFEST_URL]:'error'}});
 await assert.rejects(s.ctx.ALBotBootstrapReady,/network unavailable/);
 assert.equal(s.ctx.__Boots,undefined);
});
test('autostart denial is reported, not represented as launched',async()=>{
 const code=runtime('0.10.9-candidate',false),s=scenario({code,release:manifest(code)});
 await assert.rejects(s.ctx.ALBotBootstrapReady,/autostart refused/);
 assert.equal(s.ctx.ALBotBootstrapStatus.phase,'blocked');
 assert.equal(s.storage.has('albot:release:max-sequence:v1'),false);
});
test('real published manifest carries a verifiable pinned-key signature',async()=>{
 const [published,publicKey]=await Promise.all([
  readFile(new URL('../dist/albot.release.json',import.meta.url),'utf8'),
  readFile(new URL('../release/public-key.json',import.meta.url),'utf8')]);
 const m=JSON.parse(published),pub=createPublicKey({key:JSON.parse(publicKey),format:'jwk'});
 assert.equal(verify('sha256',buf(releaseMessage(m)),{
  key:pub,dsaEncoding:'ieee-p1363'},Buffer.from(m.signature,'base64url')),true);
});
