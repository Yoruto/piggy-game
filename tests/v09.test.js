import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFixture } from '../src/config/loadFixture.js';
import { GameSession } from '../src/application/GameSession.js';
import { BattleService } from '../src/application/BattleService.js';
import { InventoryService } from '../src/application/InventoryService.js';
import { RewardService } from '../src/application/RewardService.js';
import { MainMenuService } from '../src/application/MainMenuService.js';
import { BattlePresenter } from '../src/presentation/BattlePresenter.js';
import { MainMenuPresenter, RewardPresenter, InventoryPresenter } from '../src/presentation/ScreenPresenters.js';
import { mapBattleSnapshot } from '../src/presentation/ViewModelMapper.js';
import { runHeadlessGame } from '../scripts/headless.js';
import { ConfigCatalog } from '../src/config/ConfigCatalog.js';
import { readFile } from 'node:fs/promises';

const starters = ['pig.bread','pig.pride','pig.envy','pig.wrath'];
const foes = ['pig.wrath','pig.pride','pig.envy'];
async function fresh(seed = 47) {
  const cfg = await loadFixture();
  const game = new GameSession(cfg, seed);
  game.addStarter(starters);
  return { cfg, game };
}
async function winningSession(extraPigs = 0) {
  const { game } = await fresh();
  for (let i=0; i<extraPigs; i++) assert(game.inventory.add(game.createPig('pig.pride')).ok);
  game.startBattle(game.inventory.pigs.slice(0,4).map(p=>p.id), foes);
  const enemy = game.battle.state.teams.enemy;
  enemy[0].hp = 1; enemy[1].hp = 0; enemy[2].hp = 0;
  const r = new BattleService(game).dispatch({type:'skill',skillId:'skill.sloth'});
  assert.equal(r.ok,true);
  assert.equal(game.battle.state.outcome,'player');
  return game;
}

test('v0.5: config passive heals at specified interval with player event before enemy', async () => {
  const {game} = await fresh();
  const r = game.startBattle(game.inventory.pigs.map(p=>p.id), foes);
  const p = game.battle.state.activePig('player'), e=game.battle.state.activePig('enemy');
  e.passiveId=p.passiveId;
  p.hp=65; e.hp=50;
  let result=game.battle.execute({type:'guard'});
  result=game.battle.execute({type:'guard'});
  assert.equal(result.snapshot.round,2);
  const triggers=result.events.filter(x=>x.kind==='PassiveHealed');
  assert.equal(triggers.length,2);
  assert.deepEqual(triggers.map(x=>x.actorId),[p.id,e.id]);
  assert.equal(p.hp,70); assert.equal(e.hp,55);
  assert(triggers[0].seq<triggers[1].seq);
  assert(!r.events.some(x=>x.kind==='PassiveHealed'));
});

test('v0.7: win awards one card once, candidate holds skills/resistances; decline ends choice', async () => {
  const game=await winningSession();
  const rewards = new RewardService(game);
  const snapshot=rewards.getSnapshot();
  assert(snapshot.won && !snapshot.resolved);
  assert.equal(snapshot.candidates.length,3);
  const skillId=[...game.inventory.skillCards.keys()][0];
  assert.equal(game.inventory.cardCount(skillId),1);
  game.finalizeBattle();
  assert.equal(game.inventory.cardCount(skillId),1);
  assert.equal(game.startBattle.bind(game,game.inventory.pigs.map(p=>p.id),foes) instanceof Function,true);
  assert.throws(()=>game.startBattle(game.inventory.pigs.map(p=>p.id),foes),/PendingRecruitChoice/);
  assert.equal(rewards.decline().ok,true);
  assert.equal(rewards.decline().errorCode,'NoPendingRecruit');
});

test('v0.7: 7 -> 8 inventory recruit preserves skills and resistances, restores HP/SP', async () => {
  const game=await winningSession(3);
  const pending=game.getRewardSnapshot();
  const before=pending.candidates[0];
  const service=new RewardService(game);
  assert.equal(service.recruit('pig-missing').errorCode,'InvalidRecruitCandidate');
  const r=service.recruit(before.id);
  assert.equal(r.ok,true);
  assert.equal(game.inventory.pigs.length,8);
  const pig=game.inventory.get(before.id);
  assert.equal(pig.hp,pig.maxHp); assert.equal(pig.sp,pig.maxSp);
  assert.deepEqual(pig.skills,before.skills); assert.deepEqual(pig.resistances,before.resistances);
  assert.equal(pig.status,null); assert.equal(pig.stages.attack,0);
  assert.equal(service.recruit(before.id).errorCode,'NoPendingRecruit');
});

test('v0.7: full 8/8 inventory rejects recruit atomically and allows decline', async () => {
  const game=await winningSession(4);
  const choice=game.getRewardSnapshot().candidates[0];
  const original=game.inventory.pigs.map(p=>p.id);
  assert.equal(game.resolveRecruit(choice.id).errorCode,'InventoryFull');
  assert.deepEqual(game.inventory.pigs.map(p=>p.id),original);
  assert.equal(game.getRewardSnapshot().resolved,false);
  assert.equal(game.resolveRecruit(null).ok,true);
});

test('v0.7: using a skill card consumes only on success and prevents duplicates', async () => {
  const {game}=await fresh();
  const inv=new InventoryService(game);
  const pig=game.inventory.pigs[0];
  game.inventory.addCard('skill.poison',2);
  assert.equal(inv.useSkillCard('skill.poison','nonexistent').errorCode,'UnknownPig');
  assert.equal(inv.useSkillCard('skill.poison',pig.id).ok,true);
  assert.equal(game.inventory.cardCount('skill.poison'),1);
  assert.equal(inv.useSkillCard('skill.poison',pig.id).errorCode,'DuplicateSkill');
  assert.equal(game.inventory.cardCount('skill.poison'),1);
  assert.equal(inv.useSkillCard('skill.poison',pig.id,99).errorCode,'DuplicateSkill');
  assert.equal(game.inventory.cardCount('skill.poison'),1);
});

test('v0.7: replacing full skill bar needs valid slot, can skip without replacing', async () => {
  const {game}=await fresh();
  const pig=game.inventory.pigs[0];
  pig.skills=['skill.sloth','skill.wrath','skill.pride','skill.envy','skill.burn','skill.paralyze'];
  const inv=new InventoryService(game);
  const first=inv.levelUp(pig.id,2);
  assert.equal(first.pendingInput.type,'ChooseLearnReplacement');
  assert.equal(first.pendingInput.skillId,'skill.poison');
  assert.equal(inv.resolveLearnedSkill(7).errorCode,'InvalidSlot');
  assert.equal(inv.resolveLearnedSkill(0).ok,true);
  assert.equal(pig.skills.length,6);
  assert.equal(pig.skills[0],'skill.poison');
  assert.equal(inv.levelUp(pig.id,3).pendingInput.type,'ChooseLearnReplacement');
  assert.equal(inv.resolveLearnedSkill(null,true).ok,true);
  assert(!pig.skills.includes('skill.buff'));
  assert.equal(inv.resolveLearnedSkill().errorCode,'NoPendingLearn');
});

test('v0.7: upgrade autofills, card filling and replacement enforce cap six', async () => {
  const {game}=await fresh();const pig=game.inventory.pigs[0];
  assert.equal(game.levelUp(pig.id,2).ok,true);
  assert(pig.skills.includes('skill.poison'));
  assert.equal(game.levelUp(pig.id,3).ok,true);
  assert(pig.skills.includes('skill.buff'));
  game.inventory.addCard('skill.freeze');
  assert.equal(game.useSkillCard('skill.freeze',pig.id).ok,true);
  pig.skills.push('skill.paralyze');
  game.inventory.addCard('skill.confuse');
  assert.equal(game.useSkillCard('skill.confuse',pig.id).errorCode,'SkillSlotsFull');
  assert.equal(game.inventory.cardCount('skill.confuse'),1);
  assert.equal(game.useSkillCard('skill.confuse',pig.id,0).ok,true);
  assert.equal(pig.skills.length,6);
});

test('v0.7: restart session clears battle/cards and restores initial roster', async () => {
  const {game}=await fresh(); const originalIds=game.inventory.pigs.map(x=>x.id);
  game.inventory.addCard('skill.poison');
  game.startBattle(originalIds,foes);
  game.reset();
  assert.equal(game.battle,null);
  assert.equal(game.inventory.cardCount('skill.poison'),0);
  assert.deepEqual(game.inventory.pigs.map(x=>x.id),originalIds);
  assert.equal(game.inventory.pigs.length,4);
});

test('v0.8: BattlePresenter FakeView hides unknown resistances and blocks double click', async () => {
  const {game}=await fresh();game.startBattle(game.inventory.pigs.map(p=>p.id),foes);
  const service=new BattleService(game),log=[];
  let release; const deferred=new Promise(resolve=>release=resolve);
  const view={
    bind(h){this.h=h;log.push('bind');},unbind(){this.h=null;log.push('unbind');},
    render(vm){this.vm=vm;log.push('render');},showPendingInput(p){log.push(`input:${p?.type}`);},
    async playEvents(ev){log.push(`events:${ev.length}`); await deferred;},showError(e){log.push(`error:${e}`);}
  };
  const presenter=new BattlePresenter(view,service);presenter.initialize();
  assert.equal(view.vm.knownResistances,undefined);
  assert.equal(view.vm.teams.enemy[0].resistances,undefined);
  game.battle.state.knownResistances.enemy[game.battle.state.active.player] = { wrath: 'weak' };
  assert.deepEqual(mapBattleSnapshot(game.battle.getSnapshot()).teams.player[0].discoveredResistances,{});
  const initialRevision=game.battle.state.revision;
  const pending=view.h.onCommand({type:'guard',expectedRevision:initialRevision});
  assert.equal((await view.h.onCommand({type:'guard'})).errorCode,'PresentationBusy');
  assert.equal(game.battle.state.revision,initialRevision+1);
  release(); await pending;
  presenter.dispose();
  assert.equal(view.h,null);
  presenter.initialize();presenter.dispose();
  assert.deepEqual(log.filter(x=>x==='bind').length,2);
  assert.deepEqual(log.filter(x=>x==='unbind').length,2);
});

test('v0.8: fake menu, inventory and reward presenters bind and unsubscribe', async () => {
  const game=await winningSession();
  function fake(){return {bind(h){this.handlers=h;},unbind(){this.handlers=null;},render(vm){this.vm=vm;},showError(e){this.error=e;}};}
  const rewardView=fake(), rp=new RewardPresenter(rewardView,new RewardService(game));
  rp.initialize(); assert.equal(rewardView.vm.won,true);
  assert.equal(rewardView.handlers.onDecline().ok,true); rp.dispose(); assert.equal(rewardView.handlers,null);
  const inventoryView=fake(),ip=new InventoryPresenter(inventoryView,new InventoryService(game));
  ip.initialize(); assert.equal(inventoryView.vm.pigs.length,4); ip.dispose();
  const menuView=fake(),mp=new MainMenuPresenter(menuView,new MainMenuService(game));
  mp.initialize(); assert.equal(menuView.handlers.onReset().ok,true); mp.dispose();
  assert.equal(game.inventory.pigs.length,4);
});

test('v0.9: seeded winning and losing headless games, structured events monotone', async () => {
  const win=await runHeadlessGame(1);
  const loss=await runHeadlessGame(20261008);
  assert.equal(win.snapshot.outcome,'player');assert.equal(loss.snapshot.outcome,'enemy');
  assert(win.steps<2000 && loss.steps<2000);
  for (const game of [win,loss]) {
    assert.equal(game.snapshot.phase,'finished');
    assert(game.events.some(e=>e.kind==='BattleFinished'));
    for(let i=1;i<game.events.length;i++) assert(game.events[i].seq>game.events[i-1].seq);
  }
  assert.equal(win.reward.won,true);assert.equal(loss.reward.won,false);
  assert.equal(win.session.inventory.skillCards.size,1);
  assert.equal(loss.session.inventory.skillCards.size,0);
});

test('v0.9: repeat identical seeds and commands yields matching terminal states/events', async () => {
  for(const seed of [1,6,20261008]){
    const a=await runHeadlessGame(seed),b=await runHeadlessGame(seed),c=await runHeadlessGame(seed);
    assert.deepEqual(a.snapshot,b.snapshot); assert.deepEqual(b.snapshot,c.snapshot);
    assert.deepEqual(a.events,b.events); assert.deepEqual(b.events,c.events);
  }
});

test('config contract validates passives and rewards instead of guessing v1.3 values', async () => {
  const cfg=await loadFixture();
  assert(cfg.passive('passive.soft_fermentation'));
  const source=JSON.parse(await readFile(new URL('../config/demo.fixture.json', import.meta.url), 'utf8'));
  source.passives[0].interval=0;
  assert.throws(()=>new ConfigCatalog(source), /Invalid passive/);
});


test('v0.9: one headless victory continues through card award, recruitment, inventory and reset', async () => {
  const run=await runHeadlessGame(1);
  const session=run.session;
  assert.equal(run.snapshot.outcome,'player');
  const candidate=run.reward.candidates[0];
  const beforeCount=session.inventory.pigs.length;
  const cardId=[...session.inventory.skillCards.keys()][0];
  assert.equal(session.resolveRecruit(candidate.id).ok,true);
  assert.equal(session.inventory.pigs.length,beforeCount+1);
  assert.equal(session.inventory.get(candidate.id).hp, session.inventory.get(candidate.id).maxHp);
  const pig=session.inventory.pigs[0];
  assert.equal(session.useSkillCard(cardId,pig.id).ok,true);
  assert.equal(session.inventory.cardCount(cardId),0);
  assert(session.inventorySnapshot().pigs.some(p=>p.id===candidate.id));
  session.reset();
  assert.equal(session.inventory.pigs.length,4);
  assert.equal(session.inventory.skillCards.size,0);
  assert.equal(session.getRewardSnapshot(),null);
  assert.equal(session.battle,null);
});
