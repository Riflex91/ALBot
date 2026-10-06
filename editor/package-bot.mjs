// Publish a finished runtime to the existing workshop; no editor rebuild needed.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {DESCRIPTOR} from './lib/schema.mjs';
import {checkDescriptor,checkPackage,exportBundle,defaultsFor,parseData} from './lib/contract.mjs';
const args=process.argv.slice(2),options={};
for(let i=0;i<args.length;i+=2){if(!['--runtime','--version','--out','--schema'].includes(args[i])||!args[i+1])throw Error('Aufruf: node editor/package-bot.mjs --runtime dist/albot.js --version 1.0.0 --out albot.package.json [--schema albot.settings.json]');options[args[i]]=args[i+1];}
if(!options['--runtime']||!options['--version']||!options['--out'])throw Error('Runtime, Version und Ausgabepfad sind erforderlich.');
const descriptor=options['--schema']?checkDescriptor(parseData(await readFile(options['--schema'],'utf8'))):DESCRIPTOR;
const code=await readFile(options['--runtime'],'utf8');
new vm.Script(code,{filename:options['--runtime']}); // syntax only; never execute
const runtime={version:options['--version'],schemaId:descriptor.schemaId,contractVersion:1,code,sha256:createHash('sha256').update(code).digest('hex')};
const pkg={format:'albot-package',formatVersion:1,descriptor,runtime};
await checkPackage(pkg);
const bytes=exportBundle(descriptor,defaultsFor(descriptor.schema),runtime).bytes;
await writeFile(options['--out'],JSON.stringify(pkg,null,2)+'\n');
console.log('Bot-Paket erstellt. Mit Vorgabekonfiguration: '+bytes+' UTF-8-Bytes. Integration und Spielfunktionen müssen zuvor geprüft sein.');
