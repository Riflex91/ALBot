import {readFile,writeFile} from 'node:fs/promises';
import {Script} from 'node:vm';
import {createHash} from 'node:crypto';
import {VERSION} from '../src/version.mjs';
import {BOOTSTRAP_RUNTIME_LIMIT,SLOT_LIMIT} from '../editor/lib/contract.mjs';
const [existing,runtime]=await Promise.all([
 readFile(new URL('../bot.js',import.meta.url),'utf8'),
 readFile(new URL('../dist/albot.runtime.js',import.meta.url),'utf8')
]);
const pos=existing.indexOf('/* ALBot ');
if(pos<100||!runtime.startsWith('/* ALBot '+VERSION))
 throw Error('Unbekannte personalisierte bot.js oder unpassende Runtime');
const prefix=existing.slice(0,pos);
const config=prefix.slice(prefix.indexOf('globalThis.ALBotConfig='));
if(!config.startsWith('globalThis.ALBotConfig=')||!config.trimEnd().endsWith('};'))
 throw Error('Persoenliches Konfigurationsformat nicht erkannt');
const originalComment=prefix.slice(0,prefix.indexOf('globalThis.ALBotConfig='));
if(!originalComment.startsWith('// ALBot '))
 throw Error('Keine unveraenderte Konfigurationsgrenze');
const nextComment=originalComment.replace(/^\/\/ ALBot [^\n]+/,
 '// ALBot '+VERSION+' | Personalisiertes Profil vom 13.10.2026');
const candidate=nextComment+config+runtime.replace(/\s+$/,'')+'\n';
if(candidate.slice(candidate.indexOf('globalThis.ALBotConfig='),candidate.indexOf('/* ALBot '))!==config)
 throw Error('Konfiguration geaendert');
// Personal local comparison artifact, never fetched by the signed loader.
if(Buffer.byteLength(runtime)>BOOTSTRAP_RUNTIME_LIMIT)throw Error('Bootstrap Runtime zu gross');
if(Buffer.byteLength(candidate)>BOOTSTRAP_RUNTIME_LIMIT+SLOT_LIMIT)throw Error('Personalisiertes Bootstrap-Artefakt zu gross');
new Script(candidate);
const hash=createHash('sha256').update(candidate).digest('hex');
if(process.argv.includes('--check')){
 if(existing!==candidate)throw Error('bot.js stimmt nicht mit gebauter Runtime ueberein');
}else if(process.argv.includes('--write')){
 await writeFile(new URL('../bot.js',import.meta.url),candidate);
}else throw Error('Nutze --check oder --write');
console.log(JSON.stringify({version:VERSION,bytes:Buffer.byteLength(candidate),sha256:hash,configBytes:Buffer.byteLength(config)}));
