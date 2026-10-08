import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFixture } from '../../src/config/loadFixture.js';
import { GameSession } from '../../src/application/GameSession.js';
import { BattleService } from '../../src/application/BattleService.js';
import { BrowserBattlePort } from '../../src/web/BrowserBattlePort.js';
import { TYPES, pigSprite, errorText, skillName } from '../../src/web/assets/visuals.js';

const starters=['pig.bread','pig.pride','pig.envy','pig.wrath'];
const foes=['pig.wrath','pig.pride','pig.envy'];
async function fresh(seed=13){const config=await loadFixture();const session=new GameSession(config,seed);session.addStarter(starters);session.startBattle(session.inventory.pigs.map(p=>p.id),foes);return {config,session,port:new BrowserBattlePort(new BattleService(session))};}

test('Web BattlePort drives enemy turns without moving combat calculations to the view',async()=>{
  const {port}=await fresh();
  if(port.getPendingInput()?.side==='enemy')port.advanceOpening();
  assert.equal(port.getPendingInput()?.side,'player');
  const actor=port.getPendingInput().actorId;
  const result=port.dispatch({type:'guard',actorId:actor,expectedRevision:port.getSnapshot().revision});
  assert(result.ok);
  assert(result.events.length>0);
  assert.notEqual(port.getSnapshot().revision,0);
  assert.equal(port.getPendingInput()?.side,'player');
});

test('BrowserBattlePort rejects stale clicks before running enemy actions',async()=>{
  const {port}=await fresh(5);
  port.advanceOpening();
  const before=port.getSnapshot();
  const result=port.dispatch({type:'guard',expectedRevision:before.revision-1});
  assert.equal(result.ok,false);
  assert.equal(result.errorCode,'StaleCommand');
  assert.deepEqual(port.getSnapshot(),before);
});

test('Web visual helpers use original SVG sprites and escape display strings',async()=>{
  const {config}=await fresh();
  assert(Object.keys(TYPES).length===7);
  assert(pigSprite('sloth').includes('<svg'));
  assert.equal(skillName('skill.sloth',config),'慵懒冲撞');
  assert.match(errorText('InventoryFull'),/背包已满/);
});
