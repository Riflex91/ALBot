export function createTestReport(p,version){
  const events=[],incidents=[],counts={};let dropped=0,lastSample=0,lastSave=0,automaticDownload=false,provider=()=>({}),lastWriteError='';
  const clean=value=>String(value??'').replace(/\b(?:US|CH)_[A-Za-z0-9]+\b/g,'[redacted]').replace(/((?:token|password|authorization|user_auth)\s*[:=]\s*)[^\s,;]+/gi,'$1[redacted]').slice(0,1800);
  const started=new Date().toISOString();
  function event(type,data={}){
    counts[type]=(counts[type]??0)+1;
    const safe={};for(const [k,v] of Object.entries(data)){if(/password|token|auth|cookie/i.test(k))continue;safe[k]=typeof v==='number'||typeof v==='boolean'||v===null?v:clean(v);}
    const entry={time:new Date().toISOString(),type,...safe};events.push(entry);if(type==='error'){incidents.push(entry);if(incidents.length>24)incidents.shift();}if(events.length>256){events.shift();dropped++;}
  }
  function document(){const c=p.c;return {format:'albot-test-report',formatVersion:1,test:'Live A',version,started,exported:new Date().toISOString(),environment:p.headless?'headless':'browser',character:c?.name??null,gameVersion:p.G?.version??null,realm:p.realm(),storageError:clean(p.storageError),lastWriteError,counts:{...counts},dropped,...provider(),incidents:[...incidents],events:[...events]};}
  function text(){const data=document();let result=JSON.stringify(data,null,2);while(new TextEncoder().encode(result).length>900*1024&&data.events.length){data.events.splice(0,Math.min(32,data.events.length));data.exportTrimmed=true;result=JSON.stringify(data,null,2);}return result;}
  function save(){
    const content=text();
    try{
      if(p.headless){if(typeof p.h?.writeTestReport!=='function')throw Error('Client benötigt writeTestReport; alternativ ALBot.testReport() kopieren');const path=p.h.writeTestReport(content);lastWriteError='';return path;}
      const win=p.parent,doc=win.document;if(!doc?.body||!win.URL?.createObjectURL||!win.Blob)throw Error('Browser-Download nicht verfügbar; ALBot.testReport() kopieren');
      const url=win.URL.createObjectURL(new win.Blob([content],{type:'application/json;charset=utf-8'}));const a=doc.createElement('a');a.href=url;a.download='test-ausgeführtertest.json';doc.body.append(a);a.click();a.remove();win.setTimeout(()=>win.URL.revokeObjectURL(url),1000);lastWriteError='';return a.download;
    }catch(e){lastWriteError=clean(e.message);p.log('Testdatei: '+lastWriteError);return null;}
  }
  return {event,text,document,setProvider:f=>provider=f,
    error(where,e){event('error',{where,name:e?.name,message:e?.message??e?.reason??e,stack:e?.stack});},
    sample(){const now=Date.now();if(now-lastSample>=5000){lastSample=now;const c=p.c;event('sample',{map:c?.map,x:c?.real_x??c?.x,y:c?.real_y??c?.y,hp:c?.hp,mp:c?.mp,target:c?.target,rip:!!c?.rip});}if(p.headless&&now-lastSave>=10000){lastSave=now;save();}},
    flush(automatic=false){if(p.headless)return save();if(automatic){if(automaticDownload)return;automaticDownload=true;}return save();}
  };
}
