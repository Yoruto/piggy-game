/** UI-independent MVP glue; the real DOM View is intentionally postponed to v1.0. */
export class BattlePresenter {
  constructor(view, battleEngine) {
    this.view = view;
    this.engine = battleEngine;
    this.busy = false;
    this.handlers = null;
  }
  initialize() {
    this.handlers = { onCommand: command => this.execute(command) };
    this.view.bind(this.handlers);
    this.view.render(this.engine.getSnapshot());
  }
  async execute(command) {
    if (this.busy) return { ok: false, errorCode: 'PresentationBusy' };
    this.busy = true;
    try {
      const result = this.engine.execute(command);
      if (!result.ok) this.view.showError(result.errorCode);
      else {
        this.view.render(result.snapshot);
        await this.view.playEvents(result.events);
      }
      return result;
    } finally { this.busy = false; }
  }
  dispose() { this.view.unbind(); this.handlers = null; }
}
