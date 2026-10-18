import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8'),save=(p,s)=>fs.writeFileSync(p,s);
const file='bootstrap.contract.json',contract=JSON.parse(read(file));
const old=contract.inGameLoader.inspectedManifest;
const manifest=JSON.parse(read('dist/albot.release.json'));
if(contract.inGameLoader.status!=='source-reviewed'||
 contract.inGameLoader.releaseChannelRef!=='codex/w00-w01-readonly-disposition-20261018'||
 contract.inGameLoader.configuredManifestUrl!=='https://raw.githubusercontent.com/Riflex91/ALBot/codex/w00-w01-readonly-disposition-20261018/dist/albot.release.json'||
 contract.inGameLoader.observedLoadedUrl!==null||
 old.sequence!==1||old.version!=='0.10.9-candidate')
 throw Error('Bootstrap contract changed; do not rewrite unverified loader metadata');
if(manifest.sequence!==old.sequence+1||
 manifest.runtimeUrl!==old.runtimeUrl||
 manifest.format!==old.format||manifest.version!=='0.10.10-candidate')
 throw Error('Unexpected release channel or unsigned version transition');
contract.inGameLoader.inspectedManifest={
 format:manifest.format,sequence:manifest.sequence,version:manifest.version,
 runtimeUrl:manifest.runtimeUrl,bytes:manifest.bytes,sha256:manifest.sha256};
contract.inGameLoader.inspectedResolvedRuntimeUrl=manifest.runtimeUrl;
contract.inGameLoader.note='Signed manifest and runtime updated by verified integration; this is the configured CODE channel, not a live game observation. The personal in-game ALBotConfig remains independent of repository bot.js.';
save(file,JSON.stringify(contract,null,2)+'\n');
const path='docs/BOOTSTRAP-VERTRAG.md';let doc=read(path);
const edits=[
 ['| Manifest @T@sequence@T@ | @T@'+old.sequence+'@T@ |','| Manifest @T@sequence@T@ | @T@'+manifest.sequence+'@T@ |'],
 ['| Manifest @T@version@T@ | @T@'+old.version+'@T@ |','| Manifest @T@version@T@ | @T@'+manifest.version+'@T@ |'],
 ['| Manifest @T@bytes@T@ | @T@'+old.bytes+'@T@ |','| Manifest @T@bytes@T@ | @T@'+manifest.bytes+'@T@ |'],
 ['| Manifest @T@sha256@T@ | @T@'+old.sha256+'@T@ |','| Manifest @T@sha256@T@ | @T@'+manifest.sha256+'@T@ |'],
 ['Grundlage: vom Benutzer übermittelter CODE, zuletzt gekennzeichnet als @T@ALBot 0.10.9-candidate@T@, und zum Prüfzeitpunkt öffentlich abrufbares GitHub-Release-Manifest.',
  'Grundlage: vom Benutzer übermittelter CODE und das für die Integration signierte Release-Manifest. Der tatsächliche Spielstart wurde nicht beobachtet.'],
 ['## Tatsächlich adressiertes Release-Artefakt (Momentaufnahme 18.10.2026)',
  '## Signiertes Release-Artefakt (Integrationsstand 18.10.2026)'],
 ['**Konsequenz:** Die persönliche @T@main/bot.js@T@ (@T@0.10.10-candidate@T@) ist **nicht der vom Bootstrap geladenen Datei gleichzusetzen**. Die @T@main/dist/albot.runtime.js@T@ ist ebenfalls ein anderer, beim Build generierter Stand. Ob eine Änderung aus @T@main@T@ im Spiel wirksam wird, hängt davon ab, ob das Release-Manifest auf einen neuen, korrekt signierten Runtime-Artefaktstand umgestellt wird. Änderungen des signierten Manifests erfordern einen gültigen Signierschlüssel; ein reiner Branch-Merge bewirkt das nicht.',
  '**Konsequenz:** Der Bootstrap folgt dem dokumentierten signierten Release-Branch und @T@manifest.runtimeUrl@T@, nicht automatisch @T@main/bot.js@T@. Integrierte Quelle und signierte Runtime wurden in CI gebaut und kryptografisch verifiziert; ein tatsächlicher Spielstart ist ohne Live-Nachweis unbekannt. Das persönliche Ingame-@T@ALBotConfig@T@ bleibt unabhängig von der Repository-@T@bot.js@T@.']
];
for(const [a,b] of edits){const from=a.replaceAll('@T@',String.fromCharCode(96)),to=b.replaceAll('@T@',String.fromCharCode(96));if(!doc.includes(from))throw Error('Bootstrap documentation anchor missing: '+from.slice(0,70));doc=doc.replace(from,to);}
save(path,doc);
// Keep new main's authoritative reference after README/AGENTS conflict merge.
for(const name of ['README.md','AGENTS.md']){
 let text=read(name);
 const raw='https://raw.githubusercontent.com/Riflex91/ALBot/main/bot.js';
 if(!text.includes('bootstrap.contract.json')||
    !text.includes(raw)||
    !text.includes(contract.inGameLoader.configuredManifestUrl)||
    !text.includes(contract.inGameLoader.inspectedResolvedRuntimeUrl))
  text+='\n\n## Dokumentierter Ingame-Bootstrap-Kanal\n\n'+
   'Der überprüfte Bootstrap-Vertrag steht in `bootstrap.contract.json` und `docs/BOOTSTRAP-VERTRAG.md`. '+
   'Die persönliche Hauptdatei liegt unter '+raw+'. '+
   'Der beobachtete CODE-Quelltext verweist auf '+contract.inGameLoader.configuredManifestUrl+'. '+
   'Das signierte Manifest benennt '+contract.inGameLoader.inspectedResolvedRuntimeUrl+'. '+
   'Der Ingame-Ladeerfolg ist noch **nicht** live beobachtet.\n';
 save(name,text);
}
const script='scripts/verify-bootstrap-contract.mjs';let source=read(script);
const oldAssert="assert.equal(loader.inspectedManifest.version, '0.10.9-candidate');";
if(!source.includes(oldAssert))throw Error('Unexpected bootstrap verifier');
source=source.replace(oldAssert,"assert.ok(/^0\\.\\d+\\.\\d+-candidate$/.test(loader.inspectedManifest.version), 'Release snapshot version unrecognized');");
save(script,source);
console.log(JSON.stringify({bootstrapContractUpdated:true,releaseSequence:manifest.sequence,version:manifest.version,sha256:manifest.sha256,bytes:manifest.bytes,observedLoadedUrl:contract.inGameLoader.observedLoadedUrl}));
