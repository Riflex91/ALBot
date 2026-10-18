import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {VERSION} from '../src/version.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const bytes = path => readFileSync(new URL('../' + path, import.meta.url));
const contract = JSON.parse(read('bootstrap.contract.json'));
const exactRawUrl = 'https://raw.githubusercontent.com/Riflex91/ALBot/main/bot.js';

assert.equal(contract.format, 'albot-bootstrap-contract');
assert.equal(contract.formatVersion, 1);
assert.equal(contract.repository, 'Riflex91/ALBot');
assert.equal(contract.branch, 'main');
assert.equal(contract.canonicalPersonalCode, 'bot.js');
assert.equal(contract.canonicalPersonalRawUrl, exactRawUrl);
assert.equal(contract.builtRuntime, 'dist/albot.runtime.js');
assert.equal(contract.genericBundle, 'dist/albot.js');
assert.equal(contract.sourceVersion, 'src/version.mjs');

for (const path of ['README.md', 'AGENTS.md']) {
  const content = read(path);
  assert.ok(content.includes('bootstrap.contract.json'), path + ' muss den maschinenlesbaren Vertrag nennen');
  assert.ok(content.includes(exactRawUrl), path + ' muss die exakte persönliche Raw-Adresse nennen');
  assert.ok(content.includes('nicht') || content.includes('unverified'), path + ' muss auf die offene Loader-Verifikation hinweisen');
}

const personal = read(contract.canonicalPersonalCode);
const runtime = read(contract.builtRuntime);
const generic = read(contract.genericBundle);
const manifest = JSON.parse(read('dist/manifest.json'));
const runtimeMarker = '/* ALBot ' + VERSION;
const runtimeStart = personal.indexOf(runtimeMarker);
assert.ok(personal.startsWith('// ALBot ' + VERSION + ' |'), 'Die persönliche bot.js hat eine abweichende Header-Version');
assert.ok(personal.includes('globalThis.ALBotConfig='), 'Die persönliche bot.js enthält keine Konfiguration');
assert.ok(runtimeStart > 100, 'Die persönliche bot.js enthält keine passend versionierte Runtime');
assert.ok(runtime.startsWith(runtimeMarker), 'Die gebaute Runtime hat eine andere Version');
assert.equal(personal.slice(runtimeStart), runtime.trimEnd() + '\n', 'Die in bot.js enthaltene Runtime weicht vom frisch gebauten Runtime-Bundle ab');
assert.ok(generic.startsWith('// ALBot ' + VERSION + ' |'), 'Das generische Bundle hat eine abweichende Version');
assert.equal(manifest.version, VERSION, 'Das dist-Manifest hat eine abweichende Version');
assert.equal(manifest.bytes, bytes(contract.genericBundle).length, 'Manifest-Bytezahl des generischen Bundles stimmt nicht');
assert.equal(manifest.sha256, createHash('sha256').update(bytes(contract.genericBundle)).digest('hex'), 'Manifest-SHA256 des generischen Bundles stimmt nicht');
assert.equal(manifest.runtimeBytes, bytes(contract.builtRuntime).length, 'Manifest-Runtime-Bytezahl stimmt nicht');

assert.ok(contract.inGameLoader && typeof contract.inGameLoader === 'object', 'Loader-Status fehlt');
const loader = contract.inGameLoader;
assert.equal(loader.status, 'source-reviewed', 'Ingame-Loader muss als geprüftes, aber nicht live-beobachtetes Quellmaterial markiert sein');
assert.equal(loader.trackedSourcePath, 'bootstrap/ingame-loader-v2.js');
assert.equal(loader.releaseChannelRef, 'codex/w00-w01-readonly-disposition-20261018');
assert.equal(loader.observedLoadedUrl, null, 'Ohne Live-Nachweis keine beobachtete URL behaupten');
const loaderCode = read(loader.trackedSourcePath);
assert.ok(loaderCode.includes('const channel="' + loader.configuredManifestUrl + '"'), 'Der Loader zeigt auf einen anderen Manifest-Kanal');
assert.ok(loaderCode.includes('const raw=await request(manifest.runtimeUrl,8388608);'), 'Der Loader lädt die Runtime nicht mehr dynamisch aus manifest.runtimeUrl');
assert.ok(loaderCode.includes('root.crypto.subtle.verify('), 'Signaturprüfung aus dem Loader entfernt');
assert.ok(loaderCode.includes('await digest(raw)!==manifest.sha256'), 'Hashprüfung aus dem Loader entfernt');
assert.equal(loader.inspectedManifest.runtimeUrl, loader.inspectedResolvedRuntimeUrl);
assert.ok(/^0\.\d+\.\d+-candidate$/.test(loader.inspectedManifest.version), 'Release snapshot version unrecognized');
for (const path of ['README.md', 'AGENTS.md', 'docs/BOOTSTRAP-VERTRAG.md']) {
  const content = read(path);
  assert.ok(content.includes(loader.configuredManifestUrl), path + ' muss den Ingame-Manifest-Kanal nennen');
  assert.ok(content.includes(loader.inspectedResolvedRuntimeUrl), path + ' muss die aus dem Manifest bekannte Runtime-URL nennen');
}
console.log(JSON.stringify({
  status: 'pass', mainBuildVersion: VERSION,
  mainPersonalCode: contract.canonicalPersonalCode,
  inGameManifest: loader.configuredManifestUrl,
  inspectedInGameVersion: loader.inspectedManifest.version,
  inGameLoader: loader.status
}));
