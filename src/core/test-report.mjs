export function createTestReport(p,version){
  const events=[],incidents=[],counts={},actionStats={};let dropped=0,lastSample=0,lastSave=0,automaticDownload=false,provider=()=>({}),lastWriteError='',continuous=false,sequence=0,directory=null,writing=Promise.resolve(),writeBusy=false,queuedData=null,savedSequence=0,part=1,fileBytes=0,lastDecision='';
  const clean=value=>String(value??'').replace(/\b(?:US|CH)_[A-Za-z0-9]+\b/g,'[redacted]').replace(/((?:token|password|authorization|user_auth)\s*[:=]\s*)[^\s,;]+/gi,'$1[redacted]').slice(0,1800);
  const started=new Date().toISOString();
  const pickerWindow=()=>typeof p.parent?.showDirectoryPicker==='function'?p.parent:typeof p.root?.showDirectoryPicker==='function'?p.root:null;
  const capabilities=()=>({mode:p.headless?'headless':pickerWindow()?'directory':'download',directory:!p.headless&&!!pickerWindow()});
  function event(type,data={}){
    counts[type]=(counts[type]??0)+1;
    if(type==='action.start'||type==='action.end'||type==='action.transient'){const key=clean(data.key||'unknown').slice(0,120),a=actionStats[key]??(actionStats[key]={started:0,ended:0,results:{},transient:0,transientReasons:{}});if(type==='action.start')a.started++;else if(type==='action.end'){a.ended++;const result=clean(data.result||'unknown').slice(0,80);a.results[result]=(a.results[result]??0)+1;}else{a.transient++;const reason=clean(data.reason||'unknown').slice(0,120);a.transientReasons[reason]=(a.transientReasons[reason]??0)+1;}}
    const safe={};for(const [k,v] of Object.entries(data)){if(/password|token|auth|cookie/i.test(k))continue;safe[k]=typeof v==='number'||typeof v==='boolean'||v===null?v:clean(v);}
    const entry={seq:++sequence,time:new Date().toISOString(),type,...safe};events.push(entry);if(type==='error'){incidents.push(entry);if(incidents.length>24)incidents.shift();}if(events.length>(continuous?2048:256)){events.shift();dropped++;}
  }
  const filename=extension=>'test-'+String(p.c?.name??'unknown').replace(/[^A-Za-z0-9_-]/g,'_')+'-'+started.replace(/[:.]/g,'-')+'-part'+String(part).padStart(3,'0')+'.'+extension;
  function document(){const c=p.c;return {format:'albot-test-report',formatVersion:1,test:'Live A',version,started,exported:new Date().toISOString(),continuousLog:continuous,logFilename:filename('jsonl'),logDirectory:directory?.name??null,logCapabilities:capabilities(),environment:p.headless?'headless':'browser',character:c?.name??null,gameVersion:p.G?.version??null,realm:p.realm(),storageError:clean(p.storageError),lastWriteError,counts:{...counts},actionStats:JSON.parse(JSON.stringify(actionStats)),dropped,...provider(),incidents:[...incidents],events:[...events]};}
  function text(){const data=document();let result=JSON.stringify(data,null,2);while(new TextEncoder().encode(result).length>900*1024&&data.events.length){data.events.splice(0,Math.min(32,data.events.length));data.exportTrimmed=true;result=JSON.stringify(data,null,2);}return result;}
  function save(){
    const content=text();
    try{
      if(p.headless){if(typeof p.h?.writeTestReport!=='function')throw Error('Client benötigt writeTestReport; alternativ ALBot.testReport() kopieren');const path=p.h.writeTestReport(content);lastWriteError='';return path;}
      if(continuous&&directory){queueWrite();return filename('jsonl');}
      const win=p.parent,doc=win.document;if(!doc?.body||!win.URL?.createObjectURL||!win.Blob)throw Error('Browser-Download nicht verfügbar; ALBot.testReport() kopieren');
      const url=win.URL.createObjectURL(new win.Blob([content],{type:'application/json;charset=utf-8'}));const a=doc.createElement('a');a.href=url;a.download=continuous?filename('json'):'test-ausgeführtertest.json';doc.body.append(a);a.click();a.remove();win.setTimeout(()=>win.URL.revokeObjectURL(url),1000);lastWriteError='';return a.download;
    }catch(e){lastWriteError=clean(e.message);p.log('Testdatei: '+lastWriteError);return null;}
  }
  function queueWrite(){queuedData=document();if(writeBusy)return writing;writeBusy=true;writing=(async()=>{while(queuedData){const data=queuedData;queuedData=null;
    if(!directory)return;const delta=data.events.filter(e=>e.seq>savedSequence),first=delta[0]?.seq;
    const header={type:'session',time:started,character:data.character,version,environment:data.environment,settings:data.settings};
    const snapshot={...data,type:'snapshot'};delete snapshot.events;delete snapshot.settings;
    const gap=first>savedSequence+1?{type:'log.gap',from:savedSequence+1,to:first-1,reason:'Ereignisse vor Ordnerfreigabe oder während Schreibfehler nur begrenzt im RAM'}:null;
    let lines=[fileBytes===0?header:null,gap,...delta,snapshot].filter(Boolean).map(x=>JSON.stringify(x)).join('\n')+'\n';
    if(fileBytes+new TextEncoder().encode(lines).length>16*1024*1024){part++;fileBytes=0;lines=JSON.stringify(header)+'\n'+lines;}
    const handle=await directory.getFileHandle(filename('jsonl'),{create:true}),file=await handle.getFile(),stream=await handle.createWritable({keepExistingData:true});try{await stream.seek(file.size);await stream.write(lines);await stream.close();}catch(e){await stream.abort?.();throw e;}
    fileBytes=file.size+new TextEncoder().encode(lines).length;savedSequence=delta.at(-1)?.seq??savedSequence;lastWriteError='';
   }})().catch(e=>{lastWriteError=clean(e.message);p.log('Testdatei: '+lastWriteError);}).finally(()=>{writeBusy=false;});return writing;}
  async function chooseDirectory(){if(p.headless)return save();const win=pickerWindow();if(!win){p.log('Dieser Browser-Spielkontext erlaubt keine Ordnerauswahl. Testlog speichern verwenden; Speicherort in den Browser-Downloads einstellen.');return false;}try{directory=await win.showDirectoryPicker({id:'albot-testlogs',mode:'readwrite',startIn:'desktop'});event('log.directory',{name:directory.name});await queueWrite();return directory.name;}catch(e){lastWriteError=clean(e.message);p.log('Ordnerauswahl fehlgeschlagen: '+lastWriteError+'. Testlog speichern verwenden.');return false;}}
  return {event,text,document,setProvider:f=>provider=f,
    configure({continuous:value=false}){continuous=value;},chooseDirectory,capabilities,
    error(where,e){event('error',{where,name:e?.name,message:e?.message??e?.reason??e,stack:e?.stack});},
    sample(state={}){const now=Date.now();if(now-lastSample>=5000){lastSample=now;const c=p.c;event('sample',{reason:state.reason,running:state.running,map:c?.map,x:c?.real_x??c?.x,y:c?.real_y??c?.y,hp:c?.hp,mp:c?.mp,gold:c?.gold,target:c?.target,rip:!!c?.rip});if(continuous){const d=provider(),decision=JSON.stringify({reason:state.reason,target:d.status?.target,task:d.status?.task,movement:d.movement?.owner,merchantTask:d.merchantTask?.task,productionGoal:d.production?.goal,blocked:d.production?.blocked,team:d.account?.names});if(decision!==lastDecision){lastDecision=decision;event('decision',{state:decision});}}}if((p.headless||continuous&&directory)&&now-lastSave>=10000){lastSave=now;save();}},
    flush(automatic=false){if(p.headless||continuous&&directory)return save();if(automatic){if(automaticDownload)return;automaticDownload=true;}return save();}
  };
}
