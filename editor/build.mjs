import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {Script} from 'node:vm';
import {FULL_DESCRIPTOR as DESCRIPTOR} from '../src/config/full.mjs';
import {checkDescriptor,defaultsFor,envelope} from './lib/contract.mjs';
const dir=fileURLToPath(new URL('./',import.meta.url));
checkDescriptor(DESCRIPTOR);
const [shell,contract,transfer,app,catalog]=await Promise.all(['shell.html','lib/contract.mjs','lib/slot-transfer.mjs','app.js','item-catalog.json'].map(p=>readFile(dir+p,'utf8')));
const pkg=JSON.parse(await readFile(new URL('../dist/albot.package.json',import.meta.url),'utf8'));
if(pkg.runtime.schemaId!==DESCRIPTOR.schemaId)throw Error('Zuerst Runtime bauen.');
const safe=s=>s.replace(/<\/script/gi,'<\\/script');
const actions=DESCRIPTOR.schema.properties.items.items.properties.action['x-labels'];
const data='const INITIAL_DESCRIPTOR='+JSON.stringify(DESCRIPTOR).replace(/</g,'\\u003c')+';\nconst DESCRIPTOR=INITIAL_DESCRIPTOR;\nconst INITIAL_RUNTIME='+JSON.stringify(pkg.runtime).replace(/</g,'\\u003c')+';\nconst INITIAL_PROFILE=null;\nconst INITIAL_CATALOG='+catalog.replace(/</g,'\\u003c')+';\nconst ACTIONS='+JSON.stringify(actions)+';';
const html=shell.replace('/*__CONTRACT__*/',()=>safe(contract.replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,''))).replace('/*__DATA__*/',()=>data).replace('/*__APP__*/',()=>safe(transfer.replace(/^export /gm,'')+'\n'+app));
// Validate the exact assembled browser script. Node module tests alone cannot
// detect malformed inline JavaScript that prevents the entire UI from starting.
const inlineScripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script\s*>/gi)];
if(inlineScripts.length!==1)throw Error('Standalone-Werkstatt muss genau ein Inline-Skript enthalten.');
new Script(inlineScripts[0][1],{filename:'Bot-Werkstatt.html:inline'});
await writeFile(dir+'Bot-Werkstatt.html',html);
await writeFile(dir+'albot.settings.json',JSON.stringify(DESCRIPTOR,null,2)+'\n');
await writeFile(dir+'example-profile.json',JSON.stringify(envelope(DESCRIPTOR,defaultsFor(DESCRIPTOR.schema)),null,2)+'\n');
console.log('Standalone-Werkstatt, Schema und Beispielprofil erstellt.');
