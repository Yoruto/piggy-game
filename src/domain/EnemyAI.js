/** Rule-driven opponent: produces legal commands only; engine remains the sole state writer. */
export class EnemyAI {
  constructor(config, random) { this.config = config; this.random = random; }
  choose(state) {
    const self = state.activePig('enemy');
    const target = state.activePig('player');
    if (state.phase === 'more' && state.extra === 'enemy' && !state.usedBatonPass) {
      const candidate = state.teams.enemy.filter(p => p.alive && p.id !== self.id && p.hp > self.hp)
        .sort((a, b) => b.hp - a.hp)[0];
      if (candidate && this.random.next() < 0.3) return { type: 'baton-pass', pigId: candidate.id };
    }
    const options = self.skills.map(id => this.config.skill(id)).filter(skill => skill.spCost <= self.sp);
    if (self.hp / self.maxHp < 0.2 && this.random.next() < 0.3) return { type: 'guard' };
    if (!options.length) return { type: 'guard' };
    if (target.hp / target.maxHp < 0.2) {
      return { type: 'skill', skillId: [...options].sort((a, b) => b.power - a.power)[0].id };
    }
    const known = state.knownResistances.enemy[target.id] ?? {};
    const weakness = options.filter(skill => known[skill.type] === 'weak');
    if (weakness.length && this.random.next() < 0.7) {
      return { type: 'skill', skillId: weakness[this.random.index(weakness.length)].id };
    }
    return { type: 'skill', skillId: options[this.random.index(options.length)].id };
  }
}
