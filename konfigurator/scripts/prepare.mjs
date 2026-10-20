import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {Script} from 'node:vm';
const root=new URL('../../',import.meta.url);
const editor=await readFile(new URL('editor/Bot-Werkstatt.html',root),'utf8');
if(!editor.includes('INITIAL_DESCRIPTOR')||!editor.includes('INITIAL_RUNTIME'))
 throw Error('Die klassische Werkstatt muss zuerst mit npm run build:editor gebaut werden.');
const scripts=[...editor.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script\s*>/gi)];
if(scripts.length!==1)throw Error('Nur validierte Standalone-Werkstatt einbetten.');
new Script(scripts[0][1]);
await writeFile(fileURLToPath(new URL('../public/classic.html',import.meta.url)),editor);
console.log('ALBot Konfigurator: klassische Vollkonfiguration als geschützte Assetkopie vorbereitet.');
