import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import {FULL_DESCRIPTOR} from '../../src/config/full.mjs';
import {importProfile,envelope} from '../../editor/lib/contract.mjs';
import {canonicalProfileBytes,profileDigest,syncPreflight,signedConfigMessage,
 verifySignedConfigRelease,SIGNED_CONFIG_FORMAT,SYNC_PREFLIGHT_FORMAT}
 from '../public/config-sync-contract.mjs';

const fixture=JSON.parse(await readFile(new URL('../../profiles/full-team.json',import.meta.url),'utf8'));
const profile=()=>envelope(FULL_DESCRIPTOR,importProfile(FULL_DESCRIPTOR,fixture));
const subtle=webcrypto.subtle;
const now=1792600000000;

test('canonical private-profile digest is deterministic regardless of key order',async()=>{
 const original=profile(),copy=structuredClone(original);
 copy.config=Object.fromEntries(Object.entries(copy.config).reverse());
 assert.equal((await profileDigest(original,subtle)).sha256,(await profileDigest(copy,subtle)).sha256);
 assert.deepEqual(canonicalProfileBytes(original),canonicalProfileBytes(copy));
 copy.config.farming.maxAggro=13;
 assert.notEqual((await profileDigest(original,subtle)).sha256,(await profileDigest(copy,subtle)).sha256);
});

test('preflight never declares an unsigned GitHub profile published or applied',async()=>{
 const result=await syncPreflight({profile:profile(),githubSha:'a'.repeat(40),subtle});
 assert.equal(result.format,SYNC_PREFLIGHT_FORMAT);
 assert.equal(result.profile.githubSha,'a'.repeat(40));
 assert.match(result.profile.sha256,/^[a-f0-9]{64}$/);
 assert.equal(result.profile.schemaId,'albot.full/v1');
 for(const flag of ['signed','published','applied','acknowledged'])
  assert.equal(result[flag],false);
 assert.equal(JSON.stringify(result).includes('My_Ranger1'),false);
 assert.equal(JSON.stringify(result).includes('"config"'),false);
 await assert.rejects(syncPreflight({profile:profile(),githubSha:'bad',subtle}));
});

test('tampered or unsafe profile objects never yield authoritative digests',async()=>{
 const nested=profile();
 Object.defineProperty(nested.config.general,'__proto__',{enumerable:true,
  configurable:true,value:'bad'});
 await assert.rejects(profileDigest(nested,subtle),/Unsicherer/);
 await assert.rejects(profileDigest({format:'albot-profile',formatVersion:1,
  schemaId:'albot.live-a/v1',config:{}},subtle));
 const cyclic=profile();cyclic.config.loop=cyclic.config;
 await assert.rejects(profileDigest(cyclic,subtle),/Nicht serialisierbar/);
});

test('signed config contract verifies pinned ECDSA-P256, expiry, account and rollback',async()=>{
 const kp=await subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 const key=await subtle.exportKey('jwk',kp.publicKey);
 const payload=profile(),{sha256}=await profileDigest(payload,subtle);
 const release={format:SIGNED_CONFIG_FORMAT,sequence:8,target:'ALBot/MyAccount',
  issuedAt:now-2000,expiresAt:now+180000,schemaId:'albot.full/v1',sha256,
  profile:payload};
 const raw=new TextEncoder().encode(signedConfigMessage(release));
 const signature=new Uint8Array(await subtle.sign({name:'ECDSA',hash:'SHA-256'},kp.privateKey,raw));
 assert.equal(signature.length,64);
 release.signature=Buffer.from(signature).toString('base64url');
 // Flip a real signature byte rather than replacing a possibly identical
 // Base64URL character: the old test failed randomly when first char was X.
 const invalidSignature=Uint8Array.from(signature);
 invalidSignature[0]^=0x01;
 const inputs={pinnedPublicJwk:key,target:'ALBot/MyAccount',minimumSequence:7,now,subtle};
 const verified=await verifySignedConfigRelease(release,inputs);
 assert.equal(verified.verified,true);
 assert.equal(verified.applied,false);
 assert.equal(verified.sequence,8);
 verified.profile.config.general.name='locally modified';
 assert.notEqual(release.profile.config.general.name,verified.profile.config.general.name);
 for(const [description,bad,extra] of [
  ['other account',{...release,target:'ALBot/OtherAccount'},{}],
  ['rollback',{...release,sequence:7},{}],
  ['equal sequence',{...release}, {minimumSequence:8}],
  ['expired',{...release,expiresAt:now-1},{}],
  ['future issue',{...release,issuedAt:now+1},{}],
  ['oversized validity',{...release,expiresAt:now+8*86400000},{}],
  ['modified settings',{...release,profile:structuredClone(release.profile)},{}],
  ['invalid signature',{...release,signature:Buffer.from(invalidSignature).toString('base64url')},{}]
 ]){
  if(description==='modified settings')bad.profile.config.farming.maxAggro=9;
  await assert.rejects(verifySignedConfigRelease(bad,{...inputs,...extra}),description);
 }
 const wrong=await subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 const wrongPublic=await subtle.exportKey('jwk',wrong.publicKey);
 await assert.rejects(verifySignedConfigRelease(release,{...inputs,pinnedPublicJwk:wrongPublic}));
});
