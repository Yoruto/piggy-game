/** Original pig shapes for the Web Demo, not a borrowed creature or copyrighted game sprite. */
export const TYPES = {
  pride: { name: '傲慢', tone: '#f5b764', dark: '#ba734d', light: '#fff0c9', icon: '✦' },
  envy: { name: '嫉妒', tone: '#8ccca6', dark: '#438b75', light: '#d9f8df', icon: '☘' },
  wrath: { name: '暴怒', tone: '#f4978e', dark: '#c95b61', light: '#ffe0d4', icon: '◆' },
  sloth: { name: '懒惰', tone: '#c5b1eb', dark: '#8265b8', light: '#ede4ff', icon: '☾' },
  greed: { name: '贪婪', tone: '#efd36e', dark: '#b59632', light: '#fff4bc', icon: '✧' },
  gluttony: { name: '暴食', tone: '#9bd9df', dark: '#4397a5', light: '#e0fbff', icon: '◈' },
  lust: { name: '色欲', tone: '#eea6cb', dark: '#b75b94', light: '#ffe2f1', icon: '♥' }
};
export const STATUS = { poison: ['中毒','☣'], burn: ['灼伤','♨'], paralysis: ['麻痹','ϟ'], sleep: ['睡眠','☽'], freeze: ['冰冻','❄'], confusion: ['混乱','◌'] };
export const STAT = { attack: '攻击', defense: '防御', speed: '速度', crit: '暴击', spRegen: 'SP恢复' };
export const RESIST = { weak: '弱', normal: '普', resist: '耐', null: '无', reflect: '反' };
export const escapeHtml = input => String(input ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function typeBadge(type, extra = '') {
  const t = TYPES[type] ?? TYPES.sloth;
  return `<span class="type-badge type-${type} ${extra}"><span aria-hidden="true">${t.icon}</span> ${t.name}</span>`;
}
export function pigSprite(type, { back = false, small = false, fainted = false } = {}) {
  const t = TYPES[type] ?? TYPES.sloth;
  const classes = ['pig-sprite', back ? 'sprite-back':'',small?'sprite-small':'',fainted?'sprite-fainted':''].filter(Boolean).join(' ');
  return `<svg class="${classes}" viewBox="0 0 224 201" aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg">
    <path d="M169 123 Q221 105 205 77 Q197 66 190 84" fill="none" stroke="${t.dark}" stroke-width="11" stroke-linecap="round"/>
    <ellipse cx="112" cy="167" rx="61" ry="17" fill="#294c45" opacity=".14"/>
    <ellipse cx="110" cy="112" rx="76" ry="66" fill="${t.tone}" stroke="${t.dark}" stroke-width="5"/>
    <path d="M57 69 L44 14 Q42 3 55 10 L88 44 M136 44 L170 10 Q183 2 182 19 L167 74" fill="${t.tone}" stroke="${t.dark}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="M58 55 L54 27 79 52 M144 53 L169 28 163 63" fill="${t.light}"/>
    <ellipse cx="110" cy="102" rx="62" ry="57" fill="${t.light}" opacity=".32"/>
    <ellipse cx="73" cy="169" rx="17" ry="11" fill="${t.dark}"/><ellipse cx="148" cy="169" rx="17" ry="11" fill="${t.dark}"/>
    ${back ? `<path d="M87 85 Q111 75 136 85" fill="none" stroke="${t.dark}" opacity=".55" stroke-width="4" stroke-linecap="round"/><path d="M97 108 Q113 119 129 107" fill="none" stroke="${t.dark}" stroke-width="4" opacity=".45"/>` : `<ellipse cx="82" cy="88" rx="8" ry="11" fill="#263e3c"/><ellipse cx="140" cy="88" rx="8" ry="11" fill="#263e3c"/><circle cx="85" cy="84" r="3" fill="white"/><circle cx="143" cy="84" r="3" fill="white"/><ellipse cx="62" cy="110" rx="13" ry="8" fill="#e77483" opacity=".45"/><ellipse cx="160" cy="110" rx="13" ry="8" fill="#e77483" opacity=".45"/><ellipse cx="112" cy="127" rx="34" ry="25" fill="#f7b4ba" stroke="${t.dark}" stroke-width="4"/><ellipse cx="101" cy="128" rx="5" ry="8" fill="#ad6172"/><ellipse cx="124" cy="128" rx="5" ry="8" fill="#ad6172"/>`}
    <path d="M90 55 L113 39 134 55" fill="none" stroke="${t.dark}" stroke-width="4" opacity=".18" />
    <circle cx="170" cy="52" r="20" fill="${t.dark}"/><text x="170" y="60" text-anchor="middle" font-size="24" font-weight="700" fill="white">${t.icon}</text>
  </svg>`;
}
export function bar(label, current, max, kind = 'hp') {
  const safeMax = Math.max(1,Number(max)||1); const value = Math.max(0,Number(current)||0);
  const ratio = Math.min(100, Math.round(value / safeMax * 100));
  const low = ratio <= 25 ? 'low' : ratio <= 50 ? 'medium' : '';
  return `<div class="statbar"><div class="statbar-head"><span>${label}</span><strong>${Math.ceil(value)} <span>/ ${safeMax}</span></strong></div><div class="statbar-track ${kind}"><div class="statbar-fill ${low}" style="width:${ratio}%"></div></div></div>`;
}
export function statusChips(pig) {
  const chips=[];
  if(pig.status?.kind) {const [name,symbol]=STATUS[pig.status.kind] ?? [pig.status.kind,'◈']; chips.push(`<span class="state-chip harmful">${symbol} ${name}</span>`);}
  if(pig.down) chips.push('<span class="state-chip harmful">↓ Down</span>');
  if(pig.guarding) chips.push('<span class="state-chip">⬟ 防御</span>');
  if(pig.switchShield) chips.push('<span class="state-chip">✦ 换人保护</span>');
  for(const [stat,stage] of Object.entries(pig.stages||{})) if(stage) chips.push(`<span class="state-chip ${stage<0?'harmful':''}">${STAT[stat]||stat} ${stage>0?'↑':'↓'}${Math.abs(stage)}</span>`);
  return chips.join('')||'<span class="muted small">状态正常</span>';
}
export function skillName(id, config) {
  const skill=config.skill(id);
  const names={ 'skill.sloth':'慵懒冲撞','skill.wrath':'怒火猛击','skill.pride':'闪耀头槌','skill.envy':'嫉妒之刺',
    'skill.poison':'毒气泡泡','skill.burn':'炙热吐息','skill.paralyze':'酥麻电波','skill.sleep':'甜梦泡泡','skill.freeze':'寒冰气息','skill.confuse':'混乱乐章','skill.buff':'王者气场' };
  return names[id] || `${TYPES[skill.type]?.name || '未知'}技能`;
}
export function errorText(code) {
  return ({NoBattle:'还没有开始战斗',BattleInProgress:'战斗还没结束',PendingRecruitChoice:'请先处理收编奖励',PendingLearnReplacement:'请先完成技能学习',
    InsufficientSp:'SP 不足，无法使用该技能',InvalidSwitch:'无法换上这只猪猪',InvalidPhase:'现在不能进行这个动作',StaleCommand:'操作已失效，请重试',
    InvalidActor:'现在不是这只猪猪的回合',UnknownSkill:'没有学会这个技能',BattleFinished:'战斗已经结束',PresentationBusy:'请等待行动演出结束',
    InventoryFull:'背包已满，无法收编',NoPendingRecruit:'当前没有收编机会',InvalidRecruitCandidate:'无效的收编对象',DuplicateSkill:'已学会这个技能',
    NoSkillCard:'没有这张技能卡',SkillSlotsFull:'技能栏已满，请选择替换槽位',InvalidSlot:'请选择有效技能位',UnknownPig:'找不到这只猪猪',
    NoPendingLearn:'没有待学习技能',InvalidLevel:'等级必须高于当前等级',InvalidEnemySize:'敌方队伍配置有误', 'Invalid roster member':'出战伙伴体力不足，请重置冒险重新开始', 'Invalid roster':'请选择四只存活的猪猪出战'})[code] ?? `操作失败：${code}`;
}
