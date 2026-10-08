/** Read-only game definitions. IDs and rules are platform-neutral (Web / Unity). */
export class ConfigCatalog {
  constructor(data) {
    if (!data || data.fixture !== true) throw new Error('Only explicitly marked demo fixtures are supported until v1.3 data is supplied');
    const { rules, pigs, skills, affinity } = data;
    if (!rules || !Array.isArray(pigs) || !Array.isArray(skills) || !affinity) throw new Error('Invalid config structure');
    this.rules = structuredClone(rules);
    this.pigs = new Map(pigs.map(p => [p.id, structuredClone(p)]));
    this.skills = new Map(skills.map(s => [s.id, structuredClone(s)]));
    this.affinity = structuredClone(affinity);
    if (this.pigs.size !== pigs.length || this.skills.size !== skills.length) throw new Error('Duplicate config ID');
    for (const key of ['teamSizePlayer', 'teamSizeEnemy', 'roundSp', 'guardSp', 'critRate', 'critMultiplier', 'maxSkills']) {
      if (!Number.isFinite(rules[key])) throw new Error(`Missing rule ${key}`);
    }
    if (rules.teamSizePlayer !== 4 || rules.teamSizeEnemy !== 3 || rules.maxSkills !== 6) throw new Error('Demo party/skill limits mismatch');
    if (rules.critRate < 0 || rules.critRate > 1) throw new Error('Invalid crit rate');
    const types = ['pride', 'envy', 'wrath', 'sloth', 'greed', 'gluttony', 'lust'];
    for (const a of types) for (const b of types) {
      if (![1, 1.5, 0.67].includes(affinity[a]?.[b])) throw new Error(`Missing affinity ${a}/${b}`);
    }
    for (const p of pigs) {
      if (!p.id || !types.includes(p.type) || !['hp','sp','attack','defense','speed'].every(k => Number.isFinite(p[k]) && p[k] > 0)) throw new Error(`Invalid pig ${p.id}`);
      if (!Array.isArray(p.skills) || p.skills.length > rules.maxSkills || new Set(p.skills).size !== p.skills.length) throw new Error(`Invalid skill slots ${p.id}`);
      for (const id of p.skills) if (!this.skills.has(id)) throw new Error(`Unknown skill ${id}`);
    }
    for (const s of skills) {
      if (!s.id || !types.includes(s.type) || !Number.isFinite(s.power) || s.power <= 0 || !Number.isInteger(s.spCost) || s.spCost < 0) throw new Error(`Invalid skill ${s.id}`);
    }
    const freeze = obj => { if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) { Object.values(obj).forEach(freeze); Object.freeze(obj); } };
    freeze(this.rules); freeze(this.affinity);
    for (const p of this.pigs.values()) freeze(p);
    for (const s of this.skills.values()) freeze(s);
  }
  pig(id) { const value = this.pigs.get(id); if (!value) throw new Error(`Unknown pig: ${id}`); return value; }
  skill(id) { const value = this.skills.get(id); if (!value) throw new Error(`Unknown skill: ${id}`); return value; }
  multiplier(attackType, defenseType) { return this.affinity[attackType][defenseType]; }
}
