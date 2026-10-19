import test from 'node:test';
import assert from 'node:assert/strict';
import {nextMinorReleaseVersion} from '../scripts/release-version-policy.mjs';
test('each signed release advances by +0.1 and resets the old patch',()=>{
 assert.equal(nextMinorReleaseVersion('0.10.13-candidate'),'0.11.0-candidate');
 assert.equal(nextMinorReleaseVersion('0.11.0-candidate'),'0.12.0-candidate');
 assert.equal(nextMinorReleaseVersion('1.99.7'),'1.100.0');
});
test('unknown or unsafe release versions never authorize an inferred increment',()=>{
 for(const input of [null,'latest','0.11','0.11.0-other','0.01.0','0.9007199254740991.0'])
  assert.throws(()=>nextMinorReleaseVersion(input));
});
