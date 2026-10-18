import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash,createPublicKey,sign,verify} from 'node:crypto';
import {VERSION} from '../src/version.mjs';
import {DEFAULT_RUNTIME_URL} from './bootstrap-support.mjs';
import {releaseMessage} from './auto-bootstrap-support.mjs';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const pub=JSON.parse(await read('release/public-key.json'));
const publicKey=createPublicKey({key:pub,format:'jwk'});
const runtime=await readFile(new URL('dist/albot.runtime.js',root));
const sha256=createHash('sha256').update(runtime).digest('hex');
const size=runtime.byteLength;
const file=new URL('dist/albot.release.json',root);
let existing=null;
try{existing=JSON.parse(await readFile(file,'utf8'));}catch{}
const valid=m=>{
 if(m?.format!=='albot-release-v1'||!Number.isSafeInteger(m.sequence)||
    m.sequence<1||typeof m.version!=='string'||
    typeof m.runtimeUrl!=='string'||!Number.isSafeInteger(m.bytes)||
    !/^[a-f0-9]{64}$/.test(m.sha256??'')||
    !/^[A-Za-z0-9_-]{86}$/.test(m.signature??''))return false;
 return verify('sha256',Buffer.from(releaseMessage(m)),{
  key:publicKey,dsaEncoding:'ieee-p1363'
 },Buffer.from(m.signature,'base64url'));
};
if(process.argv.includes('--check')){
 if(!valid(existing)||existing.sha256!==sha256||
    existing.bytes!==size||existing.version!==VERSION||
    existing.runtimeUrl!==DEFAULT_RUNTIME_URL)
  throw Error('Published signed manifest does not match rebuilt runtime');
 console.log(JSON.stringify({verified:true,version:VERSION,
  sequence:existing.sequence,bytes:size,sha256}));
}else if(process.argv.includes('--write')){
 const privateKey=process.env.ALBOT_RELEASE_SIGNING_KEY_PEM;
 if(!privateKey)throw Error('Missing ALBOT_RELEASE_SIGNING_KEY_PEM secret; do not store private keys in Git');
 if(existing&&!valid(existing))throw Error('Existing release manifest signature invalid');
 const seq=(existing?.sequence??0)+1;
 const next={format:'albot-release-v1',sequence:seq,version:VERSION,
  runtimeUrl:DEFAULT_RUNTIME_URL,bytes:size,sha256};
 const signature=sign('sha256',Buffer.from(releaseMessage(next)),{
  key:privateKey,dsaEncoding:'ieee-p1363'
 });
 next.signature=signature.toString('base64url');
 if(!valid(next))throw Error('Signing key does not match pinned public key');
 await mkdir(new URL('dist/',root),{recursive:true});
 await writeFile(file,JSON.stringify(next,null,2)+'\n');
 console.log(JSON.stringify({signed:true,sequence:seq,
  version:VERSION,bytes:size,sha256}));
}else throw Error('Use --check or --write');
