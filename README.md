# 猪猪游戏 / Piggy Game

当前为 **原生 JavaScript（ES Modules）无界面战斗核心 v0.4.0 工程原型**，保持 MVP + Config 和 Unity/C# 风格的模块边界。HTML/CSS/DOM View **仍未开始开发**，按计划留到最后。

## 可运行的逻辑

- ConfigCatalog 加载/校验明确标记为 `fixture` 的 JSON、7×7 **有向**属性克制矩阵，固定种子随机源。
- PigInstance、Inventory、GameSession，4v3 队伍、场上 1v1、速度行动队列、合法指令、SP、技能、防御、正常及强制换人、胜负。
- 属性倍率、个体抗性（普通/弱/耐/无/反）、弱点发现与对敌方的**隐藏槽位隔离**、每 3 回合对双方当前上场猪的 7 槽重抽与已发现信息清空。
- 暴击/弱点 → Down/1 More；每个攻击者每回合最多一次，额外行动不连续触发；敌方死亡自动换后备；弱点命中后即使敌方换人，合法的 1 More 仍保留。
- Baton Pass：只能从 1 More 触发，本回合只能使用一次，接棒者立即行动；本次伤害加成结束后必定清除。
- 异常状态基础逻辑：中毒、灼伤、麻痹、睡眠、冰冻、混乱（包含回合结算、行动判定与火标签解冻）；单例最多一种，默认新状态覆盖旧状态。
- 增益/减益：攻击、防御、速度、暴击率、SP 回复各 -6～+6 档，独立生效；换人保留、战斗结束清空。
- 敌方规则 AI：可用技能、弱点知识优先、低 HP 防御、低 HP 对手追击、1 More 概率接棒。
- 结构化 BattleEvents、只读（脱离引用的）战斗快照、FakeView 可用的 BattlePresenter，以及 Node 自动化测试。

## 尚未实现 / 非正式规则

- **不是正式战斗数值**：`config/demo.fixture.json` 的猪属性、技能威力、抗性抽取池、持续回合数、Baton Pass 的 1.5x 增量与伤害/取整公式均为**工程测试 Fixture**。不要据此认为已经按《战斗系统设计 v1.3》完成数值验收。
- **被动“松软发酵”尚未实现**：原始 v1.3 的间隔与回复数值未入仓库；待补充配置和验证用例。
- **技能卡、升级学习、收编与奖励**、完整背包 Presenter、正式 HTML View 尚未实现。
- **未确认规则**：换人保留异常（遵循 Demo 需求 5.2 通则）；七罪属性没有“火”，目前以技能 `tags: ['fire']` 解冻；攻击致死后不附加异常状态；伤害反弹不计算属性克制。若 v1.3 规则另有定义，需要按规范调整。
- Demo 内抗性发现记录包含在 Snapshot 的 `knownResistances` 中，**不会**暴露隐藏抗性；AI 的知识与玩家分开记录。Domain State 内保存真实抗性。
- 完整持续状态设计、Buff 生效时机、异常状态持续回合数等仍需待策划确认后做正式验收。

## 运行（Node.js 20+，无第三方依赖）

```bash
npm test                  # 全量核心测试
npm run test:advanced     # 高级战斗规则测试
npm run demo              # 自动运行 4v3 无界面战斗
```

主要代码位于 `src/config/`、`src/domain/`、`src/application/`、`src/presentation/`。`tests/` 使用固定随机数和独立实例，所有测试无需 DOM 或浏览器。

## 逻辑和表现分离约定

所有战斗状态变更只经 `BattleEngine.execute(command)`，单个命令返回 `{ok, snapshot, events, pendingInput}`；View/Presenter 只负责命令派发与事件表现，不能在页面回调里修改伤害。未来移植 Unity 时按 C# 逻辑转写同一规则，而非把 JS 代码直接复用为 Unity 程序集。JSON 配置、事件/指令语义和测试输入可以作为跨语言对照。

## 文档

- [Demo 需求](./猪猪游戏demo文档.md)
- [架构设计](./猪猪游戏架构设计文档.md)
- [开发版本计划](./猪猪游戏开发版本计划文档.md)
