export class BattleRules {
  constructor(config, random) { this.config = config; this.random = random; }
  calculate(actor, target, skill) {
    // This is an explicit TEMPORARY fixture formula, NOT the unavailable design v1.3 formula.
    const affinity = this.config.multiplier(skill.type, target.type);
    const resistance = target.resistances[skill.type] ?? 'normal';
    const critical = this.random.next() < this.config.rules.critRate;
    if (resistance === 'reflect') {
      return { damage: Math.max(1, Math.floor(skill.power * actor.attack / Math.max(1, actor.defense))), critical: false, weak: false, reflected: true, affinity };
    }
    const resistMultiplier = { normal: 1, weak: 1.5, resist: 0.5, null: 0 }[resistance];
    if (resistMultiplier === undefined) throw new Error(`Unknown resistance ${resistance}`);
    const guard = target.guarding ? 0.5 : 1;
    const switchProtection = target.switchShield ? 0.5 : 1;
    const raw = skill.power * actor.attack / Math.max(1, target.defense) * affinity * resistMultiplier * (critical ? this.config.rules.critMultiplier : 1) * guard * switchProtection;
    return { damage: resistMultiplier === 0 ? 0 : Math.max(1, Math.floor(raw)), critical, weak: resistance === 'weak', reflected: false, affinity };
  }
}
