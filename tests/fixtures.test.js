import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { runHeadlessGame } from '../scripts/headless.js';

const golden=JSON.parse(await readFile(new URL('./fixtures/headless-golden.json',import.meta.url),'utf8'));
for(const expected of golden.records){
  test(`golden fixture seed ${expected.seed}: ordered event SHA256 and outcome`,async()=>{
    const run=await runHeadlessGame(expected.seed);
    const sha256=createHash('sha256').update(JSON.stringify(run.events)).digest('hex');
    assert.equal(sha256,expected.sha256);
    assert.equal(run.snapshot.outcome,expected.winner);
    assert.equal(run.snapshot.round,expected.round);
    assert.equal(run.steps,expected.steps);
    assert.equal(run.events.length,expected.eventCount);
    assert.equal(golden.configVersion,run.session.config.configVersion);
  });
}
