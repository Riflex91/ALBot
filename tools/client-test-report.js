import {mkdirSync,writeFileSync,renameSync,appendFileSync,statSync} from 'node:fs';
import {homedir} from 'node:os';
import {resolve,join} from 'node:path';

// Compact latest report plus optional session logs; final sync write survives CODE teardown.
const sessions=new Map();
export function writeTestReport(name,content,root=resolve('test-logs'),desktop=join(homedir(),'Desktop','ALBot-Testlogs')){
  if(typeof name!=='string'||!/^[A-Za-z0-9_]{1,64}$/.test(name))throw Error('Ungueltiger Charaktername fuer Testbericht.');
  if(typeof content!=='string'||Buffer.byteLength(content,'utf8')>1048576)throw Error('Testbericht maximal 1 MiB.');
  const data=JSON.parse(content);if(data?.format!=='albot-test-report'||data.formatVersion!==1)throw Error('Unbekanntes Testberichtformat.');
  const directory=join(root,name),file=join(directory,'test-ausgeführtertest.json');
  mkdirSync(directory,{recursive:true});writeFileSync(file+'.tmp',content,{encoding:'utf8',mode:0o600});renameSync(file+'.tmp',file);
  if(data.continuousLog!==true)return file;
  if(data.character!==name||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(data.started??'')||!Number.isFinite(Date.parse(data.started))||!Array.isArray(data.events))throw Error('Ungueltige fortlaufende Testdaten.');
  const key=name+':'+data.started,state=sessions.get(key)??{seq:0,part:1};
  const events=data.events.filter(e=>Number.isSafeInteger(e.seq)&&e.seq>state.seq);
  const snapshot={...data,type:'snapshot'};delete snapshot.events;delete snapshot.settings;
  const header={type:'session',time:data.started,character:name,version:data.version,environment:data.environment,settings:data.settings};
  const first=events[0]?.seq,gap=first>state.seq+1?{type:'log.gap',from:state.seq+1,to:first-1}:null;
  let lines=[gap,...events,snapshot].filter(Boolean).map(x=>JSON.stringify(x)).join('\n')+'\n';
  const filename=()=>join(desktop,'test-'+name+'-'+data.started.replace(/[:.]/g,'-')+'-part'+String(state.part).padStart(3,'0')+'.jsonl');
  mkdirSync(desktop,{recursive:true});let log=filename();let size=0;try{size=statSync(log).size;}catch{}
  if(size+Buffer.byteLength(lines)>16*1024*1024){state.part++;log=filename();size=0;}
  if(size===0)lines=JSON.stringify(header)+'\n'+lines;
  appendFileSync(log,lines,{encoding:'utf8',mode:0o600});state.seq=events.at(-1)?.seq??state.seq;sessions.set(key,state);if(sessions.size>64)sessions.delete(sessions.keys().next().value);return log;
}
