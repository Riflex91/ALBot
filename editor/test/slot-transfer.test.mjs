import test from 'node:test';
import assert from 'node:assert/strict';
import {planSlotFiles,updateLocalSyncFiles} from '../lib/slot-transfer.mjs';

const config={characters:[{name:'My_Ranger1',enabled:true},{name:'My_Ranger2',enabled:true},
 {name:'My_Merchant',enabled:true},{name:'Disabled',enabled:false}]};
function syncFolder(initial={}){
 const storage=new Map(Object.entries(initial)),writes=[];
 return {storage,writes,
  async getFileHandle(filename,options={}){
   if(!storage.has(filename)){if(!options.create)throw Error('not found');storage.set(filename,'');}
   return {async getFile(){return {async text(){return storage.get(filename);}};},
    async createWritable(){let data='';return {async write(value){data=String(value);},
     async close(){storage.set(filename,data);writes.push(filename);}};}};
  }
 };
}
test('complete slot mapping resolves each character and can intentionally share one CODE slot',()=>{
 const plan=planSlotFiles(config,'My_Ranger1=ALBot.1;My_Ranger2=ALBot.1;My_Merchant=Merchant.12');
 assert.deepEqual(plan.files.map(x=>x.filename),['ALBot.1.js','Merchant.12.js']);
 assert.deepEqual(plan.files[0].characters,['My_Ranger1','My_Ranger2']);
 assert.equal(plan.assignments.length,3);
});
test('rejects unapproved characters, duplicate mappings, filename traversal and slot zero',()=>{
 for(const mapping of [
  'My_Ranger1=ALBot.0;My_Ranger2=ALBot.1;My_Merchant=ALBot.2',
  'My_Ranger1=../bad.1;My_Ranger2=ALBot.1;My_Merchant=ALBot.2',
  'My_Ranger1=ALBot.1;My_Ranger1=ALBot.2;My_Merchant=ALBot.3',
  'My_Ranger1=ALBot.1;My_Ranger2=ALBot.2;Stranger=ALBot.3',
  'My_Ranger1=ALBot.1;My_Merchant=ALBot.3'
 ])assert.throws(()=>planSlotFiles(config,mapping));
});
test('existing synchronized slot is backed up before locally verified modification',async()=>{
 const folder=syncFolder({'ALBot.1.js':'previous remote code'});
 const out=await updateLocalSyncFiles(folder,[{filename:'ALBot.1.js'}],'new verified code');
 assert.equal(out[0].state,'local-verified');
 assert.equal(folder.storage.get('ALBot.1.js'),'new verified code');
 assert.equal(folder.storage.get(out[0].backup),'previous remote code');
 assert.ok(folder.writes.indexOf(out[0].backup)<folder.writes.indexOf('ALBot.1.js'));
});
test('missing remote-synced file aborts the whole transfer without modifying existing files',async()=>{
 const folder=syncFolder({'ALBot.1.js':'keep me'});
 await assert.rejects(updateLocalSyncFiles(folder,[{filename:'ALBot.1.js'},
  {filename:'Merchant.12.js'}],'new code'),/CODE-Datei fehlt/);
 assert.equal(folder.storage.get('ALBot.1.js'),'keep me');
 assert.deepEqual(folder.writes,[]);
});
test('identical code does not create a backup or remote-sync file modification',async()=>{
 const folder=syncFolder({'ALBot.1.js':'unchanged'});
 const out=await updateLocalSyncFiles(folder,[{filename:'ALBot.1.js'}],'unchanged');
 assert.equal(out[0].state,'identical');
 assert.deepEqual(folder.writes,[]);
});
