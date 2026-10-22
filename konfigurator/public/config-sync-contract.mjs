// Cryptographic verification contract only. This module NEVER installs a
// configuration, emits game commands or grants an upload / write permission.
export const SYNC_PREFLIGHT_FORMAT='albot-config-sync-preflight/v1';
export const SIGNED_CONFIG_FORMAT='albot-config-release/v1';
const MAX_PROFILE_BYTES=850000;
const HEX=/^[a-f0-9]{64}$/;
const B64=/^[A-Za-z0-9_-]+$/;
const own=(o,key)=>Object.prototype.hasOwnProperty.call(o,key);
const forbidden=new Set(['__proto__','constructor','prototype']);
const encoder=new TextEncoder();

function canonical(value,depth,seen,count){
 if(++count.nodes>150000||depth>32)throw Error('Profilstruktur zu groß oder zu tief');
 if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
 if(typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
 if(!value||typeof value!=='object'||seen.has(value))throw Error('Nicht serialisierbarer Profilwert');
 seen.add(value);
 let result;
 if(Array.isArray(value))
  result='['+value.map(v=>canonical(v,depth+1,seen,count)).join(',')+']';
 else{
  if(Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null)
   throw Error('Ungültiger Profilobjekttyp');
  const parts=[];
  for(const key of Object.keys(value).sort()){
   if(forbidden.has(key))throw Error('Unsicherer Profilschlüssel');
   if(value[key]===undefined)throw Error('Undefinierter Profilwert');
   parts.push(JSON.stringify(key)+':'+canonical(value[key],depth+1,seen,count));
  }
  result='{'+parts.join(',')+'}';
 }
 seen.delete(value);
 return result;
}
export function canonicalProfileBytes(profile){
 if(profile?.format!=='albot-profile'||profile.formatVersion!==1||
    profile.schemaId!=='albot.full/v1'||!profile.config||
    typeof profile.config!=='object'||Array.isArray(profile.config))
  throw Error('Vollständiges ALBot-Profil erforderlich');
 const bytes=encoder.encode(canonical(profile,0,new Set(),{nodes:0}));
 if(bytes.byteLength>MAX_PROFILE_BYTES)throw Error('Profil überschreitet Sicherheitsgrenze');
 return bytes;
}
const toHex=bytes=>[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
export async function profileDigest(profile,subtle=globalThis.crypto?.subtle){
 if(!subtle)throw Error('Kryptografische Prüffunktion nicht verfügbar');
 const bytes=canonicalProfileBytes(profile);
 return {sha256:toHex(new Uint8Array(await subtle.digest('SHA-256',bytes))),
  bytes:bytes.byteLength};
}
export async function syncPreflight({profile,githubSha,subtle}={}){
 if(typeof githubSha!=='string'||!/^[a-f0-9]{40}$/.test(githubSha))
  throw Error('GitHub-Version nicht bestätigt');
 const digest=await profileDigest(profile,subtle);
 return {
  format:SYNC_PREFLIGHT_FORMAT,profile:{source:'private-github',
   githubSha,sha256:digest.sha256,bytes:digest.bytes,schemaId:'albot.full/v1'},
  signed:false,published:false,applied:false,acknowledged:false,
  nextStep:'separater-signierter-konfigurationskanal'
 };
}
export function signedConfigMessage(release){
 // Length-safe JSON avoids collisions from delimiter characters in metadata.
 return 'ALBOT-CONFIG-RELEASE-V1\\n'+JSON.stringify([
  release.format,release.schemaId,release.target,release.sequence,
  release.issuedAt,release.expiresAt,release.sha256
 ]);
}
function decode64(input){
 if(typeof input!=='string'||!B64.test(input)||input.length!==86)
  throw Error('Ungültige Konfigurationssignatur');
 const padded=input.replace(/-/g,'+').replace(/_/g,'/');
 return Uint8Array.from(atob(padded+'='.repeat((4-padded.length%4)%4)),c=>c.charCodeAt(0));
}
// The key is separately pinned by the future private in-game configuration
// channel. It must never be fetched from the same untrusted response.
export async function verifySignedConfigRelease(release,{
 pinnedPublicJwk,target,minimumSequence=0,now=Date.now(),
 subtle=globalThis.crypto?.subtle
}={}){
 if(!subtle||!pinnedPublicJwk||pinnedPublicJwk.kty!=='EC'||
  pinnedPublicJwk.crv!=='P-256'||typeof pinnedPublicJwk.x!=='string'||
  typeof pinnedPublicJwk.y!=='string')
  throw Error('Fest eingebauter P-256-Prüfschlüssel fehlt');
 if(!release||release.format!==SIGNED_CONFIG_FORMAT||
  release.schemaId!=='albot.full/v1'||!Number.isSafeInteger(release.sequence)||
  release.sequence<=minimumSequence||release.sequence<1||
  !Number.isSafeInteger(minimumSequence)||minimumSequence<0||
  typeof target!=='string'||!/^[A-Za-z0-9_.:\\/-]{1,128}$/.test(target)||
  release.target!==target||!Number.isSafeInteger(release.issuedAt)||
  !Number.isSafeInteger(release.expiresAt)||release.issuedAt>now||
  release.expiresAt<=now||release.expiresAt-release.issuedAt>7*86400000||
  !HEX.test(release.sha256??''))
  throw Error('Signierte Konfiguration abgelaufen, rückwärts oder nicht für diesen Account');
 const bytes=decode64(release.signature);
 const content=await profileDigest(release.profile,subtle);
 if(content.sha256!==release.sha256)throw Error('Profilinhalt stimmt nicht mit signiertem SHA-256 überein');
 const key=await subtle.importKey('jwk',pinnedPublicJwk,
  {name:'ECDSA',namedCurve:'P-256'},false,['verify']);
 const ok=await subtle.verify({name:'ECDSA',hash:'SHA-256'},key,bytes,
  encoder.encode(signedConfigMessage(release)));
 if(!ok)throw Error('Signatur der Konfiguration ungültig');
 // The caller must separately validate the full descriptor and verify a
 // durable non-rollback cursor before considering a controlled safe-point.
 return {verified:true,sequence:release.sequence,sha256:content.sha256,
  profile:structuredClone(release.profile),applied:false};
}
