import { BattleState } from './BattleState.js';
import { BattleRules } from './BattleRules.js';

/** Synchronous, DOM-free command processor. Every successful command emits a detached snapshot. */
export class BattleEngine {
  constructor(config, random) {
    this.config = config;
    this.random = random;
    this.rules = new BattleRules(config, random);
    this.state = null;
    this.events = [];
  }
  start(player, enemy) {
    if (this.state) throw new Error('Battle already started');
    if (player.length !== this.config.rules.teamSizePlayer || enemy.length !== this.config.rules.teamSizeEnemy) throw new Error('Invalid team sizes');
    if ([...player, ...enemy].some(p => !p.alive) || new Set([...player, ...enemy].map(p => p.id)).size !== player.length + enemy.length) throw new Error('Invalid battle instances');
    this.state = new BattleState(player, enemy);
    this.events = [];
    this.#startRound();
    return this.#result();
  }
  getSnapshot() { return this.#requiredState().snapshot(); }
  getPendingInput() {
    const s = this.#requiredState();
    if (s.phase === 'finished') return null;
    if (s.phase === 'forced-switch') return { type: 'ChooseForcedSwitch', side: s.pendingSwitch.side };
    const side = s.phase === 'more' ? s.extra : s.queue[s.queueIndex]?.side;
    return { type: s.phase === 'more' ? 'ChooseMoreAction' : 'ChooseAction', side, actorId: s.active[side] };
  }
  execute(command) {
    const s = this.#requiredState();
    if (!command || (command.expectedRevision !== undefined && command.expectedRevision !== s.revision)) return this.#error('StaleCommand');
    if (s.phase === 'finished') return this.#error('BattleFinished');
    if (s.phase === 'forced-switch') {
      if (command.type !== 'forced-switch' || typeof command.pigId !== 'string') return this.#error('InvalidPhase');
      const side = s.pendingSwitch.side;
      if (!this.#canSwitch(side, command.pigId)) return this.#error('InvalidSwitch');
      this.events = [];
      this.#switch(side, command.pigId);
      const resume = s.pendingSwitch.resume;
      s.pendingSwitch = null;
      if (resume === 'more') { s.phase = 'more'; }
      else this.#advance();
      s.revision++;
      return this.#result();
    }
    const side = s.phase === 'more' ? s.extra : s.queue[s.queueIndex]?.side;
    const actor = s.activePig(side);
    if (!actor?.alive || command.actorId && command.actorId !== actor.id) return this.#error('InvalidActor');
    if (!['action', 'more'].includes(s.phase)) return this.#error('InvalidPhase');
    const type = command.type;
    if (!['skill', 'guard', 'switch'].includes(type)) return this.#error('InvalidCommand');
    if (s.phase === 'more' && type === 'switch') return this.#error('InvalidPhase');
    let skill;
    if (type === 'skill') {
      if (!actor.skills.includes(command.skillId)) return this.#error('UnknownSkill');
      skill = this.config.skill(command.skillId);
      if (actor.sp < skill.spCost) return this.#error('InsufficientSp');
    }
    if (type === 'switch' && !this.#canSwitch(side, command.pigId)) return this.#error('InvalidSwitch');

    this.events = [];
    const wasMore = s.phase === 'more';
    let earnedMore = false;
    if (type === 'guard') {
      actor.guarding = true;
      actor.sp = Math.min(actor.maxSp, actor.sp + this.config.rules.guardSp);
      this.#emit('Guarded', { actorId: actor.id, sp: actor.sp });
    } else if (type === 'switch') {
      this.#switch(side, command.pigId);
    } else {
      actor.sp -= skill.spCost;
      const targetSide = s.other(side);
      const target = s.activePig(targetSide);
      const downBefore = target.down;
      const hit = this.rules.calculate(actor, target, skill);
      const victim = hit.reflected ? actor : target;
      victim.hp = Math.max(0, victim.hp - hit.damage);
      this.#emit('SkillUsed', { actorId: actor.id, targetId: target.id, skillId: skill.id });
      this.#emit(hit.reflected ? 'Reflected' : 'DamageApplied', { targetId: victim.id, amount: hit.damage });
      if (!hit.reflected) {
        if (hit.weak) {
          target.sp = Math.max(0, target.sp - 5);
          this.#emit('WeaknessHit', { targetId: target.id });
        }
        if (hit.critical) this.#emit('CriticalHit', { targetId: target.id });
        if ((hit.weak || hit.critical) && target.alive) {
          target.down = true;
          this.#emit('DownApplied', { targetId: target.id });
          if (!downBefore && !wasMore && !s.usedMore.has(actor.id)) {
            s.usedMore.add(actor.id);
            earnedMore = true;
            this.#emit('OneMoreGranted', { actorId: actor.id });
          }
        }
      }
    }
    if (wasMore) s.extra = null;
    this.#resolveFaints(earnedMore, side);
    s.revision++;
    return this.#result();
  }
  #requiredState() { if (!this.state) throw new Error('Battle not started'); return this.state; }
  #emit(kind, payload = {}) { this.events.push({ kind, ...payload }); }
  #error(errorCode) { return { ok: false, errorCode, snapshot: this.getSnapshot(), events: [], pendingInput: this.getPendingInput() }; }
  #result() { return { ok: true, snapshot: this.getSnapshot(), events: structuredClone(this.events), pendingInput: this.getPendingInput() }; }
  #canSwitch(side, pigId) {
    const s = this.state;
    return pigId !== s.active[side] && Boolean(s.pig(side, pigId)?.alive);
  }
  #switch(side, pigId) {
    const s = this.state;
    const previous = s.active[side];
    s.active[side] = pigId;
    s.activePig(side).switchShield = true;
    this.#emit('PigSwitched', { side, from: previous, to: pigId });
  }
  #resolveFaints(earnedMore, actorSide) {
    const s = this.state;
    const fainted = ['player', 'enemy'].filter(side => !s.activePig(side).alive);
    for (const side of fainted) this.#emit('PigFainted', { side, pigId: s.active[side] });
    const losers = ['player', 'enemy'].filter(side => !s.teams[side].some(p => p.alive));
    if (losers.length) {
      s.outcome = losers.length === 2 ? 'draw' : s.other(losers[0]);
      s.phase = 'finished';
      this.#emit('BattleFinished', { winner: s.outcome });
      return;
    }
    const stillMore = earnedMore && s.activePig(actorSide).alive;
    if (stillMore) s.extra = actorSide;
    for (const side of fainted) {
      if (side === 'enemy') {
        const best = s.teams.enemy.filter(p => p.alive && p.id !== s.active.enemy).sort((a,b) => b.hp - a.hp)[0];
        this.#switch('enemy', best.id);
      } else {
        s.pendingSwitch = { side, resume: stillMore ? 'more' : 'advance' };
        s.phase = 'forced-switch';
        return;
      }
    }
    if (stillMore) s.phase = 'more';
    else this.#advance();
  }
  #startRound() {
    const s = this.state;
    s.round++;
    s.usedMore.clear();
    s.extra = null;
    for (const side of ['player', 'enemy']) {
      for (const pig of s.teams[side]) pig.switchShield = false;
      const p = s.activePig(side);
      p.sp = Math.min(p.maxSp, p.sp + this.config.rules.roundSp);
    }
    this.#emit('RoundStarted', { round: s.round });
    s.queue = ['player', 'enemy'].map(side => ({ side, actorId: s.active[side], speed: s.activePig(side).speed }))
      .sort((a, b) => b.speed - a.speed || (a.side === 'player' ? -1 : 1));
    s.queueIndex = 0;
    this.#prepareActor();
  }
  #advance() {
    const s = this.state;
    s.extra = null;
    s.queueIndex++;
    if (s.queueIndex >= s.queue.length) this.#startRound();
    else this.#prepareActor();
  }
  #prepareActor() {
    const s = this.state;
    while (s.queueIndex < s.queue.length) {
      const entry = s.queue[s.queueIndex];
      const pig = s.pig(entry.side, entry.actorId);
      if (!pig.alive || s.active[entry.side] !== pig.id) { s.queueIndex++; continue; }
      pig.guarding = false;
      if (pig.down) { pig.down = false; this.#emit('DownSkipped', { actorId: pig.id }); s.queueIndex++; continue; }
      s.phase = 'action';
      return;
    }
    this.#startRound();
  }
}
