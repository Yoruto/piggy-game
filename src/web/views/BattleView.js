import { pigSprite, typeBadge, bar, statusChips, skillName, TYPES, RESIST, escapeHtml, errorText } from '../assets/visuals.js';
const TYPES_ORDER=['pride','envy','wrath','sloth','greed','gluttony','lust'];
function lookupPig(vm,id){return [...(vm?.teams.player||[]),...(vm?.teams.enemy||[])].find(p=>p.id===id);}
const plural=n=>String(n).padStart(2,'0');
export class BattleView {
  constructor(root,config,app){
    this.root=root;this.config=config;this.app=app;this.model=null;this.pending=null;
    this.log=[{seq:-1,kind:'Start',message:'训练师，准备迎接这场挑战吧！'}];
    this.modal=null;this.busy=false;this.handlers=null;this.listener=this.onClick.bind(this);
    this.cancelled=false;
  }
  bind(handlers){this.handlers=handlers;this.root.addEventListener('click',this.listener);this.cancelled=false;}
  unbind(){this.root.removeEventListener('click',this.listener);this.handlers=null;this.cancelled=true;}
  dispose(){this.unbind();}
  render(vm){
    if(!vm)return;
    this.model=vm;
    const own=lookupPig(vm,vm.active.player),foe=lookupPig(vm,vm.active.enemy);
    const ownAlive=vm.teams.player.filter(p=>p.hp>0).length,enemyAlive=vm.teams.enemy.filter(p=>p.hp>0).length;
    const phase=vm.phase==='more'?'1 MORE':vm.phase==='pass-action'?'BATON ACTION':vm.phase==='forced-switch'?'FORCED SWITCH':'BATTLE';
    this.root.innerHTML=`<div class="page-shell battle-shell ${this.busy?'battle-busy':''}">
      <header class="topbar"><div class="brand"><span class="brand-mark">✿</span> PIGGY <b>QUEST</b></div>
        <div class="header-actions"><span class="battle-round">第 ${plural(vm.round)} 回合 <span>·</span> ${phase}</span><button class="pill-link" data-action="home">← 返回营地</button></div>
      </header>
      <main class="battle-layout">
        <div class="battle-main">
          <div class="battle-stage" role="region" aria-label="当前战斗场景">
            <div class="stage-pattern"></div><div class="stage-cloud stage-cloud-1"></div><div class="stage-cloud stage-cloud-2"></div>
            <div class="stage-hill-back"></div><div class="stage-hill-front"></div>
            <div class="arena-stage-label"><span class="pulse-dot"></span> 翡翠草原 · 训练战</div>
            <div class="combatant enemy-combatant"><div class="combatant-info enemy-info">${this.pigInfo(foe,'enemy',enemyAlive,3)}</div><div class="enemy-plate"></div><div class="enemy-sprite sprite-id-${foe?.id}">${pigSprite(foe?.type,{fainted:foe?.hp<=0})}</div></div>
            <div class="combatant player-combatant"><div class="player-plate"></div><div class="player-sprite sprite-id-${own?.id}">${pigSprite(own?.type,{back:true,fainted:own?.hp<=0})}</div><div class="combatant-info player-info">${this.pigInfo(own,'player',ownAlive,4)}</div></div>
            <div class="field-label">✦ ${vm.phase==='more'?'弱点命中！再次行动！':vm.phase==='forced-switch'?'伙伴倒下，换一只上场！':'找出对手的弱点！'}</div>
          </div>
          <div class="command-board">
            <div class="command-head"><div><span class="mini-overline">YOUR TURN</span><h2>${this.commandTitle()}</h2></div><span class="command-hint">${this.commandHint()}</span></div>
            <div id="battle-controls"></div>
          </div>
        </div>
        <aside class="battle-sidebar">
          <section class="side-card"><div class="side-card-head"><span class="overline-label">PARTY STATUS</span><strong>己方队伍 <span>${ownAlive}/4</span></strong></div>
            <div class="bench-list">${vm.teams.player.map(p=>`<div class="bench-pig ${p.id===own?.id?'selected':''} ${p.hp<=0?'fainted':''}"><div class="bench-icon">${pigSprite(p.type,{small:true,fainted:p.hp<=0})}</div><div><b>${escapeHtml(p.name)}</b><span>Lv.${p.level} · ${TYPES[p.type]?.name}</span></div><div class="bench-health"><div class="bench-bar"><div style="width:${Math.max(0,Math.round(p.hp/Math.max(1,p.maxHp)*100))}%"></div></div><small>${Math.ceil(p.hp)}/${p.maxHp}</small></div></div>`).join('')}</div>
          </section>
          <section class="side-card log-card"><div class="side-card-head"><span class="overline-label">BATTLE LOG</span><strong>战斗记录 <span class="log-live">● LIVE</span></strong></div><div id="battle-log" class="log-list" aria-live="polite">${this.logMarkup()}</div></section>
          <div class="sidebar-note"><span>★</span> 把握弱点，获得额外行动 <b>1 MORE</b></div>
        </aside>
      </main>
      <div id="battle-modal"></div>
      <div class="fixture-warning">⚑ 当前为测试数值 · 尚非战斗系统 v1.3 正式平衡</div>
    </div>`;
    this.renderControls();this.renderModal();
  }
  pigInfo(pig,side,alive,total){
    if(!pig)return '';
    const resist=side==='enemy'?`<div class="resistance-line"><span>已发现抗性</span><div class="resistance-slots">${TYPES_ORDER.map(type=>{const r=pig.discoveredResistances?.[type];return `<span class="res-slot ${r?'known':''} ${r==='weak'?'weak':''}" title="${TYPES[type].name}：${r?RESIST[r]:'?'}">${r?RESIST[r]:'?'}</span>`}).join('')}</div></div>`:'';
    return `<div class="unit-panel ${side}"><div class="unit-name-row"><div><div class="unit-subtitle">${side==='enemy'?'WILD CHALLENGER':'YOUR PARTNER'} · ${alive}/${total}</div><div class="unit-name">${escapeHtml(pig.name)} <span class="unit-level">Lv. ${pig.level}</span></div></div>${typeBadge(pig.type)}</div>
      ${bar('HP',pig.hp,pig.maxHp)}${bar('SP',pig.sp,pig.maxSp,'sp')}
      <div class="status-row">${statusChips(pig)}</div>${resist}</div>`;
  }
  commandTitle(){
    if(this.model?.phase==='finished')return '战斗结束！';
    if(this.pending?.type==='ChooseForcedSwitch')return '选择新的出战伙伴！';
    if(this.pending?.side==='enemy')return '对手正在思考……';
    if(this.pending?.type==='ChooseMoreAction')return '漂亮！还能再行动一次！';
    if(this.pending?.type==='ChooseBatonAction')return '接棒成功，趁势追击！';
    return '接下来要做什么？';
  }
  commandHint(){return this.pending?.type==='ChooseForcedSwitch'?'换人不消耗行动':this.model?.phase==='more'?'EXTRA TURN ACTIVE':'技能消耗 SP · 留意属性克制';}
  renderControls(){
    const el=this.root.querySelector('#battle-controls');if(!el||!this.model)return;
    const p=this.pending,vm=this.model;
    if(vm.phase==='finished'){el.innerHTML='<div class="command-placeholder">挑战结束，正在整理战斗记录…</div>';return;}
    if(p?.type==='ChooseForcedSwitch'){el.innerHTML='<div class="command-placeholder">请从后备队伍选择一只健康的猪猪上场。<button class="btn btn-primary" data-action="switch-panel">选择替换伙伴 →</button></div>';return;}
    if(!p || p.side!=='player'){el.innerHTML='<div class="command-placeholder"><span class="loading-dots">● ● ●</span> 对手正在行动…</div>';return;}
    const pig=lookupPig(vm,vm.active.player);
    const moves=Array.from({length:6},(_,i)=>{
      const id=pig.skills[i];if(!id)return `<div class="move-card move-empty"><span>＋</span><small>空技能位</small></div>`;
      const cfg=this.config.skill(id);const disabled=pig.sp<cfg.spCost;
      return `<button data-action="skill" data-skill="${escapeHtml(id)}" class="move-card move-${cfg.type}" ${disabled?'disabled':''} aria-label="${skillName(id,this.config)}，消耗 ${cfg.spCost} SP">
        <span class="move-top"><span class="move-icon">${TYPES[cfg.type]?.icon}</span><span class="move-cost">${cfg.spCost} SP</span></span>
        <b>${escapeHtml(skillName(id,this.config))}</b><span class="move-bottom"><span>${TYPES[cfg.type]?.name}系</span><span>威力 ${cfg.power}</span></span>
      </button>`;
    }).join('');
    el.innerHTML=`<div class="move-grid">${moves}</div><div class="secondary-commands">
      <button class="secondary-command" data-action="guard"><span class="command-icon">⬡</span><span><strong>防御</strong><small>防守并回复 10 SP</small></span><span class="command-chevron">→</span></button>
      ${vm.phase==='action'?'<button class="secondary-command" data-action="switch-panel"><span class="command-icon">⇆</span><span><strong>更换伙伴</strong><small>切换上场猪猪</small></span><span class="command-chevron">→</span></button>':''}
      ${vm.phase==='more'?'<button class="secondary-command pass-command" data-action="baton-panel"><span class="command-icon">✧</span><span><strong>Baton Pass</strong><small>交棒并获得伤害加成</small></span><span class="command-chevron">→</span></button>':''}
    </div>`;
  }
  showPendingInput(p){
    this.pending=p;
    if(p?.type==='ChooseForcedSwitch')this.modal='forced-switch';
    else if(this.modal==='forced-switch')this.modal=null;
    this.renderControls();this.renderModal();
    const head=this.root.querySelector('.command-head h2');if(head)head.textContent=this.commandTitle();
  }
  renderModal(){
    const host=this.root.querySelector('#battle-modal');if(!host)return;
    if(!this.modal){host.innerHTML='';return;}
    const forced=this.modal==='forced-switch';const baton=this.modal==='baton-pass';const team=this.model.teams.player;
    const current=this.model.active.player;
    host.innerHTML=`<div class="modal-backdrop"><div class="modal-window" role="dialog" aria-modal="true" aria-label="选择猪猪伙伴">
      <div class="modal-head"><div><span class="mini-overline">TEAM SELECT</span><h2>${forced?'哪位伙伴接着上场？':baton?'将力量传递给谁？':'选择交换的伙伴'}</h2></div>${!forced?'<button class="icon-button" data-action="close-modal" aria-label="关闭">✕</button>':''}</div>
      <p class="modal-lede">${forced?'当前猪猪倒下了！选择一位还有 HP 的伙伴免费替换。':baton?'Baton Pass 只能在 1 More 时使用；接棒者本次行动获得伤害加成。':'普通换人将消耗本次行动。'}</p>
      <div class="switch-grid">${team.map(p=>{
        const disabled=p.id===current||p.hp<=0;
        return `<button class="switch-option ${disabled?'unavailable':''}" data-action="choose-switch" data-id="${escapeHtml(p.id)}" ${disabled?'disabled':''}><span class="switch-art">${pigSprite(p.type,{small:true})}</span><span class="switch-meta"><strong>${escapeHtml(p.name)}</strong><span>Lv.${p.level} · ${TYPES[p.type]?.name}</span><span class="switch-hp">HP ${Math.ceil(p.hp)}/${p.maxHp} · SP ${Math.ceil(p.sp)}/${p.maxSp}</span></span><span class="switch-arrow">${p.id===current?'场上':p.hp<=0?'倒下':'↗'}</span></button>`;
      }).join('')}</div>${forced?'':'<button class="btn btn-cream modal-cancel" data-action="close-modal">返回技能选择</button>'}
    </div></div>`;
  }
  logMarkup(){return this.log.slice(-10).reverse().map(e=>`<div class="log-entry ${e.kind==='RoundStarted'?'log-round':''}"><span class="log-bullet">${e.kind==='RoundStarted'?'◇':'✧'}</span><span>${escapeHtml(e.message)}</span></div>`).join('');}
  eventMessage(e){
    const name=id=>lookupPig(this.model,id)?.name||'猪猪';
    switch(e.kind){
      case 'RoundStarted':return `第 ${e.round} 回合开始！`;
      case 'SkillUsed':return `${name(e.actorId)} 使用了「${skillName(e.skillId,this.config)}」！`;
      case 'DamageApplied':return `${name(e.targetId)} 受到了 ${e.amount} 点伤害。`;
      case 'Reflected':return `被反弹了！${name(e.targetId)} 受到了 ${e.amount} 点伤害！`;
      case 'WeaknessHit':return '效果绝佳！命中了弱点！';
      case 'CriticalHit':return '会心一击！';
      case 'DownApplied':return `${name(e.targetId)} 倒地了！`;
      case 'DownSkipped':return `${name(e.actorId)} 因 Down 无法行动。`;
      case 'OneMoreGranted':return `太棒了！${name(e.actorId)} 获得 1 MORE！`;
      case 'Guarded':return `${name(e.actorId)} 摆好了防御架势，并恢复了 SP。`;
      case 'PigSwitched':return `轮到 ${name(e.to)} 上场啦！`;
      case 'BatonPassed':return `Baton Pass！接棒者本次行动 ×${e.multiplier}！`;
      case 'BatonBonusEnded':return '接棒伤害加成结束。';
      case 'StatusApplied':return `${name(e.actorId)} 陷入了异常状态！`;
      case 'StatusCleared':return `${name(e.actorId)} 的异常状态消除了。`;
      case 'StatusDamage':return `${name(e.actorId)} 受到 ${e.amount} 点异常伤害。`;
      case 'StatusSkipped':return `${name(e.actorId)} 因异常状态无法行动。`;
      case 'StatStageChanged':return `${name(e.actorId)} 的能力等级发生了变化！`;
      case 'PassiveHealed':return `${name(e.actorId)} 的被动技能恢复了 ${e.amount} HP。`;
      case 'SpRecovered':return `${name(e.actorId)} 恢复了 ${e.amount} SP。`;
      case 'ResistancesRerolled':return '猪猪的抗性重新变化了！';
      case 'ResistanceKnowledgeCleared':return '需要重新探索对手的抗性了！';
      case 'PigFainted':return `${name(e.pigId)} 失去战斗能力。`;
      case 'BattleFinished':return e.winner==='player'?'挑战成功！你赢得了胜利！':'挑战结束，下次再加油！';
      default:return null;
    }
  }
  async playEvents(events){
    this.busy=true;
    this.root.querySelector('.battle-shell')?.classList.add('battle-busy');
    for(const e of events??[]){
      if(this.cancelled)return;
      const message=this.eventMessage(e);
      if(message){this.log.push({seq:e.seq,kind:e.kind,message});const el=this.root.querySelector('#battle-log');if(el)el.innerHTML=this.logMarkup();}
      if(['DamageApplied','Reflected','CriticalHit','WeaknessHit'].includes(e.kind)){
        const target=e.targetId;const element=target?this.root.querySelector(`.sprite-id-${target}`):null;
        element?.classList.remove('impact');void element?.offsetWidth;element?.classList.add('impact');
      }
      if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches) await new Promise(resolve=>setTimeout(resolve,75));
    }
    this.busy=false;
    this.root.querySelector('.battle-shell')?.classList.remove('battle-busy');
  }
  showError(code){this.app.onToast(errorText(code));}
  async perform(command){
    if(this.busy||!this.handlers||!this.model)return;
    this.busy=true;
    const full={...command,actorId:this.pending?.actorId,expectedRevision:this.model.revision};
    try {
      const result=await this.handlers.onCommand(full);
      if(result?.ok){this.modal=null;this.renderModal();if(result.snapshot?.phase==='finished'&&!this.cancelled)this.app.onFinished();}
    } catch(error){this.app.onToast(`战斗操作失败：${error.message}`);console.error(error);}
    finally{this.busy=false;this.root.querySelector('.battle-shell')?.classList.remove('battle-busy');}
  }
  onClick(e){
    const btn=e.target.closest('[data-action]');if(!btn||!this.root.contains(btn))return;
    const action=btn.dataset.action;
    if(action==='home'){this.app.onLeave();return;}
    if(this.busy)return;
    if(action==='close-modal'&&this.modal!=='forced-switch'){this.modal=null;this.renderModal();return;}
    if(action==='switch-panel'||action==='baton-panel'){
      this.modal=action==='baton-panel'?'baton-pass':this.pending?.type==='ChooseForcedSwitch'?'forced-switch':'switch';this.renderModal();return;
    }
    if(action==='choose-switch'){
      const type=this.modal==='forced-switch'?'forced-switch':this.modal==='baton-pass'?'baton-pass':'switch';
      this.perform({type,pigId:btn.dataset.id});return;
    }
    if(this.modal)return;
    if(action==='skill')this.perform({type:'skill',skillId:btn.dataset.skill});
    if(action==='guard')this.perform({type:'guard'});
  }
}
