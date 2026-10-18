import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createBootstrap,personalPrefix} from './bootstrap-support.mjs';
import {VERSION} from '../src/version.mjs';

const [personal,runtime]=await Promise.all([
 readFile(new URL('../bot.js',import.meta.url),'utf8'),
 readFile(new URL('../dist/albot.runtime.js',import.meta.url),'utf8')
]);
if(!runtime.startsWith('/* ALBot '+VERSION))
 throw Error('Runtime version does not match current source');
const result=createBootstrap({prefix:personalPrefix(personal),runtime});
if(result.bootstrapBytes>65536)
 throw Error('Bootstrap too large (64 KiB gate)');
const out=new URL('../dist/albot.bootstrap.js',import.meta.url);
if(process.argv.includes('--check')){
 const existing=await readFile(out,'utf8');
 if(existing!==result.code)throw Error('Pinned bootstrap is not synchronized');
}else if(process.argv.includes('--write')){
 await mkdir(new URL('../dist/',import.meta.url),{recursive:true});
 await writeFile(out,result.code);
}else throw Error('Use --write or --check');
console.log(JSON.stringify({version:VERSION,bootstrapBytes:result.bootstrapBytes,
 runtimeBytes:result.runtimeBytes,sha256:result.sha256,url:result.url}));
