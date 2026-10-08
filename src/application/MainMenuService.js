export class MainMenuService {
  constructor(session) { this.session = session; }
  reset() { this.session.reset(); return { ok: true }; }
  startBattle(roster, enemies) {
    try { return this.session.startBattle(roster, enemies); }
    catch (error) { return { ok: false, errorCode: error.message }; }
  }
}
