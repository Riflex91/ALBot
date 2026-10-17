#!/usr/bin/env node
// Offline-only. Reads existing ALBot test-report JSON files, makes no game calls.
import {readFile,writeFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {analyzeLiveTeam} from './lib/live-team-audit.mjs';
function parse(argv){
 const opts={strict:false,requireElixirs:false},files=[];
 for(let i=0;i<argv.length;i++){
  const a=argv[i];
  if(a==='--strict')opts.strict=true;
  else if(a==='--require-elixirs')opts.requireElixirs=true;
  else if(['--out','--merchant','--max-departures','--max-idle-seconds','--min-idle-seconds'].includes(a)){
   if(!argv[i+1])throw Error('Missing value for '+a);
   const v=argv[++i];
   if(a==='--out')opts.out=v;
   else if(a==='--merchant')opts.merchant=v;
   else{
    const n=Number(v);if(!Number.isFinite(n)||n<0)throw Error('Invalid bound: '+v);
    if(a==='--max-departures')opts.maxPursuitDepartures=n;
    else if(a==='--max-idle-seconds')opts.maxSampledIdleSeconds=n;
    else opts.minIdleSeconds=n;
   }
  }else if(a.startsWith('--'))throw Error('Unknown option: '+a);
  else files.push(a);
 }
 if(files.length<2||files.length>16)throw Error('Pass 2 to 16 test-report JSON paths');
 return {opts,files};
}
export async function main(argv){
 const {opts,files}=parse(argv),reports=[];
 for(const name of files){
  const info=await stat(name);
  if(!info.isFile()||info.size>8*1024*1024)throw Error('Invalid or oversized test report: '+name);
  reports.push(JSON.parse(await readFile(name,'utf8')));
 }
 const {out,...auditOptions}=opts;
 const result=analyzeLiveTeam(reports,auditOptions),serialized=JSON.stringify(result,null,2)+'\n';
 if(out)await writeFile(out,serialized,'utf8');
 process.stdout.write(serialized);
 if(!result.accepted)process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 main(process.argv.slice(2)).catch(e=>{
  console.error('ALBot live audit failed: '+(e?.message??e));
  process.exitCode=2;
 });
}
