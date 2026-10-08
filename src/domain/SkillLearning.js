/** Pure inventory skill rules. A pig owns skill IDs; SkillConfigs are immutable definitions. */
export class SkillLearning {
  static validateAdd(pig, skillId, maxSkills = 6, replaceIndex = null) {
    if (pig.skills.includes(skillId)) return { ok: false, errorCode: 'DuplicateSkill' };
    if (replaceIndex !== null && (!Number.isInteger(replaceIndex) || replaceIndex < 0 || replaceIndex >= pig.skills.length)) return { ok: false, errorCode: 'InvalidSlot' };
    if (replaceIndex === null && pig.skills.length >= maxSkills) return { ok: false, errorCode: 'SkillSlotsFull' };
    return { ok: true };
  }
  static add(pig, skillId, maxSkills = 6, replaceIndex = null) {
    const check = this.validateAdd(pig, skillId, maxSkills, replaceIndex);
    if (!check.ok) return check;
    if (replaceIndex === null) pig.skills.push(skillId);
    else pig.skills[replaceIndex] = skillId;
    return { ok: true, skillId, replacedIndex: replaceIndex };
  }
}
