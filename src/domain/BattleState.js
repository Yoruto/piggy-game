/** The engine is the only writer; snapshots are detached read-only JSON data. */
export class BattleState {
  constructor(player, enemy) {
    this.teams = { player, enemy };
    this.active = { player: player[0].id, enemy: enemy[0].id };
    this.round = 0;
    this.revision = 0;
    this.phase = 'setup';
    this.queue = [];
    this.queueIndex = 0;
    this.extra = null;
    this.usedMore = new Set();
    this.pendingSwitch = null;
    this.outcome = null;
  }
  pig(side, id) { return this.teams[side].find(p => p.id === id); }
  activePig(side) { return this.pig(side, this.active[side]); }
  other(side) { return side === 'player' ? 'enemy' : 'player'; }
  snapshot() {
    return structuredClone({ round: this.round, revision: this.revision, phase: this.phase,
      active: this.active, queue: this.queue, queueIndex: this.queueIndex,
      extra: this.extra, outcome: this.outcome,
      teams: Object.fromEntries(Object.entries(this.teams).map(([side, pigs]) => [side, pigs.map(p => ({
        id: p.id, configId: p.configId, name: p.name, type: p.type, level: p.level,
        hp: p.hp, maxHp: p.maxHp, sp: p.sp, maxSp: p.maxSp, speed: p.speed,
        skills: [...p.skills], down: p.down, guarding: p.guarding, switchShield: p.switchShield
      }))])) });
  }
}
