// Browser downloads cannot replace existing files. Use the user's explicit
// File System Access permission for a real overwrite, with an honest legacy
// download fallback on unsupported browsers.
export function stableLogName(kind,character){
 const name=String(character??'unknown').replace(/[^A-Za-z0-9_-]/g,'_');
 return (kind==='team'?'albot-teamcheck-':'test-')+name+'.json';
}
export function createOverwriteLogSaver(p,getDirectory=()=>null){
 const handles=new Map();
 function pickerWindow(){
  return [p.parent,p.root].find(w=>typeof w?.showSaveFilePicker==='function');
 }
 async function write(handle,content){
  const stream=await handle.createWritable();
  try{await stream.write(content);await stream.close();}
  catch(e){await stream.abort?.();throw e;}
 }
 function download(name,content){
  const win=p.parent,doc=win?.document;
  if(!doc?.body||!win.URL?.createObjectURL||!win.Blob)
   throw Error('Browser-Download nicht verfügbar');
  const url=win.URL.createObjectURL(new win.Blob([content],{
   type:'application/json;charset=utf-8'}));
  const a=doc.createElement('a');a.href=url;a.download=name;
  doc.body.append(a);a.click();a.remove();
  win.setTimeout(()=>win.URL.revokeObjectURL(url),1000);
  return {filename:name,overwritten:false,method:'download',
   notice:'Browser-Download kann vorhandene Dateien nicht überschreiben; Datei kann mit (1) ergänzt werden'};
 }
 return {async save(name,content){
  if(p.headless)return {filename:null,overwritten:false,method:'headless-unsupported'};
  try{
   const directory=getDirectory();
   if(directory?.getFileHandle){
    const handle=await directory.getFileHandle(name,{create:true});
    await write(handle,content);
    return {filename:name,overwritten:true,method:'directory'};
   }
   let handle=handles.get(name);
   const win=pickerWindow();
   if(!handle&&win){
    try{
     handle=await win.showSaveFilePicker({
      id:'albot-'+name.replace(/[^a-zA-Z0-9]/g,'-').slice(0,28),
      suggestedName:name,
      types:[{description:'ALBot JSON',accept:{'application/json':['.json']}}]
     });
    }catch(e){
     if(e?.name==='AbortError')return {
      filename:null,overwritten:false,method:'cancelled'};
     throw e;
    }
    handles.set(name,handle);
   }
   if(handle){
    await write(handle,content);
    return {filename:name,overwritten:true,method:'file-picker'};
   }
   return download(name,content);
  }catch(e){
   p.log?.('Log konnte nicht überschrieben werden: '+(e?.message??e));
   return {filename:null,overwritten:false,method:'error',error:String(e?.message??e)};
  }
 }};
}
