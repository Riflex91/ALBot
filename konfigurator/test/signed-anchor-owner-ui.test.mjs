import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseSignedPublicationAnchor,signedPublicationSnapshot,
 sameSignedPublication,signedAnchorProposal}
 from '../public/signed-anchor-model.mjs';

const SHA64='a'.repeat(64),SHA40='b'.repeat(40),KEY='c'.repeat(64);
function status(){
 return {ok:true,configured:true,signerReady:true,
  publicationAnchorReady:false,signed:true,releasePrepared:true,
  releaseMatchesCurrent:true,releaseExpired:false,
  deliveryReady:false,published:false,applied:false,acknowledged:false,
  releaseSha:SHA40,keyFingerprint:KEY,
  profile:{githubSha:'d'.repeat(40),sha256:SHA64},
  release:{sequence:7,sha256:SHA64,issuedAt:1792800000000,
   expiresAt:1792886400000}};
}
function response(anchor=null){
 return {ok:true,format:'albot-signed-release-highwater/v1',
  configured:true,issuedOnly:true,applied:false,acknowledged:false,
  anchored:!!anchor,anchor};
}
const point=(sequence=6,sha256=SHA64,releaseSha='e'.repeat(40))=>({
 sequence,sha256,releaseSha,updatedAt:1792801000000
});

test('valid empty D1 can register a snapshot only after owner confirmation and server verification',()=>{
 const statusValue=status(),anchor=parseSignedPublicationAnchor(response());
 const plan=signedAnchorProposal(statusValue,anchor);
 assert.equal(plan.allowed,true);
 assert.equal(plan.initial,true);
 assert.deepEqual(plan.payload,{confirm:true,releaseSha:SHA40,
  sequence:7,sha256:SHA64});
 assert.equal(plan.release.keyFingerprint,KEY);
 assert.equal(statusValue.applied,false);
 assert.equal(statusValue.acknowledged,false);
 assert.equal(JSON.stringify(plan).includes('signature'),false);
 assert.equal(JSON.stringify(plan).includes('profile.config'),false);
});

test('an older anchored publication can be explicitly updated; no downgrade or same-sequence equivocation',()=>{
 const old=parseSignedPublicationAnchor(response(point()));
 const proposal=signedAnchorProposal(status(),old);
 assert.equal(proposal.allowed,true);
 assert.equal(proposal.initial,false);
 assert.equal(proposal.needsWarning,true);
 assert.equal(proposal.previousSequence,6);
 for(const conflict of [
  point(8),point(7),point(7,'f'.repeat(64),SHA40)
 ]){
  const anchor=parseSignedPublicationAnchor(response(conflict));
  const blocked=signedAnchorProposal(status(),anchor);
  assert.equal(blocked.allowed,false);
  assert.equal(blocked.payload,null);
 }
 const ready=status();ready.publicationAnchorReady=true;
 assert.equal(signedAnchorProposal(ready,old).allowed,false);
});

test('release may be expired or profile source changed: only private P256 release is registered, never activated',()=>{
 const changed=status();changed.releaseExpired=true;
 changed.signed=false;changed.releaseMatchesCurrent=false;
 const proposal=signedAnchorProposal(changed,parseSignedPublicationAnchor(response()));
 assert.equal(proposal.allowed,true);
 assert.equal(proposal.payload.sha256,SHA64);
 assert.equal(proposal.payload.sequence,7);
 assert.equal(proposal.release.profileSha256,SHA64);
 assert.equal(proposal.release.githubSha,changed.profile.githubSha);
});

test('missing migration, malformed D1 responses and forged applied or ACK statuses fail closed',()=>{
 for(const invalid of [
  null,{},response({...point(),sequence:0}),response({...point(),updatedAt:NaN}),
  {...response(),configured:false},
  {...response(),issuedOnly:false},
  {...response(),applied:true},
  {...response(),acknowledged:true},
  {...response(),anchor:point(),anchored:false},
  {...response(point()),anchor:null},
  {...response(point()),format:'malicious'},
  response({...point(),releaseSha:'wrong'}),
  response({...point(),sha256:'invalid'})
 ])assert.throws(()=>parseSignedPublicationAnchor(invalid));
 assert.equal(signedAnchorProposal(status(),null).allowed,false);
 assert.equal(signedAnchorProposal(status(),undefined).allowed,false);
});

test('malformed signed status and unverified fingerprints never become an actionable button',()=>{
 const changes=[
  x=>{x.ok=false;},x=>{x.configured=false;},
  x=>{x.signerReady=false;},x=>{x.releasePrepared=false;},
  x=>{x.published=true;},x=>{x.applied=true;},
  x=>{x.acknowledged=true;},x=>{delete x.publicationAnchorReady;},
  x=>{x.keyFingerprint='invalid';},x=>{x.releaseSha='wrong';},
  x=>{x.release.sequence=0;},x=>{x.release.sequence=NaN;},
  x=>{x.release.sha256='bad';},x=>{x.release.issuedAt=NaN;},
  x=>{x.release.expiresAt=x.release.issuedAt;},
  x=>{x.profile=null;},x=>{x.profile.githubSha='invalid';},
  x=>{x.profile.sha256='invalid';}
 ];
 for(const change of changes){
  const value=status();change(value);
  assert.equal(signedPublicationSnapshot(value),null,change.toString());
  assert.equal(signedAnchorProposal(value,{anchored:false,anchor:null}).allowed,false);
 }
});

test('a changed release, profile revision, signer, expiry or D1 gate forces a second owner review',()=>{
 const baseline=status();
 assert.equal(sameSignedPublication(baseline,structuredClone(baseline)),true);
 for(const change of [
  x=>{x.release.sha256='f'.repeat(64);},
  x=>{x.release.sequence++;},
  x=>{x.release.expiresAt++;},
  x=>{x.release.issuedAt++;},
  x=>{x.releaseSha='e'.repeat(40);},
  x=>{x.keyFingerprint='f'.repeat(64);},
  x=>{x.profile.githubSha='f'.repeat(40);},
  x=>{x.profile.sha256='f'.repeat(64);},
  x=>{x.publicationAnchorReady=true;}
 ]){
  const next=structuredClone(baseline);change(next);
  assert.equal(sameSignedPublication(baseline,next),false,change.toString());
 }
});

test('owner UI validates fresh independent status and D1 before any same-origin mutation',async()=>{
 const ui=await readFile(new URL('../public/app.mjs',import.meta.url),'utf8');
 const start=ui.indexOf('async function reconcileSignedPublication()');
 const end=ui.indexOf('async function api(',start);
 assert.ok(start>0&&end>start);
 const snippet=ui.slice(start,end);
 const signedRead=snippet.indexOf("api('/api/profile-sync/status')");
 const anchorRead=snippet.indexOf("api('/api/profile-sync/signed-highwater')");
 const compare=snippet.indexOf('sameSignedPublication(old,freshStatus)');
 const prompt=snippet.indexOf('window.confirm(');
 const write=snippet.indexOf("api('/api/profile-sync/signed-highwater',{");
 assert.ok(signedRead>=0&&anchorRead>signedRead&&compare>signedRead);
 assert.ok(prompt>compare&&write>prompt);
 assert.match(snippet,/if\(!authorized\)return/);
 assert.match(snippet,/method:'PUT',headers:\{'content-type':'application\/json'\}/);
 assert.match(snippet,/syncState\.reconciling/);
 assert.match(snippet,/profileState\.dirty\|\|state\.dirty/);
 assert.doesNotMatch(snippet,/ALBotConfig|bot\.cfg|configActivation|acknowledge/);
 assert.match(ui,/signedAnchorProposal\(entry,anchor\)/);
 assert.match(ui,/syncState\.anchorError/);
});
