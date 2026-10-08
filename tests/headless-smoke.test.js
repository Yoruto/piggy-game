import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFixture } from '../src/config/loadFixture.js';
import { GameSession } from '../src/application/GameSession.js';

/** Regression: deterministic AI + real state machine must never stall or mutate config. */
test('30 seeded full 4v3 games finish without invalid actions', async () => {
  const config = await loadFixture();
  for (let seed = 1; seed <= 30; seed++) {
    const game = new GameSession(config, seed);
    game.addStarter(['pig.bread', 'pig.pride', 'pig.envy', 'pig.wrath']);
    game.startBattle(game.inventory.pigs.map(p => p.id), ['pig.wrath', 'pig.pride', 'pig.envy']);
    let steps = 0;
    while (game.battle.state.phase !== 'finished' && steps++ < 200) {
      const pending = game.battle.getPendingInput();
      let cmd;
      if (pending.type === 'ChooseForcedSwitch') {
        const next = game.battle.state.teams.player.find(p => p.alive && p.id !== game.battle.state.active.player);
        cmd = { type: 'forced-switch', pigId: next.id };
      } else if (pending.side === 'enemy') cmd = game.ai.choose(game.battle.state);
      else {
        const actor = game.battle.state.activePig('player');
        const usable = actor.skills.map(id => config.skill(id)).find(skill => skill.spCost <= actor.sp);
        cmd = usable ? { type: 'skill', skillId: usable.id } : { type: 'guard' };
      }
      const result = game.battle.execute(cmd);
      assert.equal(result.ok, true, `seed=${seed}, step=${steps}, error=${result.errorCode}`);
    }
    assert.equal(game.battle.state.phase, 'finished', `seed=${seed} did not finish`);
    assert(['player', 'enemy', 'draw'].includes(game.battle.state.outcome));
    assert(game.battle.state.round < 100);
  }
  assert.equal(config.pig('pig.bread').hp, 100); // immutable fixture, not mutated by battles
});
