#!/usr/bin/env node
// Offline-only report comparison. Does not contact Adventure Land or GitHub,
// mutate bot state or enable any combat/economic operation.
import {readFile,stat} from 'node:fs/promises';
import {compareReplayReports} from '../src/world/replay-evidence.mjs';

async function load(path){
 const info=await stat(path);
 if(!info.isFile()||info.size>8*1024*1024)throw Error('Invalid or oversized report');
 const source=await readFile(path,'utf8');
 return JSON.parse(source);
}
const files=process.argv.slice(2);
if(files.length!==2){
 console.error('Usage: node scripts/COMPARE-LIVE-EPISODES.mjs BASELINE.json CANDIDATE.json');
 process.exitCode=2;
}else{
 try{
  const [base,next]=await Promise.all(files.map(load));
  const result=compareReplayReports([base],[next],{
   minimumEpisodes:1,minExposureMs:60000
  });
  console.log(JSON.stringify(result,null,2));
  if(!result.valid)process.exitCode=1;
 }catch(e){
  console.error('Replay input refused: '+(e?.message??e));
  process.exitCode=2;
 }
}
