// Owner-facing, Access-protected publication reconciliation model.
// Deliberately never accepts a game-apply/ACK claim or a user-editable digest.
// The Worker independently re-reads and verifies the PRIVATE signed release.
export const SIGNED_ANCHOR_FORMAT='albot-signed-release-highwater/v1';
const sha40=/^[a-f0-9]{40}$/;
const sha64=/^[a-f0-9]{64}$/;
const obj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const safeSequence=x=>Number.isSafeInteger(x)&&x>=1;

export function parseSignedPublicationAnchor(value){
 if(!obj(value)||value.ok!==true||
  value.format!==SIGNED_ANCHOR_FORMAT||
  value.configured!==true||value.issuedOnly!==true||
  value.applied!==false||value.acknowledged!==false||
  typeof value.anchored!=='boolean')
  throw Error('Unerwartete Antwort des privaten D1-Publikationsankers');
 if(!value.anchored){
  if(value.anchor!==null)
   throw Error('D1 meldet widersprüchliche Verankerung');
  return {anchored:false,anchor:null};
 }
 const anchor=value.anchor;
 if(!obj(anchor)||!safeSequence(anchor.sequence)||
  !sha64.test(anchor.sha256??'')||!sha40.test(anchor.releaseSha??'')||
  !Number.isSafeInteger(anchor.updatedAt)||anchor.updatedAt<=0)
  throw Error('D1-Publikationsanker ist unvollständig');
 return {anchored:true,anchor:{
  sequence:anchor.sequence,sha256:anchor.sha256,
  releaseSha:anchor.releaseSha,updatedAt:anchor.updatedAt
 }};
}

export function signedPublicationSnapshot(sync){
 if(!obj(sync)||sync.ok!==true||sync.configured!==true||
  sync.signerReady!==true||sync.releasePrepared!==true||
  sync.published!==false||sync.applied!==false||
  sync.acknowledged!==false||
  typeof sync.publicationAnchorReady!=='boolean'||
  !obj(sync.release)||!safeSequence(sync.release.sequence)||
  !sha64.test(sync.release.sha256??'')||
  !sha40.test(sync.releaseSha??'')||
  !sha64.test(sync.keyFingerprint??'')||
  !Number.isSafeInteger(sync.release.issuedAt)||
  !Number.isSafeInteger(sync.release.expiresAt)||
  sync.release.expiresAt<=sync.release.issuedAt||
  !obj(sync.profile)||!sha40.test(sync.profile.githubSha??'')||
  !sha64.test(sync.profile.sha256??''))
  return null;
 return {
  githubSha:sync.profile.githubSha,
  profileSha256:sync.profile.sha256,
  releaseSha:sync.releaseSha,
  sequence:sync.release.sequence,sha256:sync.release.sha256,
  issuedAt:sync.release.issuedAt,expiresAt:sync.release.expiresAt,
  keyFingerprint:sync.keyFingerprint,
  publicationAnchorReady:sync.publicationAnchorReady
 };
}
export function sameSignedPublication(a,b){
 const x=signedPublicationSnapshot(a),y=signedPublicationSnapshot(b);
 return !!x&&!!y&&Object.keys(x).every(k=>x[k]===y[k]);
}
export function signedAnchorProposal(sync,anchor){
 const release=signedPublicationSnapshot(sync);
 if(!release)return {allowed:false,reason:'Keine vollständig geprüfte private signierte Revision für die Registrierung',payload:null};
 if(!anchor||typeof anchor.anchored!=='boolean')
  return {allowed:false,reason:'D1-Anker nicht erfolgreich geprüft',payload:null};
 if(sync.publicationAnchorReady===true){
  return {allowed:false,reason:'Veröffentlichung ist bereits über D1 bestätigt',payload:null};
 }
 if(anchor.anchored){
  if(!anchor.anchor)return {allowed:false,reason:'Unvollständiger D1-Anker',payload:null};
  if(anchor.anchor.sequence>release.sequence)
   return {allowed:false,reason:'D1 enthält bereits eine höhere Signatursequenz – Rücksprung gesperrt',payload:null};
  if(anchor.anchor.sequence===release.sequence)
   return {allowed:false,reason:'Widersprüchlicher oder bereits registrierter D1-Revisionsstand',payload:null};
 }
 return {
  allowed:true,reason:null,initial:!anchor.anchored,
  previousSequence:anchor.anchor?.sequence??null,
  needsWarning:anchor.anchored,
  release,
  payload:{confirm:true,releaseSha:release.releaseSha,
   sequence:release.sequence,sha256:release.sha256}
 };
}
