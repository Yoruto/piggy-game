export class InventoryService {
  constructor(session) { this.session = session; }
  getSnapshot() { return this.session.inventorySnapshot(); }
  useSkillCard(cardId, pigId, replaceIndex = null) { return this.session.useSkillCard(cardId, pigId, replaceIndex); }
  levelUp(pigId, level) { return this.session.levelUp(pigId, level); }
  resolveLearnedSkill(replaceIndex = null, skip = false) { return this.session.resolveLearnedSkill(replaceIndex, skip); }
}
