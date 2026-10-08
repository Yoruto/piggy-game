import { pigSprite, typeBadge, escapeHtml, errorText } from '../assets/visuals.js';
export class MenuView {
  constructor(root,config,app){this.root=root;this.config=config;this.app=app;this.handlers=null;this.listener=this.onClick.bind(this);}
  bind(h){this.handlers=h;this.root.addEventListener('click',this.listener);}
  unbind(){this.root.removeEventListener('click',this.listener);this.handlers=null;}
  dispose(){this.unbind();}
  render(){
    const team=this.app.getTeam();const resume=this.app.getBattleStatus()&&this.app.getBattleStatus()!=='finished';
    this.root.innerHTML=`<div class="page-shell home-shell">
      <header class="topbar"><div class="brand"><span class="brand-mark">✿</span> PIGGY <b>QUEST</b><span class="brand-dot">·</span></div><span class="edition">WEB DEMO <i>01</i></span></header>
      <main class="home-content">
        <section class="hero-copy">
          <div class="eyebrow"><span class="eyebrow-dot"></span> 一场从小小猪圈出发的冒险</div>
          <h1>今天也要，<br/><em>元气满满</em>地冒险！</h1>
          <p class="hero-lede">集结你的猪猪伙伴，发现七种属性的秘密。<br/>策略出招、触发弱点，赢下属于你们的每场挑战。</p>
          <div class="hero-actions">
            <button class="btn btn-primary btn-big" data-action="start"><span>⚔</span> ${resume?'继续挑战':'开始挑战'} <span class="button-arrow">↗</span></button>
            <button class="btn btn-cream btn-big" data-action="inventory"><span>▦</span> 猪猪背包</button>
          </div>
          <div class="intro-note"><span>✧</span> 原创掌机风回合制冒险 <span class="note-divide"></span> 4 位伙伴 VS 3 位对手</div>
        </section>
        <section class="hero-illustration" aria-label="猪猪伙伴插画">
          <div class="hero-cloud cloud-a"></div><div class="hero-cloud cloud-b"></div>
          <div class="hero-sun"></div><div class="hero-hill hill-back"></div><div class="hero-hill hill-front"></div>
          <div class="hero-spark spark-a">✦</div><div class="hero-spark spark-b">✧</div><div class="hero-spark spark-c">✦</div>
          <div class="hero-sprite hero-main">${pigSprite('sloth')}</div><div class="hero-sprite hero-side">${pigSprite('envy')}</div>
          <div class="hero-tag">YOU & YOUR PIGGIES <span>♥</span></div>
        </section>
      </main>
      <section class="home-bottom">
        <div class="section-heading"><div><div class="mini-overline">YOUR PARTNERS</div><h2>冒险队伍 <span>· ${team.length.toString().padStart(2,'0')}</span></h2></div><button class="text-action" data-action="inventory">管理队伍 ↗</button></div>
        <div class="party-preview">${team.map((pig,i)=>`<div class="partner-card"><div class="partner-art partner-${pig.type}">${pigSprite(pig.type,{small:true})}</div><div class="partner-info"><b>${escapeHtml(pig.name)}</b><span>Lv.${pig.level} ${typeBadge(pig.type)}</span></div><div class="partner-num">0${i+1}</div></div>`).join('')}</div>
      </section>
      <footer class="footer-info"><span>训练师手册 / 勇敢迈出第一步吧！</span><button class="quiet-reset" data-action="reset">↻ 重置本次冒险</button></footer>
      <div class="fixture-warning">⚑ 当前使用测试配置数值，非正式战斗系统 v1.3</div>
    </div>`;
  }
  onClick(e){const btn=e.target.closest('[data-action]');if(!btn||!this.root.contains(btn))return;
    const action=btn.dataset.action;
    if(action==='inventory')this.app.onInventory();
    if(action==='start'){
      if(this.app.getBattleStatus()&&this.app.getBattleStatus()!=='finished')this.app.onResume();
      else if(this.app.getTeam().length!==4)this.app.onInventory();
      else {
        const result=this.handlers?.onStartBattle(this.app.getTeam().map(p=>p.id),['pig.wrath','pig.pride','pig.envy']);
        if(result?.ok)this.app.onStarted();else this.app.onToast(errorText(result?.errorCode||'无法开始战斗'));
      }
    }
    if(action==='reset'){
      if(!window.confirm('重置本次冒险？背包、战斗和技能卡都会恢复到初始状态。'))return;
      this.handlers?.onReset();this.app.onReset();this.render();
    }
  }
}
