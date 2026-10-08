import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {Script} from 'node:vm';
import {createHash} from 'node:crypto';
import {checkPackage,importProfile,envelope,exportBundle} from '../editor/lib/contract.mjs';
const [profilePath,targetPath,clientPath]=process.argv.slice(2);
if(!profilePath||!targetPath)throw Error('node scripts/refresh-full.mjs Profil.json Ausgabeordner [Client-CODE-Ordner]');
const pkg=await checkPackage(JSON.parse(await readFile(new URL('../dist/albot.package.json',import.meta.url),'utf8')));
const cfg=importProfile(pkg.descriptor,JSON.parse(await readFile(resolve(profilePath),'utf8')));
cfg.general.autostart=true;
const bundle=exportBundle(pkg.descriptor,cfg,pkg.runtime);new Script(bundle.code);
const target=resolve(targetPath),stamp=new Date().toISOString().replaceAll(':','-'),backup=join(target,'backup-'+stamp);
await mkdir(backup,{recursive:true});
for(const file of ['bot.js','albot-profile.json','albot.package.json','Bot-Werkstatt.html','manifest.json'])try{await copyFile(join(target,file),join(backup,file));}catch(e){if(e.code!=='ENOENT')throw e;}
await mkdir(join(target,'docs'),{recursive:true});
await writeFile(join(target,'bot.js'),bundle.code);
await writeFile(join(target,'albot-profile.json'),JSON.stringify(envelope(pkg.descriptor,cfg),null,2)+'\n');
await writeFile(join(target,'albot.package.json'),JSON.stringify(pkg));
const workshop=await readFile(new URL('../editor/Bot-Werkstatt.html',import.meta.url),'utf8');
await writeFile(join(target,'Bot-Werkstatt.html'),workshop.replace('const INITIAL_PROFILE=null;',()=> 'const INITIAL_PROFILE='+JSON.stringify(cfg).replaceAll('<','\\u003c')+';'));
const manifest={version:pkg.runtime.version,bytes:bundle.bytes,sha256:createHash('sha256').update(bundle.code).digest('hex'),autostart:true,liveTest:'pending',oneCombinedProfile:true};
await writeFile(join(target,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
await copyFile(new URL('../docs/PARITAET-0.8.0.md',import.meta.url),join(target,'docs/PARITAET-0.8.0.md'));
await copyFile(new URL('../docs/CHANGELOG-0.8.1.md',import.meta.url),join(target,'docs/CHANGELOG-0.8.1.md'));
await copyFile(new URL('../docs/CHANGELOG-0.8.2.md',import.meta.url),join(target,'docs/CHANGELOG-0.8.2.md'));
await copyFile(new URL('../docs/CHANGELOG-0.8.3.md',import.meta.url),join(target,'docs/CHANGELOG-0.8.3.md'));
await copyFile(new URL('../docs/CHANGELOG-0.8.4.md',import.meta.url),join(target,'docs/CHANGELOG-0.8.4.md'));
if(clientPath){const client=resolve(clientPath);await mkdir(client,{recursive:true});try{await copyFile(join(client,'bot.js'),join(client,'bot-backup-'+stamp+'.js'));}catch(e){if(e.code!=='ENOENT')throw e;}await copyFile(join(target,'bot.js'),join(client,'bot.js'));}
console.log(JSON.stringify({...manifest,backup}));
