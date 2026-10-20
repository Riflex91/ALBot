import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {Script} from 'node:vm';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url);
const editor=await readFile(new URL('editor/Bot-Werkstatt.html',root),'utf8');
if(!editor.includes('INITIAL_DESCRIPTOR')||!editor.includes('INITIAL_RUNTIME'))
 throw Error('Die klassische Werkstatt muss zuerst mit npm run build:editor gebaut werden.');
const scripts=[...editor.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script\s*>/gi)];
if(scripts.length!==1)throw Error('Nur validierte Standalone-Werkstatt einbetten.');
new Script(scripts[0][1]);
const withCloud=editor.replace('</body></html>',
 '<script src="./classic-online.js"></script></body></html>');
if(withCloud===editor)throw Error('Editor-HTML besitzt keinen gültigen Abschluss.');
const styles=[...withCloud.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style\s*>/gi)];
if(styles.length!==1)throw Error('Editor braucht exakt eine Inline-Stylesheet-Quelle.');
const digest=s=>createHash('sha256').update(s).digest('base64');
const manifest={script:digest(scripts[0][1]),style:digest(styles[0][1])};
await writeFile(fileURLToPath(new URL('../public/classic-csp.json',import.meta.url)),JSON.stringify(manifest));
await writeFile(fileURLToPath(new URL('../public/classic.html',import.meta.url)),withCloud);
console.log('ALBot Konfigurator: klassische Vollkonfiguration als geschützte Assetkopie vorbereitet.');
