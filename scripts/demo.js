import { loadFixture } from '../src/config/loadFixture.js';
import { GameSession } from '../src/application/GameSession.js';

const config = await loadFixture();
const game = new GameSession(config, 20261008);
game.addStarter(['pig.bread', 'pig.pride', 'pig.envy', 'pig.wrath']);
game.startBattle(game.inventory.pigs.map(p => p.id), ['pig.wrath', 'pig.pride', 'pig.envy']);
console.log('HEADLESS DEMO (fixture numbers, not final v1.3)');
let actions = 0;
while (game.battle.state.phase !== 'finished' && actions++ < 1000) {
  const pending = game.battle.getPendingInput();
  let result;
  if (pending.type === 'ChooseForcedSwitch') {
    const pig = game.battle.state.teams.player.find(p => p.alive && p.id !== game.battle.state.active.player);
    result = game.battle.execute({ type: 'forced-switch', pigId: pig.id });
  } else if (pending.side === 'enemy') {
    result = game.battle.execute(game.ai.choose(game.battle.state));
  } else {
    const p = game.battle.state.activePig('player');
    const affordable = p.skills.map(id => config.skill(id)).filter(s => s.spCost <= p.sp);
    result = game.battle.execute(affordable.length ? { type: 'skill', skillId: affordable[0].id } : { type: 'guard' });
  }
  if (!result.ok) throw new Error(result.errorCode);
  for (const evt of result.events) console.log(`round ${result.snapshot.round}: ${JSON.stringify(evt)}`);
}
if (game.battle.state.phase !== 'finished') throw new Error('Battle did not finish');
console.log('Winner:', game.battle.state.outcome, 'in rounds', game.battle.state.round);
