import { PigInstance } from '../domain/PigInstance.js';
import { Inventory } from '../domain/Inventory.js';
import { SeededRandom } from '../domain/SeededRandom.js';
import { BattleEngine } from '../domain/BattleEngine.js';
import { EnemyAI } from '../domain/EnemyAI.js';

/** Keeps runtime state in memory; no browser / local storage dependencies. */
export class GameSession {
  constructor(config, seed = 20261008) {
    this.config = config;
    this.seed = seed;
    this.inventory = new Inventory(8);
    this.serial = 0;
    this.battle = null;
    this.random = new SeededRandom(seed);
    this.ai = new EnemyAI(config, this.random);
  }
  createPig(configId, level = 1) {
    return new PigInstance(this.config.pig(configId), `pig-${++this.serial}`, level);
  }
  addStarter(configIds) {
    for (const id of configIds) {
      const result = this.inventory.add(this.createPig(id));
      if (!result.ok) throw new Error(result.error);
    }
  }
  startBattle(rosterIds, enemyConfigIds) {
    if (this.battle && this.battle.state.phase !== 'finished') throw new Error('A battle is in progress');
    const roster = this.inventory.roster(rosterIds, this.config.rules.teamSizePlayer);
    if (enemyConfigIds.length !== this.config.rules.teamSizeEnemy) throw new Error('Invalid enemy size');
    const foes = enemyConfigIds.map(id => this.createPig(id, roster[0].level));
    this.battle = new BattleEngine(this.config, this.random);
    return this.battle.start(roster, foes);
  }
  /** For scripted demos: resolve AI commands until a player decision or game-over. */
  runEnemyTurns(maxSteps = 100) {
    const events = [];
    for (let i = 0; i < maxSteps; i++) {
      const pending = this.battle.getPendingInput();
      if (!pending || pending.side === 'player') return events;
      const command = this.ai.choose(this.battle.state);
      const result = this.battle.execute(command);
      if (!result.ok) throw new Error(`AI failed: ${result.errorCode}`);
      events.push(...result.events);
    }
    throw new Error('Enemy turn step limit reached');
  }
}
