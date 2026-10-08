# 猪猪游戏 · 无界面核心原型（工程 v0.9）

这是《猪猪游戏demo文档》与《猪猪游戏架构设计文档》对应的 **原生 JavaScript ES Modules** 逻辑工程。仍然**没有 HTML、CSS、DOM View**；实际 UI 按开发版本计划最后在 v1.0 实现。

> **重要：当前只有 Fixture 模拟数值。** 仓库缺少《战斗系统设计 v1.3》完整伤害公式、松软发酵被动参数、抽抗性权重及面包猪学习表；`config/demo.fixture.json` 的自定义数值仅为工程测试样例，**不得标为游戏正式数值**。

## 快速开始

要求 Node.js 20+，**无外部运行依赖**：

```bash
npm test
npm run validate:config
npm run check:architecture
npm run test:fixtures
npm run test:headless
npm run smoke:headless
npm run headless
npm run demo
```

`npm run headless` 显示固定种子 4v3 的完整战斗结果，`node scripts/headless.js 1` 可选择种子。`npm test` 是全部 Node 测试。以上命令均无需浏览器。CI 在 push/PR 时执行。

## 当前实现

| 逻辑模块 | 源码 | 职责 |
| --- | --- | --- |
| Config | `src/config/`、`config/demo.fixture.json` | 校验配置、只读目录、AI/被动/学习表定义 |
| BattleState / BattleEngine | `src/domain/` | 4v3/1v1、速度行动、技能、防御/换人、死亡强制换人、胜负、Down/1 More/Baton Pass |
| BattleRules | `src/domain/BattleRules.js` | 7×7 克制、随机抗性/反弹/发现、六种异常、五类能力等级、可配置被动回血 |
| EnemyAI | `src/domain/EnemyAI.js` | 随机可用技能、弱点优先、低 HP 防御、接棒、敌方自动换人由 Engine 决定 |
| Inventory / SkillLearning | `src/domain/` | 8 只背包、最多 6 技能位、技能卡消耗、升级自动学习/满位替换 |
| GameSession | `src/application/GameSession.js` | 内存数据、开战、奖励、收编/放弃、技能卡、重置 |
| Application Services | `src/application/` | Menu/Battle/Inventory/Reward 的用例接口 |
| Presenters / Mapper | `src/presentation/` | 纯 JS MVP、FakeView 测试、展示投影、UI 事件队列入口 |

技能、被动、抗性抽样、Baton Pass 倍率均通过测试配置注入。复杂回合处理保留在单写入点 `BattleEngine`；View / Presenter 不修改游戏数值。战斗事件含 `seq` 和 `kind`，供将来的 Web 或 Unity 表现层播放。

## 范围及验收状态

- **v0.5**：六种异常、能力等级、被动触发工程逻辑 + 单测；被动和取整数值**待 v1.3**。
- **v0.6**：规则式敌方 AI、胜负完整闭环、固定种子无界面模拟。
- **v0.7**：胜利奖励、收编或放弃、满包提示错误码、技能卡及升级学习，用例级测试。
- **v0.8**：独立 Application Services、四类 Presenter、FakeView 生命周期/输入锁、ViewModel 不暴露未发现抗性。
- **v0.9**：43 项 Node 测试、150 个种子对战、黄金事件 SHA-256、跨层无 UI 集成、CI、Unity 迁移契约。

**以上表示完成了测试配置下的工程里程碑**，不是策划数值正式验收。详见 [`docs/ACCEPTANCE_V09.md`](./docs/ACCEPTANCE_V09.md) 和 [`docs/MIGRATION_CONTRACT.md`](./docs/MIGRATION_CONTRACT.md)。

## 代码边界

```text
src/config              ← 只读规则与数据（Node 读取 JSON 的适配器在这里）
src/domain              ← 零 DOM 的同步游戏规则；禁止 Math.random / setTimeout
src/application         ← 会话、奖励、背包和战斗用例
src/presentation        ← 纯 JavaScript Presenter + ViewModel，暂用 FakeView 测试
scripts                 ← 无界面命令行工具
tests                   ← 规则/交互/黄金事件/完整战斗的 Node 测试
```

**为什么不直接用 C#？** 目标是先用 HTML/JS 做 Web Demo；保留 Unity/C# 相近的类型职责、命令协议和 DTO。未来移植时需要将 JavaScript 规则**重写为 C#**，但可以使用同一批 JSON、种子算法与测试用例来核对结果。

## 当前已知待确认

1. v1.3 正式伤害公式、取整规则、猪与技能具体数值、抗性概率。
2. 松软发酵被动真实间隔和回血量：现在 Demo Fixture 的 `interval: 2` 和 `amount: 5` 是**测试用例值**。
3. Baton Pass 叠加/加成细节：Fixture 暂用 `1.5x`（上限 `3x`），不是策划最终公式。
4. 需求内部中毒/灼伤“换人清除”与“异常不因换人清除”的冲突：本原型按后一条（换人保留）实现。
5. 冰冻的“火属性技能”与七罪元素名称不一致，当前暂通过技能的 `fire` 标签判断。
6. AI 优先级已按架构建议固定（自己低 HP 防御 → 对方低 HP 最高威力 → 已知弱点 → 随机技能）；待策划最终确认。
7. 目前无存档/经验系统/美术与 UI，后续按开发版本计划推进。

浏览 `猪猪游戏demo文档.md`、`猪猪游戏架构设计文档.md`、`猪猪游戏开发版本计划文档.md` 可查看完整需求与版本规划。
