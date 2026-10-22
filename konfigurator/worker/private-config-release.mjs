// Private-only signing helper. Never exposes a signing secret to a response,
// Adventure Land code, D1 telemetry, the public runtime branch, or a log.
import {profileDigest,SIGNED_CONFIG_FORMAT,signedConfigMessage,
 verifySignedConfigRelease} from '../public/config-sync-contract.mjs';
const KEY=/^[A-Za-z0-9_-]{43}$/;
const TARGET=/^[A-Za-z0-9_.:\/-]{1,128}$/;
const DAY=86400000;
const bytes64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-')
 .replace(/\//g,'_').replace(/=+$/,'');
function parseKey(raw){
 if(typeof raw!=='string'||raw.length>2000)throw Error('Privater Signierschlüssel nicht eingerichtet');
 let key;try{key=JSON.parse(raw);}catch{throw Error('Ungültiger privater Signierschlüssel');}
 if(!key||key.kty!=='EC'||key.crv!=='P-256'||
  !KEY.test(key.x??'')||!KEY.test(key.y??'')||!KEY.test(key.d??''))
  throw Error('P-256-Signierschlüssel unvollständig');
 return key;
}
export function releaseTarget(target){
 if(typeof target!=='string'||!TARGET.test(target))
  throw Error('Konfigurationsziel nicht eingerichtet');
 return target;
}
export async function signer(env,subtle=globalThis.crypto?.subtle){
 if(!subtle)throw Error('WebCrypto fehlt');
 const key=parseKey(env?.CONFIG_SIGNING_JWK),target=releaseTarget(env?.CONFIG_SIGNING_TARGET);
 const publicJwk={kty:'EC',crv:'P-256',x:key.x,y:key.y,
  key_ops:['verify'],ext:true};
 const signingKey=await subtle.importKey('jwk',
  {...key,key_ops:['sign'],ext:true},{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
 const verifyingKey=await subtle.importKey('jwk',publicJwk,
  {name:'ECDSA',namedCurve:'P-256'},false,['verify']);
 // Prove that the public half matches the private key; don't trust JWK labels.
 const challenge=new TextEncoder().encode('ALBOT-CONFIG-SIGNER-SELF-CHECK-V1');
 const signature=await subtle.sign({name:'ECDSA',hash:'SHA-256'},signingKey,challenge);
 if(!(await subtle.verify({name:'ECDSA',hash:'SHA-256'},verifyingKey,signature,challenge)))
  throw Error('Signierschlüssel und öffentlicher Prüfschlüssel stimmen nicht überein');
 const fingerprint=await subtle.digest('SHA-256',
  new TextEncoder().encode(JSON.stringify([publicJwk.crv,publicJwk.x,publicJwk.y])));
 const keyId=[...new Uint8Array(fingerprint)].map(x=>x.toString(16).padStart(2,'0')).join('');
 return {signingKey,publicJwk,keyId,target,subtle};
}
export async function previousRelease(release,identity,now=Date.now()){
 if(!release)return 0;
 if(!Number.isSafeInteger(release.issuedAt)||!Number.isSafeInteger(release.expiresAt)||
  release.issuedAt>now||release.expiresAt<=release.issuedAt)
  throw Error('Bisherige signierte Revision inkonsistent');
 // Verify the *historical* signature even if it is now expired. Never reset
 // the monotonic sequence simply because a prior release is past its TTL.
 const at=Math.min(now,release.expiresAt-1);
 const result=await verifySignedConfigRelease(release,{
  pinnedPublicJwk:identity.publicJwk,target:identity.target,minimumSequence:0,
  now:at,subtle:identity.subtle});
 if(result.sequence>=Number.MAX_SAFE_INTEGER)
  throw Error('Konfigurationssequenz ausgeschöpft');
 return result.sequence;
}
export async function preparePrivateRelease({profile,prior,identity,now=Date.now()}={}){
 if(!Number.isSafeInteger(now)||now<1)throw Error('Ungültiger Veröffentlichungszeitpunkt');
 const sequence=(await previousRelease(prior,identity,now))+1;
 const digest=await profileDigest(profile,identity.subtle);
 const release={format:SIGNED_CONFIG_FORMAT,schemaId:'albot.full/v1',
  target:identity.target,sequence,issuedAt:now,expiresAt:now+DAY,
  sha256:digest.sha256,profile:structuredClone(profile)};
 const signature=new Uint8Array(await identity.subtle.sign(
  {name:'ECDSA',hash:'SHA-256'},identity.signingKey,
  new TextEncoder().encode(signedConfigMessage(release))));
 if(signature.byteLength!==64)throw Error('Unerwartete P-256-Signatur');
 release.signature=bytes64(signature);
 const verified=await verifySignedConfigRelease(release,{
  pinnedPublicJwk:identity.publicJwk,target:identity.target,
  minimumSequence:sequence-1,now,subtle:identity.subtle});
 if(!verified.verified||verified.sha256!==digest.sha256)
  throw Error('Signatur-Selbsttest fehlgeschlagen');
 return release;
}
export function releaseInfo(release,sourceDigest,sha,now=Date.now()){
 const matches=!!release&&release.sha256===sourceDigest;
 const expired=!!release&&release.expiresAt<=now;
 return {releasePrepared:!!release,releaseMatchesCurrent:matches,
  releaseExpired:expired,releaseSha:sha??null,
  release:release?{sequence:release.sequence,sha256:release.sha256,
   issuedAt:release.issuedAt,expiresAt:release.expiresAt}:null,
  signed:matches&&!expired,published:false,applied:false,acknowledged:false};
}
