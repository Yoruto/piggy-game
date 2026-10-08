import { BattleState } from './BattleState.js';
import { BattleRules } from './BattleRules.js';

/** Single synchronous writer for battle commands. No UI, timers, or global RNG. */
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
    const side = s.phase === 'more' || s.phase === 'pass-action' ? s.extra : s.queue[s.queueIndex]?.side;
    return { type: s.phase === 'more' ? 'ChooseMoreAction' : s.phase === 'pass-action' ? 'ChooseBatonAction' : 'ChooseAction', side, actorId: s.active[side] };
  }
  execute(command) {
    const s = this.#requiredState();
    if (!command || (command.expectedRevision !== undefined && command.expectedRevision !== s.revision)) return this.#error('StaleCommand');
    if (s.phase === 'finished') return this.#error('BattleFinished');
    if (s.phase === 'forced-switch') {
      if (command.type !== 'forced-switch' || typeof command.pigId !== 'string') return this.#error('InvalidPhase');
      const { side, resume } = s.pendingSwitch;
      if (!this.#canSwitch(side, command.pigId)) return this.#error('InvalidSwitch');
      this.events = [];
      this.#switch(side, command.pigId);
      s.pendingSwitch = null;
      if (resume === 'round-start') this.#buildQueue();
      else this.#afterAction();
      s.revision++;
      return this.#result();
    }
    if (!['action', 'more', 'pass-action'].includes(s.phase)) return this.#error('InvalidPhase');
    const side = s.phase === 'more' || s.phase === 'pass-action' ? s.extra : s.queue[s.queueIndex]?.side;
    const actor = s.activePig(side);
    if (!actor?.alive || (command.actorId && command.actorId !== actor.id)) return this.#error('InvalidActor');
    const type = command.type;
    const phase = s.phase;
    if (!['skill', 'guard', 'switch', 'baton-pass'].includes(type)) return this.#error('InvalidCommand');
    if (type === 'baton-pass' && phase !== 'more') return this.#error('InvalidPhase');
    if (type === 'switch' && phase !== 'action') return this.#error('InvalidPhase');
    if (type === 'baton-pass' && s.usedBatonPass) return this.#error('BatonPassUsed');
    if (['switch', 'baton-pass'].includes(type) && !this.#canSwitch(side, command.pigId)) return this.#error('InvalidSwitch');
    let skill;
    if (type === 'skill') {
      if (!actor.skills.includes(command.skillId)) return this.#error('UnknownSkill');
      skill = this.config.skill(command.skillId);
      if (actor.sp < skill.spCost) return this.#error('InsufficientSp');
    }
    this.events = [];
    if (type === 'baton-pass') {
      s.usedBatonPass = true;
      s.pass = { from: actor.id, to: command.pigId, multiplier: Math.min(this.config.rules.batonPassMultiplierCap, this.config.rules.batonPassDamageMultiplier) };
      this.#switch(side, command.pigId);
      this.#emit('BatonPassed', { side, from: actor.id, to: command.pigId, multiplier: s.pass.multiplier });
      s.phase = 'pass-action';
      this.#preparePassRecipient();
    } else {
      let earnedMore = false;
      if (type === 'guard') {
        actor.guarding = true;
        actor.sp = Math.min(actor.maxSp, actor.sp + this.config.rules.guardSp);
        this.#emit('Guarded', { actorId: actor.id, sp: actor.sp });
      } else if (type === 'switch') this.#switch(side, command.pigId);
      else earnedMore = this.#resolveSkill(side, actor, skill, phase);
      // Baton recipient's bonus has no lifetime beyond the next command.
      if (phase === 'pass-action') {
        s.pass = null;
        this.#emit('BatonBonusEnded', { actorId: actor.id });
      }
      if (phase === 'more' || phase === 'pass-action') s.extra = null;
      if (earnedMore && actor.alive) s.extra = side;
      if (!this.#resolveFaints('after-action')) this.#afterAction();
    }
    s.revision++;
    return this.#result();
  }
  #resolveSkill(side, actor, skill, phase) {
    const s = this.state;
    const target = s.activePig(s.other(side));
    const wasDown = target.down;
    actor.sp -= skill.spCost;
    this.#emit('SkillUsed', { actorId: actor.id, targetId: target.id, skillId: skill.id, spCost: skill.spCost });
    const hit = this.rules.calculate(actor, target, skill, phase === 'pass-action' ? s.pass.multiplier : 1);
    const victim = hit.reflected ? actor : target;
    victim.hp = Math.max(0, victim.hp - hit.damage);
    this.#emit(hit.reflected ? 'Reflected' : 'DamageApplied', { targetId: victim.id, amount: hit.damage });
    if (!hit.reflected) {
      // Knowledge belongs to the observing side, never to the target instance.
      const known = s.knownResistances[side][target.id] ??= {};
      known[skill.type] = hit.resistance;
      this.#emit('ResistanceDiscovered', { side, targetId: target.id, type: skill.type, resistance: hit.resistance });
    } else {
      const known = s.knownResistances[side][target.id] ??= {};
      known[skill.type] = hit.resistance;
      this.#emit('ResistanceDiscovered', { side, targetId: target.id, type: skill.type, resistance: hit.resistance });
      return false;
    }
    if (hit.weak) {
      const loss = Math.min(target.sp, this.config.rules.weaknessSpDamage);
      target.sp -= loss;
      this.#emit('WeaknessHit', { targetId: target.id, spLost: loss });
    }
    if (hit.critical) this.#emit('CriticalHit', { targetId: target.id });
    const triggersMore = hit.damage > 0 && (hit.weak || hit.critical) && !wasDown && phase === 'action' &&
      !s.usedMore.has(actor.id) && actor.alive && s.teams[s.other(side)].some(p => p.alive);
    if (hit.damage > 0 && (hit.weak || hit.critical) && target.alive) {
      target.down = true;
      this.#emit('DownApplied', { targetId: target.id });
    }
    if (triggersMore) {
      s.usedMore.add(actor.id);
      this.#emit('OneMoreGranted', { actorId: actor.id });
    }
    if (target.alive) {
      if (target.status?.kind === 'freeze' && skill.tags?.includes('fire')) {
        target.status = null;
        this.#emit('StatusCleared', { actorId: target.id, status: 'freeze', reason: 'fire' });
      }
      const applied = this.rules.tryStatus(target, skill.statusEffect);
      if (applied) this.#emit('StatusApplied', { actorId: target.id, status: applied.kind, remaining: applied.remaining });
    }
    // Stat stage effects can affect either the actor or a living target.
    for (const change of skill.statChanges ?? []) {
      const receiver = change.target === 'self' ? actor : target;
      if (!receiver.alive) continue;
      for (const result of this.rules.changeStages(receiver, [change])) {
        this.#emit('StatStageChanged', { actorId: receiver.id, ...result });
      }
    }
    return triggersMore;
  }
  #requiredState() { if (!this.state) throw new Error('Battle not started'); return this.state; }
  #emit(kind, payload = {}) { this.events.push({ ...payload, kind, seq: ++this.state.eventSequence }); }
  #error(errorCode) { return { ok: false, errorCode, snapshot: this.getSnapshot(), events: [], pendingInput: this.getPendingInput() }; }
  #result() { return { ok: true, snapshot: this.getSnapshot(), events: structuredClone(this.events), pendingInput: this.getPendingInput() }; }
  #canSwitch(side, pigId) { return pigId !== this.state.active[side] && Boolean(this.state.pig(side, pigId)?.alive); }
  #switch(side, pigId) {
    const s = this.state;
    const previous = s.active[side];
    s.active[side] = pigId;
    s.activePig(side).switchShield = true;
    this.#emit('PigSwitched', { side, from: previous, to: pigId });
  }
  /** Returns true if an input boundary or game over interrupted control flow. */
  #resolveFaints(resume) {
    const s = this.state;
    const fainted = ['player', 'enemy'].filter(side => !s.activePig(side).alive);
    for (const side of fainted) this.#emit('PigFainted', { side, pigId: s.active[side] });
    const losers = ['player', 'enemy'].filter(side => !s.teams[side].some(p => p.alive));
    if (losers.length) {
      s.outcome = losers.length === 2 ? 'draw' : s.other(losers[0]);
      s.phase = 'finished'; s.extra = null; s.pass = null;
      // Transient battle effects never persist into the inventory/session.
      for (const pig of [...s.teams.player, ...s.teams.enemy]) {
        pig.status = null; pig.down = false; pig.guarding = false; pig.switchShield = false;
        for (const stat of Object.keys(pig.stages)) pig.stages[stat] = 0;
      }
      this.#emit('BattleFinished', { winner: s.outcome });
      return true;
    }
    if (fainted.includes('enemy')) {
      const best = s.teams.enemy.filter(p => p.alive).sort((a, b) => b.hp - a.hp)[0];
      this.#switch('enemy', best.id);
    }
    if (fainted.includes('player')) {
      s.pendingSwitch = { side: 'player', resume };
      s.phase = 'forced-switch';
      return true;
    }
    return false;
  }
  #afterAction() {
    const s = this.state;
    if (s.extra && s.activePig(s.extra).alive) s.phase = 'more';
    else this.#advance();
  }
  #preparePassRecipient() {
    const s = this.state;
    const pig = s.activePig(s.extra);
    pig.guarding = false;
    // A newly switched-in Down or disabled pig cannot exploit Baton Pass.
    if (pig.down) {
      pig.down = false;
      this.#emit('DownSkipped', { actorId: pig.id });
      s.pass = null; s.extra = null;
      this.#advance();
      return;
    }
    const outcome = this.rules.actionStatus(pig, (kind, data) => this.#emit(kind, data));
    if (outcome !== 'act') {
      s.pass = null; s.extra = null;
      this.#emit('BatonBonusEnded', { actorId: pig.id });
      if (!this.#resolveFaints('after-action')) this.#advance();
    }
  }
  #startRound() {
    const s = this.state;
    s.round++;
    s.usedMore.clear(); s.usedBatonPass = false; s.extra = null; s.pass = null;
    for (const side of ['player', 'enemy']) for (const pig of s.teams[side]) pig.switchShield = false;
    this.#emit('RoundStarted', { round: s.round });
    for (const side of ['player', 'enemy']) {
      const p = s.activePig(side);
      const regen = Math.max(0, Math.floor(this.rules.effective(p, 'spRegen')));
      const beforeSp = p.sp;
      p.sp = Math.min(p.maxSp, p.sp + regen);
      this.#emit('SpRecovered', { actorId: p.id, amount: p.sp - beforeSp });
    }
    // Passive triggers after SP recovery, in player-then-enemy order.
    for (const side of ['player', 'enemy']) {
      this.rules.tickPassive(s.activePig(side), s.round, (kind, data) => this.#emit(kind, data));
    }
    if (s.round % this.config.rules.resistanceRerollEveryRounds === 0) {
      for (const side of ['player', 'enemy']) {
        const p = s.activePig(side);
        for (const type of Object.keys(this.config.affinity)) {
          const pool = this.config.rules.resistanceRollPool;
          p.resistances[type] = pool[this.random.index(pool.length)];
        }
        this.#emit('ResistancesRerolled', { side, pigId: p.id });
      }
      s.knownResistances = { player: {}, enemy: {} };
      this.#emit('ResistanceKnowledgeCleared');
    }
    for (const side of ['player', 'enemy']) this.rules.tickRoundStatus(s.activePig(side), (kind, data) => this.#emit(kind, data));
    if (!this.#resolveFaints('round-start')) this.#buildQueue();
  }
  #buildQueue() {
    const s = this.state;
    s.queue = ['player', 'enemy'].map(side => ({ side, actorId: s.active[side], speed: this.rules.effective(s.activePig(side), 'speed') }))
      .sort((a, b) => b.speed - a.speed || (a.side === 'player' ? -1 : 1));
    s.queueIndex = 0;
    this.#prepareActor();
  }
  #advance() {
    const s = this.state;
    s.extra = null; s.pass = null;
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
      const statusResult = this.rules.actionStatus(pig, (kind, data) => this.#emit(kind, data));
      if (statusResult !== 'act') {
        if (statusResult === 'confused' && this.#resolveFaints('after-action')) return;
        s.queueIndex++;
        continue;
      }
      s.phase = 'action';
      return;
    }
    this.#startRound();
  }
}
