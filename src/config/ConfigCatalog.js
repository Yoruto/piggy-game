/** Read-only configuration definitions. The provided data is marked as a test fixture. */
export class ConfigCatalog {
  #pigs;
  #skills;
  #passives;
  static TYPES = ['pride', 'envy', 'wrath', 'sloth', 'greed', 'gluttony', 'lust'];
  static RESISTANCES = ['normal', 'weak', 'resist', 'null', 'reflect'];
  static STAT_NAMES = ['attack', 'defense', 'speed', 'crit', 'spRegen'];
  static STATUS_NAMES = ['poison', 'burn', 'paralysis', 'sleep', 'freeze', 'confusion'];
  constructor(data) {
    if (!data || data.fixture !== true) throw new Error('Only explicitly marked demo fixtures are supported until v1.3 data is supplied');
    if (data.schemaVersion !== 1 || typeof data.configVersion !== 'string' || !data.configVersion) throw new Error('Unsupported config version');
    this.configVersion = data.configVersion;
    const { rules, pigs, skills, affinity } = data;
    if (!rules || !Array.isArray(pigs) || !Array.isArray(skills) || !affinity) throw new Error('Invalid config structure');
    this.rules = structuredClone(rules);
    this.#pigs = new Map(pigs.map(p => [p.id, structuredClone(p)]));
    this.#skills = new Map(skills.map(s => [s.id, structuredClone(s)]));
    const passives = data.passives ?? [];
    this.#passives = new Map(passives.map(p => [p.id, structuredClone(p)]));
    this.affinity = structuredClone(affinity);
    if (this.#pigs.size !== pigs.length || this.#skills.size !== skills.length || this.#passives.size !== passives.length) throw new Error('Duplicate config ID');
    for (const key of ['teamSizePlayer','teamSizeEnemy','roundSp','guardSp','critRate','critMultiplier','maxSkills',
      'weaknessSpDamage','resistanceRerollEveryRounds','statusChance','freezeThawChance','batonPassDamageMultiplier','batonPassMultiplierCap']) {
      if (!Number.isFinite(rules[key])) throw new Error(`Missing rule ${key}`);
    }
    if (rules.teamSizePlayer !== 4 || rules.teamSizeEnemy !== 3 || rules.maxSkills !== 6) throw new Error('Demo party/skill limits mismatch');
    if (rules.critRate < 0 || rules.critRate > 1 || rules.statusChance < 0 || rules.statusChance > 1 ||
      rules.freezeThawChance < 0 || rules.freezeThawChance > 1 ||
      !Number.isInteger(rules.resistanceRerollEveryRounds) || rules.resistanceRerollEveryRounds <= 0 ||
      rules.batonPassDamageMultiplier < 1 || rules.batonPassMultiplierCap < 1) throw new Error('Invalid rule range');
    if (!Array.isArray(rules.resistanceRollPool) || !rules.resistanceRollPool.length ||
      rules.resistanceRollPool.some(x => !ConfigCatalog.RESISTANCES.includes(x))) throw new Error('Invalid resistance roll pool');
    if (!Array.isArray(rules.statStageMultipliers) || rules.statStageMultipliers.length !== 13 ||
      rules.statStageMultipliers.some(m => !Number.isFinite(m) || m <= 0) || rules.statStageMultipliers[6] !== 1) {
      throw new Error('Invalid stat stage multipliers');
    }
    if (!Number.isInteger(rules.inventoryCapacity) || rules.inventoryCapacity < rules.teamSizePlayer) throw new Error('Invalid inventory capacity');
    if (!Array.isArray(rules.rewardSkillCards) || rules.rewardSkillCards.some(id => !this.#skills.has(id))) throw new Error('Invalid card reward pool');
    if (!rules.ai || ['lowHpThreshold','lowHpGuardChance','knownWeaknessChance','batonPassChance'].some(k => !Number.isFinite(rules.ai[k]) || rules.ai[k] < 0 || rules.ai[k] > 1)) throw new Error('Invalid AI probabilities');
    for (const passive of passives) if (!passive.id || passive.kind !== 'heal' || !Number.isInteger(passive.interval) || passive.interval < 1 || !Number.isFinite(passive.amount) || passive.amount < 0) throw new Error(`Invalid passive ${passive.id}`);
    const types = ConfigCatalog.TYPES;
    for (const a of types) for (const b of types) {
      if (![1, 1.5, 0.67].includes(affinity[a]?.[b])) throw new Error(`Missing affinity ${a}/${b}`);
    }
    for (const p of pigs) {
      if (!p.id || !types.includes(p.type) || !['hp','sp','attack','defense','speed'].every(k => Number.isFinite(p[k]) && p[k] > 0)) throw new Error(`Invalid pig ${p.id}`);
      if (!Array.isArray(p.skills) || p.skills.length > rules.maxSkills || new Set(p.skills).size !== p.skills.length) throw new Error(`Invalid skill slots ${p.id}`);
      if (p.resistances && Object.entries(p.resistances).some(([k,v]) => !types.includes(k) || !ConfigCatalog.RESISTANCES.includes(v))) throw new Error(`Invalid resistances ${p.id}`);
      for (const id of p.skills) if (!this.#skills.has(id)) throw new Error(`Unknown skill ${id}`);
      if (p.passiveId && !this.#passives.has(p.passiveId)) throw new Error(`Unknown passive ${p.passiveId}`);
      if (!Array.isArray(p.learnset ?? []) || (p.learnset ?? []).some(x => !Number.isInteger(x.level) || x.level < 1 || !this.#skills.has(x.skillId))) throw new Error(`Invalid learnset ${p.id}`);
    }
    for (const s of skills) {
      if (!s.id || !types.includes(s.type) || !Number.isFinite(s.power) || s.power <= 0 || !Number.isInteger(s.spCost) || s.spCost < 0) throw new Error(`Invalid skill ${s.id}`);
      const effect = s.statusEffect;
      if (effect && (!ConfigCatalog.STATUS_NAMES.includes(effect.kind) || (effect.chance != null && (!Number.isFinite(effect.chance) || effect.chance < 0 || effect.chance > 1)) || (effect.duration != null && (!Number.isInteger(effect.duration) || effect.duration < 1)))) throw new Error(`Invalid status effect ${s.id}`);
      if (s.statChanges && (!Array.isArray(s.statChanges) || s.statChanges.some(c => !ConfigCatalog.STAT_NAMES.includes(c.stat) || !Number.isInteger(c.amount) || !['self','enemy'].includes(c.target)))) throw new Error(`Invalid stat changes ${s.id}`);
      if (s.tags && (!Array.isArray(s.tags) || s.tags.some(t => typeof t !== 'string'))) throw new Error(`Invalid tags ${s.id}`);
    }
    const freeze = obj => { if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) { Object.values(obj).forEach(freeze); Object.freeze(obj); } };
    freeze(this.rules); freeze(this.affinity);
    for (const p of this.#pigs.values()) freeze(p);
    for (const s of this.#skills.values()) freeze(s);
    for (const p of this.#passives.values()) freeze(p);
  }
  pig(id) { const value = this.#pigs.get(id); if (!value) throw new Error(`Unknown pig: ${id}`); return value; }
  passive(id) { const value = this.#passives.get(id); if (!value) throw new Error(`Unknown passive: ${id}`); return value; }
  skill(id) { const value = this.#skills.get(id); if (!value) throw new Error(`Unknown skill: ${id}`); return value; }
  multiplier(attackType, defenseType) { return this.affinity[attackType][defenseType]; }
}
