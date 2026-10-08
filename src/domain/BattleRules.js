/** Deterministic, platform-neutral calculations. All non-specified numbers are TEST FIXTURE ONLY. */
export class BattleRules {
  constructor(config, random) { this.config = config; this.random = random; }

  static STATS = ['attack', 'defense', 'speed', 'crit', 'spRegen'];
  multiplierForStage(stage) { return this.config.rules.statStageMultipliers[Math.max(-6, Math.min(6, stage)) + 6]; }
  effective(pig, stat) {
    let base;
    if (stat === 'crit') base = this.config.rules.critRate;
    else if (stat === 'spRegen') base = this.config.rules.roundSp;
    else base = pig[stat];
    let result = base * this.multiplierForStage(pig.stages[stat] ?? 0);
    if (stat === 'attack' && pig.status?.kind === 'burn') result *= 0.5;
    if (stat === 'speed' && pig.status?.kind === 'paralysis') result *= 0.5;
    return result;
  }
  calculate(actor, target, skill, bonus = 1) {
    const resistance = target.resistances[skill.type] ?? 'normal';
    const reflected = resistance === 'reflect';
    const roll = this.random.next();
    const critical = !reflected && resistance !== 'null' && roll < Math.min(1, Math.max(0, this.effective(actor, 'crit') + (skill.critModifier ?? 0)));
    // Reflect does NOT use affinity or defense of the defending target.
    const victim = reflected ? actor : target;
    const affinity = reflected ? 1 : this.config.multiplier(skill.type, target.type);
    const resistMultiplier = { normal: 1, weak: 1.5, resist: 0.5, null: 0, reflect: 1 }[resistance];
    if (resistMultiplier === undefined) throw new Error(`Unknown resistance ${resistance}`);
    const guard = victim.guarding ? (this.config.rules.guardDamageMultiplier ?? 0.5) : 1;
    const switchProtection = victim.switchShield ? 0.5 : 1;
    const raw = skill.power * this.effective(actor, 'attack') / Math.max(1, this.effective(victim, 'defense'))
      * affinity * resistMultiplier * (critical ? this.config.rules.critMultiplier : 1)
      * guard * switchProtection * (reflected ? 1 : bonus);
    return {
      damage: resistMultiplier === 0 ? 0 : Math.max(1, Math.floor(raw)),
      critical, weak: resistance === 'weak' && !reflected, reflected, resistance, affinity
    };
  }
  /** Apply an explicitly configured status; only one can be active at a time. */
  tryStatus(target, effect) {
    if (!effect || this.random.next() >= (effect.chance ?? this.config.rules.statusChance ?? 0.3)) return null;
    const duration = effect.duration ?? (this.config.rules.statusDurations?.[effect.kind] ?? null);
    target.status = { kind: effect.kind, remaining: duration };
    return structuredClone(target.status);
  }
  changeStages(target, changes) {
    const events = [];
    for (const item of changes ?? []) {
      if (!BattleRules.STATS.includes(item.stat) || !Number.isInteger(item.amount)) throw new Error('Invalid stat change');
      const before = target.stages[item.stat] ?? 0;
      const after = Math.max(-6, Math.min(6, before + item.amount));
      target.stages[item.stat] = after;
      events.push({ stat: item.stat, before, after });
    }
    return events;
  }
  /** Chance checks are only made at well-defined boundaries for reproducible playback. */
  tickRoundStatus(pig, emit) {
    const status = pig.status;
    if (!status || !pig.alive) return;
    const { kind } = status;
    if (kind === 'poison' || kind === 'burn') {
      const divisor = kind === 'poison' ? 8 : 16;
      const damage = Math.max(1, Math.floor(pig.maxHp / divisor));
      pig.hp = Math.max(0, pig.hp - damage);
      emit('StatusDamage', { actorId: pig.id, status: kind, amount: damage });
    } else if (kind === 'freeze' && this.random.next() < (this.config.rules.freezeThawChance ?? 0.2)) {
      pig.status = null;
      emit('StatusCleared', { actorId: pig.id, status: kind });
      return;
    }
    if (status.remaining !== null && status.remaining !== undefined) {
      status.remaining--;
      if (status.remaining <= 0) {
        pig.status = null;
        emit('StatusCleared', { actorId: pig.id, status: kind });
      }
    }
  }
  /** Returns 'skip', 'confused' or 'act'. */
  actionStatus(pig, emit) {
    const kind = pig.status?.kind;
    if (kind === 'sleep' || kind === 'freeze') {
      emit('StatusSkipped', { actorId: pig.id, status: kind }); return 'skip';
    }
    if (kind === 'paralysis' && this.random.next() < 0.25) {
      emit('StatusSkipped', { actorId: pig.id, status: kind }); return 'skip';
    }
    if (kind === 'confusion' && this.random.next() < (1 / 3)) {
      const power = this.config.rules.confusionSelfHitPower ?? 10;
      const damage = Math.max(1, Math.floor(power * this.effective(pig, 'attack') / Math.max(1, this.effective(pig, 'defense'))));
      pig.hp = Math.max(0, pig.hp - damage);
      emit('ConfusionSelfHit', { actorId: pig.id, amount: damage });
      return 'confused';
    }
    return 'act';
  }
}
