/** Mutable player/enemy instance; never mutate the shared PigConfig template. */
export class PigInstance {
  constructor(config, instanceId, level = 1) {
    if (!instanceId || !Number.isInteger(level) || level < 1) throw new Error('Invalid pig instance');
    this.id = instanceId;
    this.configId = config.id;
    this.name = config.name;
    this.type = config.type;
    this.level = level;
    this.maxHp = config.hp;
    this.hp = config.hp;
    this.maxSp = config.sp;
    this.sp = config.sp;
    this.attack = config.attack;
    this.defense = config.defense;
    this.speed = config.speed;
    this.skills = [...config.skills];
    this.down = false;
    this.guarding = false;
    this.switchShield = false;
    this.resistances = { ...(config.resistances ?? {}) };
  }
  get alive() { return this.hp > 0; }
  restore() { this.hp = this.maxHp; this.sp = this.maxSp; this.down = false; this.guarding = false; this.switchShield = false; }
}
