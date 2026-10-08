import test from 'node:test';
import assert from 'node:assert/strict';
import { runHeadlessGame } from '../scripts/headless.js';
import { loadFixture } from '../src/config/loadFixture.js';
import { ConfigCatalog } from '../src/config/ConfigCatalog.js';
import { readFile } from 'node:fs/promises';

test('150 seeded 4v3 games end with exactly one BattleFinished and no duplicate event sequence',async()=>{
  for(let seed=1;seed<=150;seed++){
    const run=await runHeadlessGame(seed);
    assert.equal(run.snapshot.phase,'finished');
    assert(run.steps < 2000);
    assert.equal(run.events.filter(e=>e.kind==='BattleFinished').length,1);
    const sequences=run.events.map(e=>e.seq);
    assert.equal(new Set(sequences).size,sequences.length);
    assert(sequences.every((s,i)=>i===0 || s>sequences[i-1]));
    assert(run.reward.resolved || run.reward.won);
  }
});

test('config validators reject broken AI and learning-table references',async()=>{
  const original=JSON.parse(await readFile(new URL('../config/demo.fixture.json',import.meta.url),'utf8'));
  const data=structuredClone(original);data.rules.ai.knownWeaknessChance=2;
  assert.throws(()=>new ConfigCatalog(data),/Invalid AI probabilities/);
  const learn=structuredClone(original);learn.pigs[0].learnset=[{level:2,skillId:'missing'}];
  assert.throws(()=>new ConfigCatalog(learn),/Invalid learnset/);
  const unknown=structuredClone(original);unknown.pigs[0].passiveId='missing';
  assert.throws(()=>new ConfigCatalog(unknown),/Unknown passive/);
  const version=structuredClone(original);version.configVersion='';
  assert.throws(()=>new ConfigCatalog(version),/Unsupported config version/);
  assert((await loadFixture()).passive('passive.soft_fermentation'));
});
