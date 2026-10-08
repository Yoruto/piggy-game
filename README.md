# 猪猪大冒险 · Piggy Quest

原创掌机 RPG 氛围的回合制猪猪 Web Demo。使用 **原生 HTML + CSS + JavaScript ES Modules**、MVP + Config 架构；完整 Domain、Application、Presenter 和 Web View 分层。视觉灵感来自经典生物收集回合制游戏的布局与交互，但角色造型、界面图形均为原创代码绘制，不包含宝可梦角色或素材。

> ⚠️ **数值声明**：当前仍采用 `config/demo.fixture.json` 的工程测试数据，并非完整《战斗系统设计 v1.3》正式平衡配置。技能威力、抗性概率、被动间隔、接棒倍率等可能调整。

## 快速启动

要求 Node.js 20+，无需 npm 安装外部依赖：

```bash
npm run dev
```

访问 **http://localhost:4173**。不要直接双击 `index.html` 用 `file://` 打开，浏览器模块与配置请求需要 HTTP。

### 页面与操作

- **主菜单**：开始挑战 / 继续挑战、猪猪背包、重置内存记录。
- **战斗**：4v3，场上 1v1，技能六格（显示威力/SP/属性）、防御、换人、Down / 1 More / Baton Pass、强制换人、抗性发现、状态、战斗日志；场上猪猪为原创 SVG。
- **背包**：8 格容量、猪猪详情、选四只出战（选择顺序决定上场顺序）、技能列表、胜利获得的技能卡使用与替换、训练升级（仅作为学习规则测试入口）。
- **结算**：胜利/失败、技能卡奖励、选择敌方一只收编或放弃、满包提示。

战斗时点击“返回营地”会保留当前内存中的对局，主菜单点击“继续挑战”恢复；重置会清空当前冒险状态。页面刷新不会保存数据。

## 运行自动化测试

```bash
npm test
npm run check:architecture
npm run validate:config
npm run test:fixtures
npm run smoke:headless
npm run test:headless
npm run headless
```

`npm test` 包含无 DOM 核心规则测试和 Web 适配层契约测试。`tests/web/` 验证新适配层；真实浏览器的菜单/背包/战斗/结算交互需另外执行人工或自动化 E2E 验收。

## 实现边界

```text
src/domain/              战斗规则、状态、AI、实例，零 DOM / 零浏览器依赖
src/config/              ConfigCatalog 和测试专用 Node JSON 适配器
src/application/         GameSession、Battle/Inventory/Reward/Menu Services
src/presentation/        纯 JavaScript Presenters / ViewModel Mapper
src/web/                 原生 DOM Views、原创 SVG 绘制、浏览器适配与装配入口
styles/game.css          跨页面响应式掌机风格样式
index.html               唯一 Web 入口
scripts/serve.js         零依赖静态 HTTP 开发服务器
```

Web 侧的 `BrowserBattlePort` 会在玩家命令结算后调用应用层推进敌方回合，不修改任何战斗数值。UI 只通过 Command、Snapshot、Event 与核心交互，未来 Unity 中可复用逻辑协议与 JSON 数据，View 则替换为 Unity UI，JS Domain 需要转换成 C#。

既有设计文档参见 [Demo 需求](./猪猪游戏demo文档.md)、[架构设计](./猪猪游戏架构设计文档.md)、[开发版本计划](./猪猪游戏开发版本计划文档.md)，无界面工程验收及 Unity 迁移契约在 `docs/`。
