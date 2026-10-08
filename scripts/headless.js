import { pathToFileURL } from 'node:url';
import { loadFixture } from '../src/config/loadFixture.js';
import { GameSession } from '../src/application/GameSession.js';
import { BattleService } from '../src/application/BattleService.js';

/** Deterministic fixture driver. No DOM, browser state, timers, or graphics. */
export async function runHeadlessGame(seed = 20261008, maxSteps = 2000) {
  const config = await loadFixture();
  const session = new GameSession(config, seed);
  session.addStarter(['pig.bread', 'pig.pride', 'pig.envy', 'pig.wrath']);
  const battle = new BattleService(session);
  const starterIds = session.inventory.pigs.map(p => p.id);
  session.startBattle(starterIds, ['pig.wrath','pig.pride','pig.envy']);
  const events = [];
  let steps = 0;
  while (session.battle.state.phase !== 'finished' && steps++ < maxSteps) {
    const pending = session.battle.getPendingInput();
    let command;
    if (pending.type === 'ChooseForcedSwitch') {
      const pig = session.battle.state.teams.player.find(p => p.alive && p.id !== session.battle.state.active.player);
      command = { type: 'forced-switch', pigId: pig.id };
    } else if (pending.side === 'enemy') command = session.ai.choose(session.battle.state);
    else {
      const pig = session.battle.state.activePig('player');
      const affordable = pig.skills.map(id => config.skill(id)).filter(s => s.spCost <= pig.sp);
      command = affordable.length ? { type: 'skill', skillId: affordable[0].id } : { type: 'guard' };
    }
    const result = battle.dispatch({ ...command, expectedRevision: session.battle.state.revision });
    if (!result.ok) throw new Error(`Action ${steps}: ${result.errorCode}`);
    events.push(...result.events);
  }
  if (session.battle.state.phase !== 'finished') throw new Error(`Exceeded ${maxSteps} actions`);
  session.finalizeBattle();
  return { seed, steps, session, events, snapshot: session.battle.getSnapshot(), reward: session.getRewardSnapshot() };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const seed = Number(process.argv[2] ?? 20261008);
  const result = await runHeadlessGame(seed);
  console.log(JSON.stringify({ seed, steps: result.steps, winner: result.snapshot.outcome, round: result.snapshot.round,
    eventCount: result.events.length, reward: result.reward }, null, 2));
}
