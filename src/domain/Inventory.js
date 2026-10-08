export class Inventory {
  constructor(capacity = 8) { this.capacity = capacity; this.pigs = []; }
  add(pig) {
    if (this.pigs.length >= this.capacity) return { ok: false, error: 'InventoryFull' };
    if (this.pigs.some(p => p.id === pig.id)) return { ok: false, error: 'DuplicateInstance' };
    this.pigs.push(pig); return { ok: true };
  }
  get(id) { return this.pigs.find(p => p.id === id); }
  roster(ids, count = 4) {
    if (ids.length !== count || new Set(ids).size !== count) throw new Error('Invalid roster');
    const roster = ids.map(id => this.get(id));
    if (roster.some(p => !p || !p.alive)) throw new Error('Invalid roster member');
    return roster;
  }
}
