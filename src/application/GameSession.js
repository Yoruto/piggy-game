import { PigInstance } from '../domain/PigInstance.js';
import { Inventory } from '../domain/Inventory.js';
import { SkillLearning } from '../domain/SkillLearning.js';
import { SeededRandom } from '../domain/SeededRandom.js';
import { BattleEngine } from '../domain/BattleEngine.js';
import { EnemyAI } from '../domain/EnemyAI.js';

/** A single browser/session run in memory. Owns roster, rewards and skill cards. */
export class GameSession {
  constructor(config, seed = 20261008) {
    this.config = config;
    this.seed = seed;
    this.starters = [];
    this.#initialize();
  }
  #initialize() {
    this.inventory = new Inventory(this.config.rules.inventoryCapacity ?? 8);
    this.serial = 0;
    this.battle = null;
    this.reward = null;
    this.learning = null;
    this.random = new SeededRandom(this.seed);
    this.ai = new EnemyAI(this.config, this.random);
  }
  reset() {
    this.#initialize();
    for (const id of this.starters) this.#addStarter(id);
  }
  createPig(configId, level = 1) {
    const pig = new PigInstance(this.config.pig(configId), `pig-${++this.serial}`, level);
    // Enemy defaults use the same level-based learning rule as recruits.
    for (const step of pig.learnset.filter(x => x.level <= level).sort((a,b) => a.level - b.level)) {
      if (!pig.skills.includes(step.skillId) && pig.skills.length < this.config.rules.maxSkills) pig.skills.push(step.skillId);
    }
    return pig;
  }
  #addStarter(configId) {
    const result = this.inventory.add(this.createPig(configId));
    if (!result.ok) throw new Error(result.error);
  }
  addStarter(configIds) {
    if (this.starters.length || this.inventory.pigs.length) throw new Error('StarterAlreadySet');
    if (configIds.length > this.inventory.capacity) throw new Error('InventoryFull');
    configIds.forEach(id => this.config.pig(id)); // validate before mutation
    this.starters = [...configIds];
    for (const id of configIds) this.#addStarter(id);
  }
  startBattle(rosterIds, enemyConfigIds) {
    if (this.learning) throw new Error('PendingLearnReplacement');
    if (this.reward && !this.reward.resolved) throw new Error('PendingRecruitChoice');
    if (this.battle && this.battle.state.phase !== 'finished') throw new Error('BattleInProgress');
    const roster = this.inventory.roster(rosterIds, this.config.rules.teamSizePlayer);
    if (enemyConfigIds.length !== this.config.rules.teamSizeEnemy) throw new Error('InvalidEnemySize');
    for (const id of enemyConfigIds) this.config.pig(id);
    const foes = enemyConfigIds.map(id => this.createPig(id, roster[0].level));
    this.reward = null;
    this.battle = new BattleEngine(this.config, this.random);
    return this.battle.start(roster, foes);
  }
  /** Resolves AI until a player choice or finished battle; commands always go through Engine. */
  runEnemyTurns(maxSteps = 100) {
    if (!this.battle) throw new Error('NoBattle');
    const events = [];
    for (let i = 0; i < maxSteps; i++) {
      const pending = this.battle.getPendingInput();
      if (!pending || pending.side === 'player') {
        if (this.battle.state.phase === 'finished') this.finalizeBattle();
        return events;
      }
      const result = this.battle.execute(this.ai.choose(this.battle.state));
      if (!result.ok) throw new Error(`AI failed: ${result.errorCode}`);
      events.push(...result.events);
    }
    throw new Error('Enemy turn step limit reached');
  }
  finalizeBattle() {
    if (!this.battle || this.battle.state.phase !== 'finished') return { ok: false, errorCode: 'BattleNotFinished' };
    if (this.reward) return { ok: true, reward: this.getRewardSnapshot() };
    const won = this.battle.state.outcome === 'player';
    const cardPool = this.config.rules.rewardSkillCards ?? [];
    if (won && cardPool.length) {
      const skillId = cardPool[this.random.index(cardPool.length)];
      this.inventory.addCard(skillId);
    }
    this.reward = { won, resolved: !won, candidateIds: won ? this.battle.state.teams.enemy.map(p => p.id) : [] };
    return { ok: true, reward: this.getRewardSnapshot() };
  }
  getRewardSnapshot() {
    if (!this.reward) return null;
    const candidates = this.battle.state.teams.enemy.filter(p => this.reward.candidateIds.includes(p.id))
      .map(p => ({ id: p.id, name: p.name, level: p.level, type: p.type, skills: [...p.skills], resistances: { ...p.resistances } }));
    return structuredClone({ won: this.reward.won, resolved: this.reward.resolved, candidates, inventoryFull: this.inventory.pigs.length >= this.inventory.capacity });
  }
  resolveRecruit(pigId = null) {
    if (!this.reward || !this.reward.won || this.reward.resolved) return { ok: false, errorCode: 'NoPendingRecruit' };
    if (pigId === null) { this.reward.resolved = true; return { ok: true, recruitedId: null }; }
    if (!this.reward.candidateIds.includes(pigId)) return { ok: false, errorCode: 'InvalidRecruitCandidate' };
    const pig = this.battle.state.teams.enemy.find(p => p.id === pigId);
    if (!pig) return { ok: false, errorCode: 'InvalidRecruitCandidate' };
    if (this.inventory.pigs.length >= this.inventory.capacity) return { ok: false, errorCode: 'InventoryFull' };
    pig.restore(); // Preserve skill IDs and rolled resistances; remove temporary battle state.
    const result = this.inventory.add(pig);
    if (!result.ok) return { ok: false, errorCode: result.error };
    this.reward.resolved = true;
    return { ok: true, recruitedId: pig.id };
  }
  inventorySnapshot() {
    return structuredClone({ capacity: this.inventory.capacity,
      pigs: this.inventory.pigs.map(p => ({ id:p.id, configId:p.configId, name:p.name, level:p.level, type:p.type,
        hp:p.hp, maxHp:p.maxHp, sp:p.sp, maxSp:p.maxSp, skills:[...p.skills], status:p.status, stages:p.stages })),
      skillCards: Object.fromEntries(this.inventory.skillCards),
      pendingLearning: this.learning ? { pigId:this.learning.pigId, skillId:this.learning.pending[0] } : null });
  }
  useSkillCard(skillId, pigId, replaceIndex = null) {
    const pig = this.inventory.get(pigId);
    if (!pig) return { ok: false, errorCode: 'UnknownPig' };
    if (!this.inventory.cardCount(skillId)) return { ok: false, errorCode: 'NoSkillCard' };
    try { this.config.skill(skillId); } catch { return { ok: false, errorCode: 'UnknownSkill' }; }
    const result = SkillLearning.add(pig, skillId, this.config.rules.maxSkills, replaceIndex);
    if (!result.ok) return result;
    this.inventory.consumeCard(skillId);
    return { ok: true, skillId, pigId };
  }
  levelUp(pigId, newLevel) {
    if (this.learning) return { ok: false, errorCode: 'PendingLearnReplacement' };
    const pig = this.inventory.get(pigId);
    if (!pig) return { ok: false, errorCode: 'UnknownPig' };
    if (!Number.isInteger(newLevel) || newLevel <= pig.level) return { ok: false, errorCode: 'InvalidLevel' };
    const steps = pig.learnset.filter(x => x.level > pig.level && x.level <= newLevel).sort((a,b)=>a.level-b.level);
    pig.level = newLevel;
    this.learning = { pigId, pending: steps.map(x=>x.skillId) };
    return this.#advanceLearning();
  }
  resolveLearnedSkill(replaceIndex = null, skip = false) {
    if (!this.learning) return { ok: false, errorCode: 'NoPendingLearn' };
    const pig = this.inventory.get(this.learning.pigId);
    const skillId = this.learning.pending[0];
    if (!skip) {
      const result = SkillLearning.add(pig, skillId, this.config.rules.maxSkills, replaceIndex);
      if (!result.ok) return result;
    }
    this.learning.pending.shift();
    return this.#advanceLearning();
  }
  #advanceLearning() {
    const learned = [];
    const pig = this.inventory.get(this.learning.pigId);
    while (this.learning.pending.length) {
      const skillId = this.learning.pending[0];
      if (pig.skills.includes(skillId)) { this.learning.pending.shift(); continue; }
      if (pig.skills.length >= this.config.rules.maxSkills) {
        return { ok: true, learned, pendingInput: { type: 'ChooseLearnReplacement', pigId: pig.id, skillId } };
      }
      const r = SkillLearning.add(pig, skillId, this.config.rules.maxSkills);
      if (!r.ok) throw new Error(r.errorCode);
      learned.push(skillId);
      this.learning.pending.shift();
    }
    this.learning = null;
    return { ok: true, learned, pendingInput: null };
  }
}
