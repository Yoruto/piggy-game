/** Award collection is a session-level concern, not a BattleEngine concern. */
export class RewardService {
  constructor(session) { this.session = session; }
  getSnapshot() { return this.session.getRewardSnapshot(); }
  recruit(pigId) { return this.session.resolveRecruit(pigId); }
  decline() { return this.session.resolveRecruit(null); }
}
