import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFixture } from '../src/config/loadFixture.js';
import { GameSession } from '../src/application/GameSession.js';
import { BattleEngine } from '../src/domain/BattleEngine.js';
import { BattleRules } from '../src/domain/BattleRules.js';
import { EnemyAI } from '../src/domain/EnemyAI.js';

const seedRandom = (n = 0.9, i = 0) => ({ next: () => n, index: () => i });
async function battleWith(random = seedRandom()) {
  const cfg = await loadFixture();
  const g = new GameSession(cfg, 91);
  const player = ['pig.bread', 'pig.pride', 'pig.envy', 'pig.wrath'].map(id => g.createPig(id));
  const enemy = ['pig.wrath', 'pig.pride', 'pig.envy'].map(id => g.createPig(id));
  enemy[0].maxHp = enemy[0].hp = 1000;
  player[0].maxHp = player[0].hp = 1000;
  const b = new BattleEngine(cfg, random);
  b.start(player, enemy);
  return { b, cfg, player, enemy };
}

test('weakness and crit only grant one More; Baton Pass executes exactly one bonus action', async () => {
  const { b, cfg, player, enemy } = await battleWith(seedRandom(0));
  assert.equal(b.execute({ type: 'baton-pass', pigId: player[1].id }).errorCode, 'InvalidPhase');
  const first = b.execute({ type: 'skill', skillId: 'skill.sloth' });
  assert(first.events.some(e => e.kind === 'WeaknessHit'));
  assert(first.events.some(e => e.kind === 'CriticalHit'));
  assert.equal(first.events.filter(e => e.kind === 'OneMoreGranted').length, 1);
  assert.equal(first.pendingInput.type, 'ChooseMoreAction');
  assert.equal(b.execute({ type: 'switch', pigId: player[1].id }).errorCode, 'InvalidPhase');
  const passed = b.execute({ type: 'baton-pass', pigId: player[1].id });
  assert.equal(passed.pendingInput.type, 'ChooseBatonAction');
  assert.equal(b.state.usedBatonPass, true);
  assert.equal(b.state.active.player, player[1].id);
  assert.equal(b.state.pass.multiplier, 1.5); // TEST FIXTURE, not official v1.3 pass increment
  assert.equal(b.execute({ type: 'baton-pass', pigId: player[2].id }).errorCode, 'InvalidPhase');
  const hit = b.execute({ type: 'skill', skillId: 'skill.pride' });
  const damage = hit.events.find(e => e.kind === 'DamageApplied').amount;
  // target no pride resistance, and critRate is forced to 100% by stub RNG.
  const raw = cfg.skill('skill.pride').power * player[1].attack / enemy[0].defense * cfg.rules.critMultiplier;
  assert.equal(damage, Math.floor(raw * 1.5));
  assert(hit.events.some(e => e.kind === 'BatonBonusEnded'));
  assert.equal(b.state.pass, null);
  assert(!hit.events.some(e => e.kind === 'OneMoreGranted'));
  assert.notEqual(hit.pendingInput.type, 'ChooseBatonAction');
});

test('reflected attack during a forced crit never Down/More, and knowledge notes reflect', async () => {
  const { b, player, enemy } = await battleWith(seedRandom(0));
  enemy[0].resistances.sloth = 'reflect';
  const result = b.execute({ type: 'skill', skillId: 'skill.sloth' });
  assert(result.events.some(e => e.kind === 'Reflected'));
  assert(!result.events.some(e => ['OneMoreGranted', 'DownApplied', 'CriticalHit'].includes(e.kind)));
  assert.equal(result.snapshot.knownResistances.player[enemy[0].id].sloth, 'reflect');
  assert.equal(result.snapshot.teams.enemy[0].resistances, undefined); // no unobserved slots in snapshots
  assert(player[0].hp < player[0].maxHp);
});

test('resistance reroll every third round clears discovery but preserves status and buffs', async () => {
  const { b, enemy } = await battleWith(seedRandom(0.9, 0));
  let r = b.execute({ type: 'skill', skillId: 'skill.sloth' });
  assert.equal(r.snapshot.knownResistances.player[enemy[0].id].sloth, 'weak');
  b.execute({ type: 'guard' }); // consume more
  enemy[0].status = { kind: 'paralysis', remaining: null };
  enemy[0].stages.attack = 2;
  let rolled = [];
  // Advance rounds deterministically without relying on specific damage output.
  for (let i = 0; i < 10 && b.state.round < 3; i++) {
    const side = b.getPendingInput().side;
    r = b.execute({ type: 'guard' });
    assert(r.ok);
    rolled.push(...r.events.filter(e => e.kind === 'ResistancesRerolled'));
    if (side === 'enemy') assert(!r.events.some(e => e.kind === 'OneMoreGranted'));
  }
  assert.equal(b.state.round, 3);
  assert.equal(rolled.length, 2);
  assert.deepEqual(b.getSnapshot().knownResistances, { player: {}, enemy: {} });
  assert.equal(Object.keys(enemy[0].resistances).length, 7);
  assert.equal(enemy[0].status.kind, 'paralysis');
  assert.equal(enemy[0].stages.attack, 2);
});

test('status skill applies poison and poison ticks before action; switching retains status', async () => {
  const { b, player, enemy } = await battleWith(seedRandom(0.9));
  player[0].skills.push('skill.poison');
  let r = b.execute({ type: 'skill', skillId: 'skill.poison' });
  assert(r.events.some(e => e.kind === 'StatusApplied' && e.status === 'poison'));
  assert.equal(enemy[0].status.kind, 'poison');
  const pre = enemy[0].hp;
  r = b.execute({ type: 'guard' }); // opponent -> next round status tick
  assert.equal(b.state.round, 2);
  assert(r.events.some(e => e.kind === 'StatusDamage' && e.status === 'poison'));
  assert.equal(enemy[0].hp, pre - Math.floor(enemy[0].maxHp / 8));
  assert.equal(enemy[0].status.kind, 'poison');
});

test('status chance, burn, stages and freeze fire-thaw use Rules without mutating config', async () => {
  const { cfg, player, enemy } = await battleWith(seedRandom(0));
  const rules = new BattleRules(cfg, seedRandom(0));
  const a = player[0], t = enemy[0];
  assert.equal(rules.tryStatus(t, { kind: 'burn', chance: 0 }), null);
  assert.equal(rules.tryStatus(t, { kind: 'burn', chance: 1 }).kind, 'burn');
  assert.equal(rules.effective(t, 'attack'), t.attack / 2);
  assert.equal(rules.changeStages(t, [{ stat: 'attack', amount: 25 }])[0].after, 6);
  assert.equal(rules.effective(t, 'attack'), t.attack * 4 / 2);
  assert.equal(rules.changeStages(t, [{ stat: 'attack', amount: -30 }])[0].after, -6);
  assert.equal(rules.effective(t, 'attack'), t.attack * .25 / 2);
  t.status = { kind: 'paralysis', remaining: null };
  assert.equal(rules.effective(t, 'speed'), t.speed / 2);
  const events = [];
  t.status = { kind: 'freeze', remaining: null };
  rules.tickRoundStatus(t, (kind) => events.push(kind));
  assert(events.includes('StatusCleared'));
  t.status = { kind: 'sleep', remaining: 2 };
  rules.tickRoundStatus(t, () => {});
  assert.equal(t.status.remaining, 1);
  rules.tickRoundStatus(t, () => {});
  assert.equal(t.status, null);
  assert.equal(a.status, null);
});

test('skill statChanges are applied to attacker and target and capped', async () => {
  const { b, player, enemy } = await battleWith(seedRandom(.99));
  player[0].skills.push('skill.buff');
  const r = b.execute({ type: 'skill', skillId: 'skill.buff' });
  const changes = r.events.filter(e => e.kind === 'StatStageChanged');
  assert.equal(changes.length, 2);
  assert.equal(player[0].stages.attack, 1);
  assert.equal(enemy[0].stages.speed, -1);
  assert.equal(b.rules.effective(player[0], 'attack'), player[0].attack * 1.5);
  assert.equal(b.rules.effective(enemy[0], 'speed'), enemy[0].speed * 0.67);
});

test('AI prioritizes discovered weakness and offers baton when eligible', async () => {
  const { b, cfg, player, enemy } = await battleWith(seedRandom(.99));
  // Direct scenario setup simulates discovery on an enemy turn.
  b.state.knownResistances.enemy[player[0].id] = { wrath: 'weak' };
  enemy[0].skills.push('skill.envy');
  const ai = new EnemyAI(cfg, seedRandom(0));
  assert.equal(ai.choose(b.state).skillId, 'skill.wrath');
  b.state.phase = 'more'; b.state.extra = 'enemy';
  enemy[0].hp = 2;
  assert.equal(ai.choose(b.state).type, 'baton-pass');
});

test('fainted target triggers enemy replacement and still allows one More against new target', async () => {
  const { b, enemy } = await battleWith(seedRandom(.99));
  enemy[0].hp = 1;
  const r = b.execute({ type: 'skill', skillId: 'skill.sloth' });
  assert.equal(r.pendingInput.type, 'ChooseMoreAction');
  assert.notEqual(b.state.active.enemy, enemy[0].id);
  assert(r.events.some(e => e.kind === 'PigSwitched'));
  const extra = b.execute({ type: 'guard' });
  assert(extra.ok);
  assert.notEqual(extra.pendingInput.type, 'ChooseMoreAction');
});

test('start of round poison fatality requires free player forced switch before action queue', async () => {
  const { b, player } = await battleWith(seedRandom(.99));
  player[0].hp = 4;
  player[0].status = { kind: 'poison', remaining: null };
  b.execute({ type: 'guard' }); // player
  const r = b.execute({ type: 'guard' }); // enemy -> round 2 tick poison
  assert.equal(r.pendingInput.type, 'ChooseForcedSwitch');
  assert.equal(b.state.round, 2);
  assert.equal(player[0].hp, 0);
  const chosen = b.execute({ type: 'forced-switch', pigId: player[1].id });
  assert(chosen.ok);
  assert.equal(b.getPendingInput().side, 'player');
  assert.equal(player[1].switchShield, true);
});

test('sleep and paralysis skip actions; confusion self-hit is resolved without UI', async () => {
  {
    const { b, enemy } = await battleWith(seedRandom(.9));
    enemy[0].status = { kind: 'sleep', remaining: 2 };
    const r = b.execute({ type: 'guard' });
    assert(r.events.some(e => e.kind === 'StatusSkipped' && e.status === 'sleep'));
    assert.equal(b.state.round, 2);
    assert.equal(enemy[0].status.remaining, 1);
  }
  {
    const { b, enemy } = await battleWith(seedRandom(0));
    enemy[0].status = { kind: 'paralysis', remaining: null };
    const r = b.execute({ type: 'guard' });
    assert(r.events.some(e => e.kind === 'StatusSkipped' && e.status === 'paralysis'));
  }
  {
    const { b, enemy } = await battleWith(seedRandom(0));
    enemy[0].status = { kind: 'confusion', remaining: 3 };
    const original = enemy[0].hp;
    const r = b.execute({ type: 'guard' });
    assert(r.events.some(e => e.kind === 'ConfusionSelfHit'));
    assert(enemy[0].hp < original);
  }
});

test('fire-tagged skill clears freeze and applies burn; null resistance prevents crit and down', async () => {
  {
    const { b, player, enemy } = await battleWith(seedRandom(0));
    player[0].skills.push('skill.burn');
    enemy[0].status = { kind: 'freeze', remaining: null };
    const r = b.execute({ type: 'skill', skillId: 'skill.burn' });
    assert(r.events.some(e => e.kind === 'StatusCleared' && e.reason === 'fire'));
    assert(r.events.some(e => e.kind === 'StatusApplied' && e.status === 'burn'));
    assert.equal(enemy[0].status.kind, 'burn');
  }
  {
    const { b, enemy } = await battleWith(seedRandom(0));
    enemy[0].resistances.sloth = 'null';
    const r = b.execute({ type: 'skill', skillId: 'skill.sloth' });
    assert.equal(r.events.find(e => e.kind === 'DamageApplied').amount, 0);
    assert(!r.events.some(e => ['CriticalHit', 'DownApplied', 'OneMoreGranted'].includes(e.kind)));
  }
});

test('guard damage and switched-in protection stack multiplicatively', async () => {
  const { b, enemy } = await battleWith(seedRandom(.99));
  enemy[0].guarding = true;
  enemy[0].switchShield = true;
  const r = b.execute({ type: 'skill', skillId: 'skill.wrath' });
  assert.equal(r.events.find(e => e.kind === 'DamageApplied').amount, 7);
});

test('battle-end clears temporary statuses and stat stages without restoring HP', async () => {
  const { b, player, enemy } = await battleWith(seedRandom(.99));
  for (const p of player) {
    p.status = { kind: 'burn', remaining: null };
    p.stages.attack = 5;
  }
  enemy[0].hp = 1;
  enemy[1].hp = 0;
  enemy[2].hp = 0;
  b.execute({ type: 'skill', skillId: 'skill.sloth' });
  assert.equal(b.state.phase, 'finished');
  assert.equal(b.state.outcome, 'player');
  assert(player.every(p => p.status === null && p.stages.attack === 0));
  assert.equal(enemy[0].hp, 0);
  assert.equal(b.execute({ type: 'guard' }).errorCode, 'BattleFinished');
});

test('switch does not clear status or stage modifier on outgoing pig', async () => {
  const { b, player } = await battleWith(seedRandom(.99));
  player[0].status = { kind: 'poison', remaining: null };
  player[0].stages.speed = 3;
  const r = b.execute({ type: 'switch', pigId: player[1].id });
  assert(r.ok);
  assert.equal(player[0].status.kind, 'poison');
  assert.equal(player[0].stages.speed, 3);
});
