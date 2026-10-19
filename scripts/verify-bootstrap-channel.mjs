import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash, webcrypto} from 'node:crypto';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const contract = JSON.parse(read('bootstrap.contract.json'));
const loader = contract.inGameLoader;
assert.equal(loader.status, 'source-reviewed');
const loaderSource = read(loader.trackedSourcePath);
const keyMatch = loaderSource.match(/publicKey=(\{[^;]+\});/);
assert.ok(keyMatch, 'Public Key fehlt in der dokumentierten Bootstrap-Quelle');
const publicKey = JSON.parse(keyMatch[1]);
assert.equal(publicKey.kty, 'EC');
assert.equal(publicKey.crv, 'P-256');
assert.ok(loaderSource.includes('const channel="' + loader.configuredManifestUrl + '"'));
const manifestUrl = loader.configuredManifestUrl;
const allowedPrefix = 'https://raw.githubusercontent.com/Riflex91/ALBot/';
const allowedBranchPrefix = allowedPrefix + loader.releaseChannelRef + '/';
assert.ok(manifestUrl.startsWith(allowedBranchPrefix), 'Manifest-Branch ist nicht dokumentiert');

// Resolve the release branch once, then fetch immutable objects from the
// exact same commit. Raw CDN caches can otherwise return different sequence
// generations for the manifest and runtime during a concurrent publication.
// The signed manifest URLs and loader URLs remain unchanged.
async function releaseTip() {
  const endpoint='https://api.github.com/repos/Riflex91/ALBot/branches/'+
    encodeURIComponent(loader.releaseChannelRef);
  const response=await fetch(endpoint,{headers:{
    'accept':'application/vnd.github+json','cache-control':'no-cache'
  },signal:AbortSignal.timeout(15000)});
  assert.ok(response.ok,'Release-Branch konnte nicht überprüft werden: HTTP '+response.status);
  const branch=await response.json();
  assert.match(branch?.commit?.sha??'',/^[a-f0-9]{40}$/,'Release-Commit fehlt');
  return branch.commit.sha;
}
const releaseCommit=await releaseTip();
function frozenReleaseUrl(signedUrl) {
  assert.ok(signedUrl.startsWith(allowedBranchPrefix),
    'Signierte URL verlässt den festgelegten Release-Branch');
  const relative=signedUrl.slice(allowedBranchPrefix.length);
  assert.ok(['dist/albot.release.json','dist/albot.runtime.js'].includes(relative),
    'Unerwartete Release-Datei');
  return allowedPrefix+releaseCommit+'/'+relative;
}
async function fetchBytes(url, limit) {
  assert.ok(url.startsWith(allowedPrefix), 'Unbekannte GitHub-Quelle: ' + url);
  const res = await fetch(url, {method: 'GET', signal: AbortSignal.timeout(15000), headers: {'cache-control': 'no-cache'}});
  assert.ok(res.ok, url + ' -> HTTP ' + res.status);
  const data = Buffer.from(await res.arrayBuffer());
  assert.ok(data.length >= 1 && data.length <= limit, 'Unerwartete Download-Groesse: ' + url);
  return data;
}

const manifestBytes = await fetchBytes(frozenReleaseUrl(manifestUrl), 16384);
const manifest = JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(manifestBytes));
assert.equal(manifest.format, 'albot-release-v1');
assert.ok(Number.isSafeInteger(manifest.sequence) && manifest.sequence >= 1);
assert.ok(typeof manifest.version === 'string' && manifest.version.length <= 80);
assert.ok(Number.isSafeInteger(manifest.bytes) && manifest.bytes >= 1 && manifest.bytes <= 8388608);
assert.match(manifest.sha256, /^[a-f0-9]{64}$/);
assert.match(manifest.signature, /^[A-Za-z0-9_-]{86}$/);
assert.ok(manifest.runtimeUrl.startsWith(allowedBranchPrefix), 'Runtime liegt außerhalb des dokumentierten Release-Branchs');
const signedFields = ['format', 'sequence', 'version', 'runtimeUrl', 'bytes', 'sha256'];
const payload = new TextEncoder().encode(JSON.stringify(signedFields.map(name => manifest[name])));
const key = await webcrypto.subtle.importKey('jwk', publicKey, {name: 'ECDSA', namedCurve: 'P-256'}, false, ['verify']);
const valid = await webcrypto.subtle.verify({name:'ECDSA', hash:'SHA-256'}, key, Buffer.from(manifest.signature,'base64url'), payload);
assert.ok(valid, 'Das Ingame-Release-Manifest hat KEINE gültige Signatur');
for (const field of signedFields) {
  assert.equal(manifest[field], loader.inspectedManifest[field], 'Release-Kanal geändert: Manifestfeld ' + field + ' weicht vom dokumentierten Zustand ab');
}
assert.equal(manifest.runtimeUrl, loader.inspectedResolvedRuntimeUrl, 'Das signierte Manifest lädt eine andere Runtime');
const runtime = await fetchBytes(frozenReleaseUrl(manifest.runtimeUrl), 8388608);
assert.equal(runtime.length, manifest.bytes, 'Runtime-Bytezahl weicht vom signierten Manifest ab');
assert.equal(createHash('sha256').update(runtime).digest('hex'), manifest.sha256, 'Runtime-Hash weicht vom signierten Manifest ab');
const runtimeCode = new TextDecoder('utf-8', {fatal:true}).decode(runtime);
assert.ok(runtimeCode.startsWith('/* ALBot ' + manifest.version + ' '), 'Runtime-Header weicht vom signierten Versionsnamen ab');
console.log(JSON.stringify({status:'pass', releaseVersion:manifest.version, sequence:manifest.sequence, runtimeUrl:manifest.runtimeUrl, bytes:runtime.length, sha256:manifest.sha256, signatureVerified:true}));
