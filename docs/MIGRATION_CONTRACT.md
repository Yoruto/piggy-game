# Web JavaScript → Unity / C# 迁移契约（v0.9 工程基线）

> 本文件描述工程协议，不代表战斗系统 v1.3 数值已确认。未来移植须用 C# 重写 JavaScript 逻辑，**不可直接复制 JS 当作 C# 程序集执行**。

## 1. 模块映射

| JS 模块 | Unity/C# 目标 | 生命周期与约束 |
| --- | --- | --- |
| `ConfigCatalog`、JSON | C# Config DTO + Catalog；Unity TextAsset/StreamingAssets Loader | 运行时只读、按 `configVersion` 校验 |
| `PigInstance`、`Inventory` | 普通 C# Entity / Inventory | 运行实例可变，模板不可变 |
| `BattleState`、`BattleEngine` | 非 MonoBehaviour 的 C# 服务/状态机 | 引擎唯一修改战斗状态 |
| `BattleRules`、`EnemyAI` | 纯 C# 规则类/策略 | 注入 Config + IRandomSource；无 View |
| `GameSession`、Application Services | C# 会话/UseCase | 跨场景持有，当前不保存到磁盘 |
| Presenter / Mapper | 纯 C# Presenter / ViewModel | 构造器注入和 initialize/dispose |
| FakeView / Web View（v1.0 才有） | Unity MonoBehaviour / UI Toolkit View | 仅渲染/输入/播放动画；游戏逻辑不嵌入 MonoBehaviour |

## 2. 命令、阶段、结果

- 输入命令（现有 JSON 对象）：`{ type: 'skill'|'guard'|'switch'|'forced-switch'|'baton-pass', actorId?, skillId?, pigId?, expectedRevision? }`。
- `BattleEngine.execute(command)` 返回 `ok / errorCode / snapshot / events / pendingInput`。
- 重要阶段：`action / more / pass-action / forced-switch / finished`；以后为 C# 映射为 enum，不更改 wire 字符串取值。
- `pendingInput.type` 为 `ChooseAction / ChooseMoreAction / ChooseBatonAction / ChooseForcedSwitch`。
- 战斗事件为 `{ seq: integer, kind: string, ...payload }`；`seq` 在单场战斗中单调递增，不复用 UI 文案作为协议 ID。
- Domain Snapshot 不含各目标**真实隐藏抗性**；Presentation 的 `mapBattleSnapshot` 仅包含玩家已发现的敌方抗性，绝不外泄 AI 对我方的侦察知识。
- 非法/过期命令不可产生状态修改；`expectedRevision` 是乐观并发校验。

## 3. 配置契约

- 数据源：`config/demo.fixture.json`，`schemaVersion: 1`、`configVersion: fixture-v0.9.0`，`fixture: true`。
- 属性 ID：`pride/envy/wrath/sloth/greed/gluttony/lust`，有向 7×7 倍率；**不得自动推断逆克**。
- 抗性值：`normal / weak / resist / null / reflect`。已有 `null` 是字符串枚举，与 JSON 的 null 值不同，迁移时必须明确区分。
- 状态：`poison/burn/paralysis/sleep/freeze/confusion`；阶段：`attack/defense/speed/crit/spRegen`。
- 猪/技能/被动由 ID 引用，配置写一次，实例不应持有配置对象的可变指针。
- 技能学习 `learnset[{level, skillId}]`；奖励 `rules.rewardSkillCards[]`，同一胜利奖励只执行一次。

## 4. 随机数、数值与一致性

`SeededRandom`：状态为 uint32，初始 `seed >>> 0`，每次 

```text
state = (1664525 * state + 1013904223) modulo 2^32
next  = state / 4294967296
index(length) = floor(next * length)
```

C# 要用 `unchecked(uint)` 语义，显式模拟乘法溢出。不要直接替换为 `System.Random`/`UnityEngine.Random`，否则黄金事件不一致。跨语言需统一浮点 `double`、向下取整、clamp、状态迭代顺序。**正式 v1.3 若改动取整/倍率，先更新契约与测试用例**。

## 5. 迁移验收

- 使用 `tests/fixtures/headless-golden.json` 的固定 seed、初始阵容和配置版本，核对胜负、回合数、事件条数、全部有序事件的 SHA-256。
- 除常规战斗外，还必须在 C# 中复制 `tests/v09.test.js` 的奖励/背包/技能/Presenter 测试情形。
- 所有事件在 Unity UI 演出开始**之前**已由 Domain 决定；动画不可回调重新扣血。
- C# 版若因数值精度/哈希序列化字段顺序产生差异，应先按 canonical DTO/序列化契约修正，不能直接放宽规则检查。

本契约覆盖工程原型的可回放语义；完整设计数字与美术/音效仍属于后续迭代。
