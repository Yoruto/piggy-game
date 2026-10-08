/** Lifecycle-only MVP coordinators. Tests provide FakeViews; DOM views are v1.0. */
class ScreenPresenter {
  constructor(view, service) { this.view = view; this.service = service; this.initialized = false; }
  initialize(handlers) {
    if (this.initialized) this.dispose();
    this.view.bind(handlers);
    this.initialized = true;
    this.refresh();
  }
  dispose() { if (this.initialized) this.view.unbind(); this.initialized = false; }
  refresh() { this.view.render(this.service.getSnapshot()); }
}
export class InventoryPresenter extends ScreenPresenter {
  initialize() { super.initialize({
    onUseCard: (cardId, pigId, slot = null) => this.#act(this.service.useSkillCard(cardId, pigId, slot)),
    onLevelUp: (pigId, level) => this.#act(this.service.levelUp(pigId, level)),
    onLearnChoice: (slot = null, skip = false) => this.#act(this.service.resolveLearnedSkill(slot, skip))
  }); }
  #act(result) { if (result.ok) this.refresh(); else this.view.showError?.(result.errorCode); return result; }
}
export class RewardPresenter extends ScreenPresenter {
  initialize() { super.initialize({
    onRecruit: id => this.#act(this.service.recruit(id)),
    onDecline: () => this.#act(this.service.decline())
  }); }
  #act(result) { if (result.ok) this.refresh(); else this.view.showError?.(result.errorCode); return result; }
}
export class MainMenuPresenter {
  constructor(view, service) { this.view = view; this.service = service; this.initialized = false; }
  initialize() {
    if (this.initialized) this.dispose();
    this.view.bind({ onReset: () => this.service.reset(), onStartBattle: (roster, enemies) => this.service.startBattle(roster, enemies) });
    this.initialized = true;
    this.view.render({ availableActions: ['StartBattle', 'Inventory', 'Reset'] });
  }
  dispose() { if (this.initialized) this.view.unbind(); this.initialized = false; }
}
