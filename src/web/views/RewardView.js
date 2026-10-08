import { pigSprite, typeBadge, TYPES, RESIST, skillName, escapeHtml, errorText } from '../assets/visuals.js';
export class RewardView {
  constructor(root,config,app){this.root=root;this.config=config;this.app=app;this.handlers=null;this.model=null;this.selected=null;this.listener=this.onClick.bind(this);}
  bind(h){this.handlers=h;this.root.addEventListener('click',this.listener);}
  unbind(){this.root.removeEventListener('click',this.listener);this.handlers=null;}
  dispose(){this.unbind();}
  render(vm){
    this.model=vm;
    if(!vm)return;
    if(!vm.candidates.some(p=>p.id===this.selected))this.selected=vm.candidates[0]?.id||null;
    const won=vm.won;
    const candidate=vm.candidates.find(p=>p.id===this.selected);
    const cards=Object.entries(this.app.getCards()).filter(([,n])=>n>0);
    this.root.innerHTML=`<div class="page-shell result-shell"><header class="topbar"><div class="brand"><span class="brand-mark">✿</span> PIGGY <b>QUEST</b></div><span class="edition">BATTLE RESULTS</span></header>
      <main class="result-content"><div class="result-banner ${won?'won':'lost'}"><div class="confetti confetti-a">✦</div><div class="confetti confetti-b">✧</div><div class="confetti confetti-c">✦</div>
        <div class="result-overline">${won?'CHALLENGE COMPLETE':'TRY AGAIN NEXT TIME'}</div><h1>${won?'挑战成功！':'挑战结束'}</h1><p>${won?'干得漂亮！你和猪猪伙伴们配合得天衣无缝。':'冒险总有波折。整理心情，和伙伴们再次出发吧！'}</p>
        <div class="result-icon">${pigSprite(won?'pride':'sloth')}</div></div>
        ${won?`<div class="reward-panels"><section class="reward-card"><div class="section-card-header"><strong>战斗奖励</strong><span>REWARD</span></div><div class="reward-found"><span class="reward-bag-icon">✦</span><div><b>技能卡奖励</b><p>${cards.length?cards.map(([id,n])=>`${escapeHtml(skillName(id,this.config))} ×${n}`).join(' · '):'已结算'}</p></div></div></section>
          <section class="reward-card capture-card"><div class="section-card-header"><strong>收编伙伴</strong><span>${vm.resolved?'已完成':'CHOOSE ONE'}</span></div>
            ${vm.resolved?'<p class="reward-message">本次收编已处理完毕。继续你的冒险吧！</p>':`<p class="capture-description">对手们认可了你的实力！你可以选择一位加入背包，或者放弃。</p><div class="candidate-grid">${vm.candidates.map(p=>`<button class="candidate-pig ${this.selected===p.id?'selected':''}" data-action="candidate" data-id="${escapeHtml(p.id)}"><div class="candidate-art">${pigSprite(p.type,{small:true})}</div><b>${escapeHtml(p.name)}</b><span>Lv.${p.level} · ${TYPES[p.type]?.name}</span></button>`).join('')}</div>
              ${candidate?`<div class="candidate-detail"><div><b>${escapeHtml(candidate.name)}</b>${typeBadge(candidate.type)}</div><p>技能：${candidate.skills.map(id=>escapeHtml(skillName(id,this.config))).join(' / ')}</p><p>抗性：${Object.keys(candidate.resistances).length?Object.entries(candidate.resistances).map(([type,r])=>`${TYPES[type]?.name} ${RESIST[r]||r}`).join('、'):'待发现'}</p></div>`:''}
              ${vm.inventoryFull?'<div class="alert-inline">⚠ 背包已满，无法收编。可以选择放弃。</div>':''}
              <div class="reward-actions"><button class="btn btn-primary" data-action="recruit" ${vm.inventoryFull?'disabled':''}>♥ 收编这只猪猪</button><button class="btn btn-cream" data-action="decline">放弃收编</button></div>`}</section></div>`:''}
        <div class="result-footer"><button class="btn btn-primary btn-big" data-action="home">⌂ 返回营地 →</button><button class="btn btn-cream btn-big" data-action="inventory">▦ 查看背包</button></div>
      </main><div class="fixture-warning">⚑ 本次挑战运行于工程测试数值配置</div></div>`;
  }
  onClick(e){
    const btn=e.target.closest('[data-action]');if(!btn||!this.root.contains(btn))return;
    const action=btn.dataset.action;
    if(action==='candidate'){this.selected=btn.dataset.id;this.render(this.model);return;}
    if(action==='home'){
      if(this.model.won&&!this.model.resolved){this.app.onToast('请先收编或放弃本次奖励');return;}
      this.app.onBack();return;
    }
    if(action==='inventory'){
      if(this.model.won&&!this.model.resolved){this.app.onToast('请先收编或放弃本次奖励');return;}
      this.app.onInventory();return;
    }
    if(action==='recruit'||action==='decline'){
      const r=action==='recruit'?this.handlers.onRecruit(this.selected):this.handlers.onDecline();
      if(!r?.ok){this.app.onToast(errorText(r?.errorCode||'Unknown'));return;}
      this.app.onToast(action==='recruit'?'新伙伴加入背包！':'已放弃本次收编机会。');
    }
  }
}
