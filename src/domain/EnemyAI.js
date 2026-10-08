/** Rule-based AI: selects only from currently affordable learned skills. */
export class EnemyAI {
  constructor(config, random) { this.config = config; this.random = random; }
  choose(state) {
    const self = state.activePig('enemy');
    const target = state.activePig('player');
    const options = self.skills.map(id => this.config.skill(id)).filter(s => s.spCost <= self.sp);
    if (self.hp / self.maxHp < 0.2 && this.random.next() < 0.3) return { type: 'guard' };
    if (!options.length) return { type: 'guard' };
    const choice = target.hp / target.maxHp < 0.2
      ? [...options].sort((a, b) => b.power - a.power)[0]
      : options[this.random.index(options.length)];
    return { type: 'skill', skillId: choice.id };
  }
}
