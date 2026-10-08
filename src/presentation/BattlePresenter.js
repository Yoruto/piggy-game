import { mapBattleSnapshot, mapBattleEvents } from './ViewModelMapper.js';

/** UI-independent MVP coordinator. Both BattleEngine and BattleService satisfy its port. */
export class BattlePresenter {
  constructor(view, battlePort) {
    this.view = view;
    this.engine = battlePort;
    this.busy = false;
    this.initialized = false;
    this.generation = 0;
  }
  initialize() {
    if (this.initialized) this.dispose();
    this.initialized = true;
    ++this.generation;
    this.view.bind({ onCommand: command => this.execute(command) });
    this.view.render(mapBattleSnapshot(this.engine.getSnapshot()));
    this.view.showPendingInput?.(this.engine.getPendingInput?.());
  }
  async execute(command) {
    if (!this.initialized) return { ok: false, errorCode: 'PresenterDisposed' };
    if (this.busy) return { ok: false, errorCode: 'PresentationBusy' };
    this.busy = true;
    const generation = this.generation;
    try {
      const result = this.engine.dispatch ? this.engine.dispatch(command) : this.engine.execute(command);
      if (!result.ok) this.view.showError(result.errorCode);
      else {
        this.view.render(mapBattleSnapshot(result.snapshot));
        await this.view.playEvents(mapBattleEvents(result.events));
        if (this.initialized && this.generation === generation) this.view.showPendingInput?.(result.pendingInput);
      }
      return result;
    } finally { this.busy = false; }
  }
  dispose() {
    if (this.initialized) this.view.unbind();
    this.initialized = false;
    ++this.generation;
  }
}
