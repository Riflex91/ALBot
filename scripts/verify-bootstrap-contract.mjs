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
if (contract.inGameLoader.status === 'unverified') {
  assert.equal(contract.inGameLoader.trackedSourcePath, null, 'Unverifizierter Loader darf keinen belegten Repository-Quellpfad behaupten');
  assert.equal(contract.inGameLoader.observedLoadedUrl, null, 'Unverifizierter Loader darf keine beobachtete Ladeadresse behaupten');
  console.warn('HINWEIS: Der externe Ingame-Bootstrap wurde nicht bereitgestellt; sein tatsächliches Ladeziel ist NICHT verifiziert.');
} else {
  assert.fail('Loader-Status geändert: Verifikationslogik für den echten Bootstrap zuerst implementieren und prüfen.');
}

console.log(JSON.stringify({
  status: 'pass',
  version: VERSION,
  personalCode: contract.canonicalPersonalCode,
  canonicalUrl: contract.canonicalPersonalRawUrl,
  runtimeVerified: true,
  generatedBundleVerified: true,
  inGameLoader: contract.inGameLoader.status
}));
