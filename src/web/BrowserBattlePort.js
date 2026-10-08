/** Thin browser-facing orchestration adapter. The Domain stays synchronous and DOM-free. */
export class BrowserBattlePort {
  constructor(service) { this.service = service; }
  getSnapshot() { return this.service.getSnapshot(); }
  getPendingInput() { return this.service.getPendingInput(); }
  dispatch(command) {
    const first = this.service.dispatch(command);
    if (!first.ok) return first;
    // Every enemy decision still goes through the same BattleEngine command path.
    const enemyEvents = first.pendingInput?.side === 'enemy' ? this.service.runEnemyTurns() : [];
    return { ...first, snapshot: this.service.getSnapshot(), events: [...first.events,...enemyEvents], pendingInput: this.service.getPendingInput() };
  }
  advanceOpening() {
    if (this.getPendingInput()?.side !== 'enemy') return [];
    return this.service.runEnemyTurns();
  }
}
