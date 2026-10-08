/** Public application boundary for a future Web/Unity Presenter. */
export class BattleService {
  constructor(session) { this.session = session; }
  getSnapshot() { return this.session.battle?.getSnapshot() ?? null; }
  getPendingInput() { return this.session.battle?.getPendingInput() ?? null; }
  dispatch(command) {
    if (!this.session.battle) return { ok: false, errorCode: 'NoBattle' };
    const result = this.session.battle.execute(command);
    if (result.ok && result.snapshot.phase === 'finished') this.session.finalizeBattle();
    return result;
  }
  runEnemyTurns(limit = 100) {
    const events = this.session.runEnemyTurns(limit);
    if (this.session.battle?.state.phase === 'finished') this.session.finalizeBattle();
    return events;
  }
}
