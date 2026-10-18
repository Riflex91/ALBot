import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {personalPrefix} from './bootstrap-support.mjs';
import {createAutoBootstrap} from './auto-bootstrap-support.mjs';
const root=new URL('../',import.meta.url);
const [personal,pub]=await Promise.all([
 readFile(new URL('bot.js',root),'utf8'),
 readFile(new URL('release/public-key.json',root),'utf8')
]);
const result=createAutoBootstrap({prefix:personalPrefix(personal),
 publicKey:JSON.parse(pub)});
if(result.bootstrapBytes>65536)
 throw Error('Auto bootstrap is over 64 KiB');
const file=new URL('dist/albot.bootstrap.auto.js',root);
if(process.argv.includes('--write')){
 await mkdir(new URL('dist/',root),{recursive:true});
 await writeFile(file,result.code);
}else if(process.argv.includes('--check')){
 if(await readFile(file,'utf8')!==result.code)
  throw Error('Auto bootstrap differs from pinned public key or personal configuration');
}else throw Error('Use --write or --check');
console.log(JSON.stringify({bootstrapBytes:result.bootstrapBytes,
 manifestUrl:result.manifestUrl,autostart:/\"autostart\": true/.test(result.code)}));
