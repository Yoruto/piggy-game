import { GameSession } from '../application/GameSession.js';
import { MainMenuService } from '../application/MainMenuService.js';
import { BattleService } from '../application/BattleService.js';
import { InventoryService } from '../application/InventoryService.js';
import { RewardService } from '../application/RewardService.js';
import { BattlePresenter } from '../presentation/BattlePresenter.js';
import { MainMenuPresenter, InventoryPresenter, RewardPresenter } from '../presentation/ScreenPresenters.js';
import { BrowserBattlePort } from './BrowserBattlePort.js';
import { MenuView } from './views/MenuView.js';
import { BattleView } from './views/BattleView.js';
import { InventoryView } from './views/InventoryView.js';
import { RewardView } from './views/RewardView.js';

const STARTERS=['pig.bread','pig.pride','pig.envy','pig.wrath'];
const FOES=['pig.wrath','pig.pride','pig.envy'];

/** A tiny composition root + router, leaving combat and collection mutations to Application. */
export class WebApp {
  constructor(root,config,seed=20261008){
    this.root=root;this.config=config;this.seed=seed;this.current=null;
    this.session=new GameSession(config,seed);
    this.session.addStarter(STARTERS);
    this.roster=this.session.inventory.pigs.slice(0,4).map(p=>p.id);
    this.toastTimeout=null;
  }
  mount(){this.showMenu();}
  getTeam(){ return this.roster.map(id=>this.session.inventory.get(id)).filter(Boolean); }
  toggleTeam(id){
    const pig=this.session.inventory.get(id);
    if(!pig || !pig.alive) return this.toast('倒下的猪猪不能加入出战队伍');
    if(this.roster.includes(id)) this.roster=this.roster.filter(x=>x!==id);
    else if(this.roster.length<4) this.roster.push(id);
    else return this.toast('出战队伍最多 4 只，请先撤下一只');
    return true;
  }
  toast(message){
    const element=document.getElementById('toast');
    if(!element) return;
    element.textContent=message;element.classList.add('visible');
    clearTimeout(this.toastTimeout);
    this.toastTimeout=setTimeout(()=>element.classList.remove('visible'),2900);
  }
  #leave(){
    this.current?.presenter?.dispose();
    this.current?.view?.dispose?.();
    this.current=null;
    this.root.innerHTML='';
    window.scrollTo?.({top:0,behavior:'instant'});
  }
  #set(view,presenter,screen){
    this.current={view,presenter,screen};
    presenter.initialize();
  }
  showMenu(){
    this.#leave();
    const view=new MenuView(this.root,this.config,{
      getTeam:()=>this.getTeam(),
      getBattleStatus:()=>this.session.battle?.state.phase,
      getBagCount:()=>this.session.inventory.pigs.length,
      onInventory:()=>this.showInventory(),
      onStarted:()=>this.showBattle(),
      onReset:()=>{this.roster=this.session.inventory.pigs.slice(0,4).map(p=>p.id);this.toast('冒险记录已重置（仅内存）');},
      onResume:()=>this.showBattle()
    });
    this.#set(view,new MainMenuPresenter(view,new MainMenuService(this.session)),'menu');
  }
  startBattle(){
    if(this.session.battle?.state.phase && this.session.battle.state.phase!=='finished') return this.showBattle();
    if(this.roster.length!==4){this.toast('请先在背包选满 4 只出战猪猪');return;}
    const result=new MainMenuService(this.session).startBattle([...this.roster],FOES);
    if(!result.ok){this.toast(result.errorCode);return;}
    this.showBattle();
  }
  showBattle(){
    if(!this.session.battle) return this.showMenu();
    if(this.session.battle.state.phase==='finished') return this.showReward();
    this.#leave();
    const port=new BrowserBattlePort(new BattleService(this.session));
    const openingEvents=port.advanceOpening();
    const view=new BattleView(this.root,this.config,{
      getTeam:()=>this.getTeam(),
      onLeave:()=>this.showMenu(),
      onFinished:()=>this.showReward(),
      onToast:message=>this.toast(message)
    });
    this.#set(view,new BattlePresenter(view,port),'battle');
    if(openingEvents.length) view.playEvents(openingEvents);
  }
  showInventory(){
    this.#leave();
    const view=new InventoryView(this.root,this.config,{
      getRoster:()=>[...this.roster],
      onToggleRoster:id=>this.toggleTeam(id),
      onBack:()=>this.showMenu(),
      onToast:message=>this.toast(message)
    });
    this.#set(view,new InventoryPresenter(view,new InventoryService(this.session)),'inventory');
  }
  showReward(){
    this.session.finalizeBattle();
    this.#leave();
    const view=new RewardView(this.root,this.config,{
      getCards:()=>this.session.inventorySnapshot().skillCards,
      onBack:()=>this.showMenu(),
      onInventory:()=>this.showInventory(),
      onToast:message=>this.toast(message)
    });
    this.#set(view,new RewardPresenter(view,new RewardService(this.session)),'reward');
  }
}
