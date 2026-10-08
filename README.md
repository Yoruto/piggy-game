# 猪猪游戏 / Piggy Game

当前是 **原生 JavaScript（ES Modules）无界面战斗核心原型**。开发严格遵守 MVP + Config，HTML/CSS/DOM View 按开发计划留到最终 v1.0。

## 本轮已实现

- 配置驱动的 7×7 属性矩阵、猪/技能模板及数据校验（当前使用测试 fixture）。
- 4v3 队伍与场上 1v1、速度行动队列、技能/SP、防御、普通换人、阵亡强制换人和胜负。
- 弱点、暴击、反弹、Down、每个攻击者每回合一次 1 More 的基础逻辑。
- 简单敌方 AI、内存背包和 GameSession、与 DOM 无关的 BattlePresenter。
- 固定种子随机数、Node 自动化测试和命令行自动战斗示例。

> **重要**：`config/demo.fixture.json` 的猪数值、技能威力及伤害公式是工程测试数据，**不是《战斗系统设计 v1.3》的正式数值**。当前尚未实现 Baton Pass、完整抗性重 roll、异常/增减益、被动、收编与技能学习，这些按版本计划继续开发。本轮是 **v0.3 核心原型**，并不表示开发计划 v0.1～v0.3 的全部验收项已经正式签收。

## 运行

安装 Node.js 20+，在仓库根目录执行（无第三方运行依赖）：

```bash
npm test        # 测试领域、配置和 FakeView Presenter
npm run demo    # 自动模拟完整 4v3 战斗（纯 Node，无浏览器）
```

主要代码：`src/config/`、`src/domain/`、`src/application/`、`src/presentation/`。测试：`tests/`。正式 View 最后再做。

## 文档

- [Demo 需求](./猪猪游戏demo文档.md)
- [架构设计](./猪猪游戏架构设计文档.md)
- [开发版本计划](./猪猪游戏开发版本计划文档.md)
