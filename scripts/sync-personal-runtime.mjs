import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {VERSION} from '../src/version.mjs';

// Preserve the exact user-authored JSON settings line. Only regenerate the
// runtime below it. Refuse malformed/duplicated prefixes rather than
// overwriting a personal configuration with defaults.
const source=await readFile('bot.js','utf8');
const marker='\n/* ALBot ';
const at=source.indexOf(marker);
if(at<0||source.indexOf(marker,at+marker.length)>=0)
 throw Error('Cannot identify one personalized runtime boundary');
const prefix=source.slice(0,at+1);
const lines=prefix.trimEnd().split('\n');
if(lines.length!==2||!/^\/\/ ALBot [^\n]+ \| Personalisiertes Profil/.test(lines[0])||
   !/^globalThis\.ALBotConfig=\{.*\};$/.test(lines[1]))
 throw Error('Unexpected personalized header or JSON format; no write performed');
JSON.parse(lines[1].slice('globalThis.ALBotConfig='.length,-1));
const configHash=createHash('sha256').update(lines[1]).digest('hex');
const runtime=await readFile('dist/albot.runtime.js','utf8');
if(!runtime.startsWith('/* ALBot '+VERSION+' · Vollbetrieb'))
 throw Error('Built runtime version does not match source version');
const newPrefix=lines[0].replace(/^\/\/ ALBot [^ ]+ \|/,'// ALBot '+VERSION+' |')+
 '\n'+lines[1]+'\n';
if(createHash('sha256').update(newPrefix.split('\n')[1]).digest('hex')!==configHash)
 throw Error('Personal configuration hash mismatch');
const output=newPrefix+runtime;
await writeFile('bot.js',output,'utf8');
console.log(JSON.stringify({version:VERSION,bytes:Buffer.byteLength(output),
 configurationSha256:configHash,runtimeBytes:Buffer.byteLength(runtime)}));
