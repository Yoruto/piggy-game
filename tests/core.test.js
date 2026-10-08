import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFixture } from '../src/config/loadFixture.js';
import { ConfigCatalog } from '../src/config/ConfigCatalog.js';
import { SeededRandom } from '../src/domain/SeededRandom.js';
import { BattleEngine } from '../src/domain/BattleEngine.js';
import { GameSession } from '../src/application/GameSession.js';
import { BattlePresenter } from '../src/presentation/BattlePresenter.js';

const makeGame = async seed => {
  const config = await loadFixture();
  const game = new GameSession(config, seed);
  game.addStarter(['pig.bread', 'pig.pride', 'pig.envy', 'pig.wrath']);
  game.startBattle(game.inventory.pigs.map(p => p.id), ['pig.wrath', 'pig.pride', 'pig.envy']);
  return game;
};

test('configuration matrix and immutable separated instances', async () => {
  const config = await loadFixture();
  assert.equal(config.multiplier('sloth', 'pride'), 1.5);
  assert.equal(config.multiplier('pride', 'sloth'), 1);
  const game = await makeGame(9);
  assert.equal(game.inventory.pigs.length, 4);
  const p = game.createPig('pig.bread');
  assert.notEqual(p.id, game.inventory.pigs[0].id);
  p.hp = 1;
  assert.equal(game.inventory.pigs[0].hp, 100);
  assert.equal(config.pig('pig.bread').hp, 100);
  assert.throws(() => new ConfigCatalog({ fixture: false }), /fixtures/);
  assert.throws(() => { config.rules.roundSp = 900; }, TypeError);
});

test('seeded random yields identical stream, never relies on browser APIs', () => {
  const a = new SeededRandom(42); const b = new SeededRandom(42);
  assert.deepEqual(Array.from({ length: 30 }, () => a.next()), Array.from({ length: 30 }, () => b.next()));
});

test('4v3 round queue, guard SP, action validation, defensive switch', async () => {
  const g = await makeGame(2); const battle = g.battle;
  assert.equal(battle.state.round, 1);
  assert.equal(battle.getPendingInput().side, 'player');
  assert.equal(battle.getSnapshot().teams.enemy.length, 3);
  const original = battle.getSnapshot();
  assert.equal(battle.execute({ type: 'skill', skillId: 'invalid' }).errorCode, 'UnknownSkill');
  assert.equal(battle.execute({ type: 'skill', skillId: 'skill.sloth', expectedRevision: 999 }).errorCode, 'StaleCommand');
  assert.deepEqual(battle.getSnapshot(), original);
  const guard = battle.execute({ type: 'guard', expectedRevision: 0 });
  assert.equal(guard.ok, true);
  assert.equal(guard.snapshot.teams.player[0].sp, 30);
  assert.equal(battle.getPendingInput().side, 'enemy');
  const e = battle.execute({ type: 'guard' });
  assert.equal(e.ok, true);
  assert.equal(e.snapshot.round, 2);
  const sid = g.inventory.pigs[1].id;
  assert.equal(battle.execute({ type: 'switch', pigId: sid }).ok, true);
  assert.equal(battle.state.active.player, sid);
  assert.equal(battle.state.activePig('player').switchShield, true);
  assert.equal(battle.getPendingInput().side, 'enemy');
});

test('weakness -> Down -> one more; one more cannot chain', async () => {
  const config = await loadFixture();
  const random = { next: () => 0.9, index: () => 0 };
  const game = new GameSession(config, 10);
  const player = [game.createPig('pig.bread'), game.createPig('pig.pride'), game.createPig('pig.envy'), game.createPig('pig.wrath')];
  const enemy = [game.createPig('pig.wrath'), game.createPig('pig.pride'), game.createPig('pig.envy')];
  // The first enemy has a sloth weakness; ensure enough HP for two hits.
  enemy[0].maxHp = enemy[0].hp = 500;
  const battle = new BattleEngine(config, random);
  battle.start(player, enemy);
  const a = battle.execute({ type: 'skill', skillId: 'skill.sloth' });
  assert.equal(a.ok, true);
  assert.equal(a.pendingInput.type, 'ChooseMoreAction');
  assert(a.events.some(x => x.kind === 'WeaknessHit'));
  assert(a.events.some(x => x.kind === 'OneMoreGranted'));
  assert.equal(enemy[0].down, true);
  const b = battle.execute({ type: 'skill', skillId: 'skill.sloth' });
  assert.equal(b.ok, true);
  assert(!b.events.some(x => x.kind === 'OneMoreGranted'));
  assert.equal(b.pendingInput.side, 'player'); // enemy Down skips and new round begins
  assert.equal(b.snapshot.round, 2);
});

test('enemy replacement and forced player switch', async () => {
  const game = await makeGame(8);
  const s = game.battle.state;
  s.teams.enemy[0].hp = 1;
  const result = game.battle.execute({ type: 'skill', skillId: 'skill.sloth' });
  assert.equal(result.ok, true);
  assert.equal(s.active.enemy, s.teams.enemy[1].id);
  assert(result.events.some(e => e.kind === 'PigSwitched'));
  // Force a player death on enemy turn; guard passes player action without harming target.
  const game2 = await makeGame(5);
  game2.battle.execute({ type: 'guard' });
  game2.battle.state.activePig('player').hp = 1;
  const r2 = game2.battle.execute({ type: 'skill', skillId: 'skill.wrath' });
  assert.equal(r2.pendingInput.type, 'ChooseForcedSwitch');
  assert.equal(game2.battle.execute({ type: 'guard' }).errorCode, 'InvalidPhase');
  const replacement = game2.inventory.pigs[1].id;
  const chosen = game2.battle.execute({ type: 'forced-switch', pigId: replacement });
  assert.equal(chosen.ok, true);
  assert.equal(game2.battle.state.active.player, replacement);
});

test('full headless battle can finish, AI only uses legal affordable skill', async () => {
  const g = await makeGame(20261008);
  let count = 0;
  while (g.battle.state.phase !== 'finished' && count++ < 1000) {
    const pending = g.battle.getPendingInput();
    let action;
    if (pending.type === 'ChooseForcedSwitch') {
      const alive = g.battle.state.teams.player.find(p => p.alive && p.id !== g.battle.state.active.player);
      action = { type: 'forced-switch', pigId: alive.id };
    } else if (pending.side === 'enemy') action = g.ai.choose(g.battle.state);
    else {
      const p = g.battle.state.activePig('player');
      const skills = p.skills.map(x => g.config.skill(x)).filter(x => x.spCost <= p.sp);
      action = skills.length ? { type: 'skill', skillId: skills[0].id } : { type: 'guard' };
    }
    const result = g.battle.execute(action);
    assert.equal(result.ok, true, `step ${count}: ${result.errorCode}`);
  }
  assert(count < 1000, 'battle infinite loop');
  assert.equal(g.battle.state.phase, 'finished');
  assert(['player', 'enemy'].includes(g.battle.state.outcome));
});

test('BattlePresenter works with FakeView without DOM', async () => {
  const game = await makeGame(21);
  const calls = [];
  const fake = {
    bind(h) { this.handlers = h; calls.push('bind'); },
    unbind() { this.handlers = null; calls.push('unbind'); },
    render(snapshot) { calls.push(`render:${snapshot.revision}`); },
    async playEvents(events) { calls.push(`events:${events.length}`); },
    showError(code) { calls.push(`error:${code}`); }
  };
  const presenter = new BattlePresenter(fake, game.battle);
  presenter.initialize();
  const a = await fake.handlers.onCommand({ type: 'guard' });
  assert.equal(a.ok, true);
  const b = await fake.handlers.onCommand({ type: 'guard' });
  assert.equal(b.ok, true);
  assert(calls.some(x => x.startsWith('events:')));
  presenter.dispose();
  assert.equal(fake.handlers, null);
});

test('reflect hits attacker and never awards Down/OneMore', async () => {
  const cfg = await loadFixture();
  const g = new GameSession(cfg, 33);
  const ps = ['pig.bread','pig.pride','pig.envy','pig.wrath'].map(id => g.createPig(id));
  const es = ['pig.wrath','pig.pride','pig.envy'].map(id => g.createPig(id));
  es[0].resistances.sloth = 'reflect';
  const battle = new BattleEngine(cfg, { next: () => 0, index: () => 0 });
  battle.start(ps, es);
  const originalHp = ps[0].hp;
  const result = battle.execute({ type: 'skill', skillId: 'skill.sloth' });
  assert.equal(result.ok, true);
  assert(ps[0].hp < originalHp);
  assert.equal(es[0].hp, es[0].maxHp);
  assert(result.events.some(e => e.kind === 'Reflected'));
  assert(!result.events.some(e => ['CriticalHit','OneMoreGranted','DownApplied'].includes(e.kind)));
});

test('downed unit skips its scheduled action then recovers', async () => {
  const cfg = await loadFixture();
  const g = new GameSession(cfg, 10);
  const ps = ['pig.bread','pig.pride','pig.envy','pig.wrath'].map(id => g.createPig(id));
  const es = ['pig.wrath','pig.pride','pig.envy'].map(id => g.createPig(id));
  es[0].maxHp = es[0].hp = 1000;
  const engine = new BattleEngine(cfg, { next: () => 0.9, index: () => 0 });
  engine.start(ps, es);
  engine.execute({ type: 'skill', skillId: 'skill.sloth' });
  engine.execute({ type: 'guard' }); // 1 More consumed, enemy Down should skip
  assert.equal(engine.state.round, 2);
  assert.equal(es[0].down, false);
  assert.equal(engine.getPendingInput().side, 'player');
});
