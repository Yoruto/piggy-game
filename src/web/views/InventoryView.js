import { pigSprite, TYPES, typeBadge, bar, statusChips, skillName, escapeHtml, errorText } from '../assets/visuals.js';
export class InventoryView {
  constructor(root,config,app){this.root=root;this.config=config;this.app=app;this.handlers=null;this.model=null;this.selectedId=null;this.selectedCard=null;this.slotMode=false;this.listener=this.onClick.bind(this);this.modal=null;}
  bind(h){this.handlers=h;this.root.addEventListener('click',this.listener);}
  unbind(){this.root.removeEventListener('click',this.listener);this.handlers=null;}
  dispose(){this.unbind();}
  render(snapshot){
    this.model=snapshot;
    if(!snapshot.pigs.some(p=>p.id===this.selectedId))this.selectedId=snapshot.pigs[0]?.id||null;
    const pig=snapshot.pigs.find(p=>p.id===this.selectedId);
    const roster=this.app.getRoster();
    const cards=Object.entries(snapshot.skillCards||{}).filter(([,count])=>count>0);
    this.root.innerHTML=`<div class="page-shell inventory-shell">
      <header class="topbar"><div class="brand"><span class="brand-mark">✿</span> PIGGY <b>QUEST</b></div><div class="header-actions"><span class="top-pill">▦ PARTNER BOX</span><button class="pill-link" data-action="back">← 返回营地</button></div></header>
      <main class="inventory-content">
        <div class="inventory-heading"><div><div class="eyebrow"><span class="eyebrow-dot"></span> ADVENTURE SUPPLIES</div><h1>猪猪<span>背包</span><small> / PARTNER BOX</small></h1><p>每一位伙伴都有自己的特长。挑选四只猪猪，准备下一场冒险吧！</p></div><div class="capacity-token"><span>已收集</span><strong>${snapshot.pigs.length} <em>/ ${snapshot.capacity}</em></strong><div class="capacity-pips">${Array.from({length:snapshot.capacity},(_,i)=>`<i class="${i<snapshot.pigs.length?'filled':''}"></i>`).join('')}</div></div></div>
        <div class="inventory-layout">
          <section class="inventory-list-card"><div class="section-card-header"><strong>伙伴列表</strong><span>${snapshot.pigs.length} 位</span></div>
            <div class="roster-scroll">${snapshot.pigs.map((p,i)=>`<button class="roster-row ${p.id===this.selectedId?'active':''} ${p.hp<=0?'fainted':''}" data-action="select-pig" data-id="${escapeHtml(p.id)}"><span class="roster-num">${String(i+1).padStart(2,'0')}</span><span class="roster-avatar avatar-${p.type}">${pigSprite(p.type,{small:true})}</span><span class="roster-identity"><b>${escapeHtml(p.name)}</b><span>Lv.${p.level} / ${TYPES[p.type]?.name}</span></span><span class="roster-check ${roster.includes(p.id)?'is-on':''}" title="${roster.includes(p.id)?'出战队员':'后备'}">${roster.includes(p.id)?'✓':'+'}</span></button>`).join('')}${Array.from({length:Math.max(0,snapshot.capacity-snapshot.pigs.length)},(_,i)=>`<div class="roster-row roster-empty"><span class="roster-num">${String(snapshot.pigs.length+i+1).padStart(2,'0')}</span><span class="empty-icon">＋</span><span>等待新伙伴</span></div>`).join('')}</div>
            <div class="roster-footer"><span>✦ 出战队伍</span><strong>${roster.length} / 4</strong></div>
          </section>
          <section class="inventory-detail-card">${pig?this.pigDetails(pig,roster):'<p>还没有猪猪伙伴。</p>'}</section>
        </div>
        <section class="party-config"><div class="section-heading"><div><div class="mini-overline">BATTLE PARTY</div><h2>出战阵容 <span>· 按顺序排列</span></h2></div><span class="muted">第一只猪猪将在战斗开始时上场</span></div>
          <div class="party-slots">${Array.from({length:4},(_,i)=>{
            const found=snapshot.pigs.find(p=>p.id===roster[i]);
            return found?`<button class="party-slot" data-action="select-pig" data-id="${found.id}"><span class="party-rank">0${i+1}</span><div class="party-slot-art">${pigSprite(found.type,{small:true})}</div><strong>${escapeHtml(found.name)}</strong><small>${TYPES[found.type]?.name} · Lv.${found.level}</small></button>`:`<div class="party-slot party-vacant"><span class="party-rank">0${i+1}</span><span class="vacant-mark">＋</span><strong>待选择</strong><small>从伙伴列表添加</small></div>`;
          }).join('')}</div></section>
        <section class="card-pocket"><div class="section-heading"><div><div class="mini-overline">SKILL CARD POUCH</div><h2>技能卡 <span>· ${cards.reduce((sum,[,n])=>sum+n,0)} 张</span></h2></div><small class="muted">选择猪猪后，使用技能卡填入或替换技能位</small></div>
          <div class="card-pocket-grid">${cards.length?cards.map(([id,count])=>{const sk=this.config.skill(id);return `<button class="skill-card-pocket ${this.selectedCard===id?'active':''}" data-action="card" data-card="${escapeHtml(id)}"><span class="pocket-emblem">${TYPES[sk.type]?.icon}</span><strong>${escapeHtml(skillName(id,this.config))}</strong><span>${TYPES[sk.type]?.name}系 · 威力 ${sk.power}</span><span class="card-count">×${count}</span></button>`}).join(''):'<div class="empty-pocket">✦ 战斗胜利后可以获得技能卡。<br/>目前还没有收集到技能卡。</div>'}</div>
          ${this.selectedCard?`<div class="card-use-bar"><span>已选择「${escapeHtml(skillName(this.selectedCard,this.config))}」· 目标：${escapeHtml(pig?.name||'未选')}</span><button class="btn btn-primary" data-action="apply-card">使用技能卡 →</button></div>`:''}
        </section>
      </main><div id="inventory-modal"></div>
      <div class="fixture-warning">⚑ 属性与技能威力为工程测试配置；“训练升级”是无经验系统的开发入口</div>
    </div>`;
    this.renderModal();
  }
  pigDetails(pig,roster){
    const inTeam=roster.includes(pig.id);
    return `<div class="detail-top"><span class="mini-overline">PARTNER PROFILE / ${pig.id}</span><span class="detail-number">No. ${pig.id.replace(/\D/g,'').padStart(3,'0')}</span></div>
      <div class="detail-main"><div class="detail-pig-art art-${pig.type}">${pigSprite(pig.type)}</div><div class="detail-pig-info"><div class="detail-name">${escapeHtml(pig.name)} <span>Lv.${pig.level}</span></div>${typeBadge(pig.type)}<p>一起冒险的忠实伙伴，每个猪猪都有自己独特的属性和技能。</p>${bar('HP',pig.hp,pig.maxHp)}${bar('SP',pig.sp,pig.maxSp,'sp')}</div></div>
      <div class="detail-status">${statusChips(pig)}</div>
      <div class="detail-skill-title"><span>掌握技能</span><small>${pig.skills.length} / 6</small></div>
      <div class="detail-moves">${Array.from({length:6},(_,i)=>{
         const id=pig.skills[i];if(!id)return `<div class="detail-move empty">＋ 空技能位</div>`;
         const sk=this.config.skill(id);return `<div class="detail-move"><span class="detail-move-type detail-${sk.type}">${TYPES[sk.type]?.icon}</span><b>${escapeHtml(skillName(id,this.config))}</b><span>${sk.spCost} SP</span></div>`;
      }).join('')}</div>
      <div class="detail-actions"><button class="btn ${inTeam?'btn-cream':'btn-primary'}" data-action="toggle-team">${inTeam?'✓ 撤下出战队伍':'＋ 加入出战队伍'}</button><button class="btn btn-outline" data-action="levelup">✦ 训练升级 <small>测试</small></button></div>`;
  }
  renderModal(){
    const el=this.root.querySelector('#inventory-modal');if(!el)return;
    const pending=this.model?.pendingLearning;
    if(pending)this.modal={mode:'learning',skillId:pending.skillId,pigId:pending.pigId};
    if(!this.modal){el.innerHTML='';return;}
    const m=this.modal;
    const chosen=this.model.pigs.find(p=>p.id===m.pigId);
    const newName=skillName(m.skillId,this.config);
    const mode=m.mode==='learning'?'学习新技能':'使用技能卡';
    el.innerHTML=`<div class="modal-backdrop"><div class="modal-window skill-modal" role="dialog" aria-modal="true" aria-label="${mode}"><div class="modal-head"><div><div class="mini-overline">SKILL SELECTION</div><h2>${mode}</h2></div>${m.mode==='card'?'<button class="icon-button" data-action="close-modal" aria-label="关闭">✕</button>':''}</div>
      <p class="modal-lede">让 <strong>${escapeHtml(chosen?.name)}</strong> 学会「<strong>${escapeHtml(newName)}</strong>」。${chosen?.skills.length>=6?'技能位已满，请选择替换的技能。':'可以填入空技能位，也可以替换已有技能。'}</p>
      <div class="slot-choice">${Array.from({length:6},(_,i)=>{
        const previous=chosen?.skills[i];const disabled=i>chosen.skills.length;
        return `<button class="slot-choice-btn" data-action="replace-slot" data-slot="${i}" ${disabled?'disabled':''}><span class="slot-index">0${i+1}</span><strong>${previous?escapeHtml(skillName(previous,this.config)):'＋ 空技能位'}</strong><span>${previous?'替换 ↗':'学习 ↗'}</span></button>`;
      }).join('')}</div><div class="modal-bottom">${m.mode==='learning'?'<button class="btn btn-cream" data-action="skip-learning">放弃学习</button>':'<button class="btn btn-cream" data-action="close-modal">取消</button>'}</div></div></div>`;
  }
  act(result){
    if(!result?.ok){this.app.onToast(errorText(result?.errorCode||'Unknown'));return false;}
    if(result.pendingInput?.type==='ChooseLearnReplacement')this.modal={mode:'learning',pigId:result.pendingInput.pigId,skillId:result.pendingInput.skillId};
    else this.modal=null;
    this.render(this.model);return true;
  }
  onClick(e){
    const btn=e.target.closest('[data-action]');if(!btn||!this.root.contains(btn))return;
    const act=btn.dataset.action;
    if(act==='back'){this.app.onBack();return;}
    if(act==='close-modal'){this.modal=null;this.renderModal();return;}
    if(act==='select-pig'){this.selectedId=btn.dataset.id;this.selectedCard=null;this.render(this.model);return;}
    if(act==='toggle-team'){
      if(this.app.onToggleRoster(this.selectedId))this.render(this.model);
      return;
    }
    if(act==='card'){this.selectedCard=btn.dataset.card;this.render(this.model);return;}
    if(act==='apply-card'){
      const pig=this.model.pigs.find(p=>p.id===this.selectedId);if(!pig)return;
      if(pig.skills.includes(this.selectedCard)){this.app.onToast('这只猪猪已经学会该技能');return;}
      // If there is room, the domain fills the first free slot.
      if(pig.skills.length<6){const result=this.handlers.onUseCard(this.selectedCard,pig.id);if(result?.ok){this.selectedCard=null;this.modal=null;this.render(this.model);this.app.onToast('技能学习成功！')}return;}
      this.modal={mode:'card',pigId:pig.id,skillId:this.selectedCard};this.renderModal();return;
    }
    if(act==='levelup'){
      const p=this.model.pigs.find(x=>x.id===this.selectedId);const r=this.handlers.onLevelUp(p.id,p.level+1);
      if(!r?.ok){this.app.onToast(errorText(r.errorCode));return;}
      if(r.pendingInput){this.modal={mode:'learning',pigId:r.pendingInput.pigId,skillId:r.pendingInput.skillId};this.renderModal();}
      else this.app.onToast(r.learned?.length?'自动学会了新技能！':'等级提升（测试模式）');
      return;
    }
    if(act==='replace-slot'){
      const index=Number(btn.dataset.slot),m=this.modal;
      const r=m.mode==='learning'?this.handlers.onLearnChoice(index,false):this.handlers.onUseCard(m.skillId,m.pigId,index);
      if(!r?.ok){this.app.onToast(errorText(r.errorCode));return;}
      this.selectedCard=null;
      this.modal=r.pendingInput?{mode:'learning',pigId:r.pendingInput.pigId,skillId:r.pendingInput.skillId}:null;
      this.render(this.model);this.app.onToast('技能更换成功！');return;
    }
    if(act==='skip-learning'){
      const r=this.handlers.onLearnChoice(null,true);if(!r?.ok){this.app.onToast(errorText(r.errorCode));return;}
      this.modal=r.pendingInput?{mode:'learning',pigId:r.pendingInput.pigId,skillId:r.pendingInput.skillId}:null;
      this.render(this.model);this.app.onToast('已放弃学习该技能。');
    }
  }
}
