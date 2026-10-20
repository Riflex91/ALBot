import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {personalPrefix} from '../scripts/bootstrap-support.mjs';
import {createAutoBootstrap} from '../scripts/auto-bootstrap-support.mjs';
test('installed V2 template exactly matches the personalized signed-loader source',async()=>{
 const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
 const [personal,publicKey,published]=await Promise.all([
  read('bot.js'),read('release/public-key.json'),read('dist/albot.bootstrap.auto.js')]);
 const expected=createAutoBootstrap({prefix:personalPrefix(personal),
   publicKey:JSON.parse(publicKey)}).code;
 assert.equal(published,expected);
 assert.match(published,/albot\.release\.json/);
});
