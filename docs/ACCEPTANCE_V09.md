# v0.5～v0.9 验收记录（Fixture 工程原型）

> **验收基线**：2026-10-08；最终实现源码位置：`src/`。  
> **总体结论**：测试配置下的工程功能**通过**；《战斗系统设计 v1.3》未提供的真实数值**待验收**。此记录不等于完整产品 v1.0 已完成。

## 1. 统一执行命令

```bash
npm test
npm run validate:config
npm run check:architecture
npm run test:fixtures
npm run test:headless
npm run smoke:headless
node scripts/headless.js 1
node scripts/headless.js 20261008
```

- `npm test`：所有现有 `tests/*.test.js`；固定种子 + 150 种子对战。
- `test:fixtures`：对比有序事件 JSON 的 SHA-256、胜负、回合数、命令步数、事件数量。
- `smoke:headless`：应用/Presenter/奖励/背包/重置的无 UI 端到端测试。
- `check:architecture`：拒绝 Domain 中引入 DOM、global RNG、定时器、浏览器存储、UnityEngine。
- Node.js 20+；不使用浏览器。

## 2. 逐版验收表

| 版本 | 工程实现 | 测试证据 | 结论与限制 |
| --- | --- | --- | --- |
| **v0.5** | 六种异常、五项能力、被动 `tickPassive`、玩家→敌人顺序 | `tests/advanced.test.js`、`tests/v09.test.js` | **Fixture 功能通过**；被动/取整正式数值待 v1.3 |
| **v0.6** | AI 概率策略、敌队死亡换人、4v3 完整胜负 | `tests/headless-smoke.test.js`、`tests/v09-regressions.test.js` | **Fixture 功能通过**；AI 策略优先级待确认 |
| **v0.7** | 8 容量背包、奖励技能卡、收编/拒绝、满包报错、升级学习/技能替换 | `tests/v09.test.js` | **Fixture 功能通过**；真实学习表和技能卡池待 v1.3 |
| **v0.8** | Application Services、四种 Presenter、FakeView、输入锁、ViewModel 抗性保密 | `tests/core.test.js`、`tests/v09.test.js` | **接口级通过**；无真实 DOM View（符合计划） |
| **v0.9** | 完整无界面主流程、黄金事件、回归测试、CI、迁移契约 | `tests/fixtures.test.js`、`tests/v09.test.js`、`tests/v09-regressions.test.js` | **工程基线通过**；最终数值验收阻塞 |

## 3. 关键用例编号与覆盖

- **BAT-01**：双方 4v3、场上 1v1、速度顺序、SP 不足、护盾减伤、普通/强制换人、HP 归零判胜负。
- **BAT-02**：弱点 + 暴击 → Down + 最多一次 1 More；反弹不触发；三回合刷新抗性；Baton Pass 单次加成。
- **BAT-03**：睡眠/冰冻/混乱/麻痹阻断，中毒/灼伤按配置持续伤害；攻击/防御/速度/暴击/SP 回复等级。
- **BAT-04**：松软发酵被动间隔按**测试配置**执行，玩家先于敌方；结束清理临时效果。
- **AI-01**：合法技能选择、低血量策略、已发现弱点、死亡自动换人与合法接棒。
- **INV-01**：收编胜利候选、满包无法收编、放弃、HP/SP 回满且保留抗性/技能。
- **INV-02**：技能卡成功才消耗、最多六技能、升级自动填空/满位替换或放弃。
- **MVP-01**：FakeView 输入/渲染/事件顺序、异步事件期间不重复行动、绑定/释放不重订阅。
- **INT-01**：完整战斗 → 发卡 → 收编 → 背包 → 用卡 → 重置，全部运行在 Node 无 DOM。
- **REP-01**：重复同种子生成相同终态与事件；有序事件 SHA-256 固定值；150 seeds 无死循环。

## 4. 阻塞与缺失数据（不可冒充通过）

1. 完整《战斗系统设计 v1.3》及附录 A 尚未入库：正式伤害算法、数值取整、各猪/技能参数、抗性生成权重未能最终核对。
2. “松软发酵”的实际触发间隔与回血量尚未核实。原型的间隔 2/回 5 HP 仅为 Fixture 测试数据。
3. Baton Pass 的加成具体叠加规则未确认；原型 1.5x 只是测试值，上限 3x 沿用需求。
4. 中毒/灼伤换人是否清除存在需求内部矛盾；暂按通用条款“换人保留”。
5. 冰冻受火属性技能解除的定义与七罪属性列表不一致；工程使用 `fire` 技能标签临时表述。
6. AI 冲突优先级及被反弹/击杀后的后续效果事件顺序需要策划确认。
7. 尚无浏览器端 UI、手动浏览器验收与 Unity 实机运行；根据版本计划仅 v1.0 才制作 View。

**发布关卡**：在取得 v1.3 正式数值并消除上述核心规则歧义之前，不将本原型宣称为通过正式完整 v0.9 数值验收，更不能宣称可玩的 v1.0 已完成。
