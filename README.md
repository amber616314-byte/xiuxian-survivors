# 凡尘渡劫 · Mortal Tribulation

> **A browser-native xianxia Survivors-like about cultivation, breakthroughs and surviving heavenly tribulations.**
>
> 从炼气一路修至飞升，在妖潮中参悟神通、融合超武、渡劫破境，并最终斩灭自己的心魔。

## 核心特色

- **完整修炼路线**：炼气 → 筑基 → 结丹 → 元婴 → 化神 → 炼虚 → 合体 → 大乘 → 渡劫 → 飞升。
- **突破不只是数值升级**：结丹需要渡金丹劫，元婴阶段会触发碎丹成婴与心魔战，飞升后还会经历周期性天劫。
- **20 门神通 + 10 组融合超武**：两门配对神通修至满级后自动融合，改变攻击形态与特效规模。
- **八大装备栏**：构筑空间有限，槽位满后只能强化已经掌握的神通。
- **Boss 与结界战**：妖王出现后开启困阵，必须在有限空间中处理弹幕、走位与爆发阶段。
- **镜像心魔**：心魔会依据当前构筑复制玩家能力，以同体系技能反打玩家。
- **纯浏览器离线运行**：HTML / CSS / JavaScript + Canvas，无后端、无账号、无联网依赖。
- **本地记录**：最高纪录使用 `localStorage` 保存。

## 快速开始

直接双击：

```text
index.html
```

也可以启动一个本地静态服务器：

```bash
python -m http.server 8080
```

然后访问：

```text
http://localhost:8080
```

## 操作

| 按键 | 功能 |
| --- | --- |
| `WASD` / 方向键 | 御空移动 |
| `Space` | 缩地成寸：闪避位移 + 短暂无敌 |
| `1 / 2 / 3` | 升级时选择神通 |
| `Esc` | 暂停 / 继续 |

## 修炼与战斗循环

```text
斩妖获取灵气
      ↓
提升修为等级
      ↓
三选一参悟 / 精进神通
      ↓
两门满级神通融合为超武
      ↓
突破境界并处理特殊劫难
      ↓
应对妖王 / 心魔 / 天劫
      ↓
斩灭心魔，完成飞升
```

### 突破事件

- **金丹劫**：结丹时引天雷淬丹，需要主动走位避雷。
- **碎丹成婴**：金丹破碎后进入心魔阶段，击败镜像敌人才可成婴。
- **破界飞升**：化神圆满后进入更高层次的环境与劫难循环。
- **周期天劫**：飞升后天劫持续增强，成功渡过可获得进一步强化。

### 神通构筑

当前提供 20 门神通，并设计 10 组满级融合路线，包括剑阵、雷火、冰封、虫潮、金身、身法与神瞳等不同方向。目标不是单纯堆伤害，而是让范围、控制、防御、机动和弹幕处理形成不同构筑。

## 项目结构

```text
xiuxian-survivors/
├── index.html
├── css/
│   └── style.css
├── fonts/                    # 本地字体
├── assets/                   # 角色、场景、技能、妖兽等素材
├── js/
│   ├── config.js             # 境界 / 神通 / 融合 / 敌人数值
│   ├── assets.js             # 素材加载与精灵定义
│   ├── entities.js           # 玩家 / 敌人 / Boss / 弹幕
│   ├── skills.js             # 20 神通、装备栏与融合逻辑
│   ├── waves.js              # 妖潮、Boss、突破与天劫时间轴
│   ├── render.js             # Canvas 渲染与特效
│   ├── particles.js          # 粒子效果
│   ├── input.js              # 输入
│   ├── audio.js              # WebAudio 音效 / 音乐
│   ├── ui.js                 # HUD、升级、结算等界面
│   ├── game.js               # 游戏状态机
│   └── main.js               # 启动入口
└── tools/
    ├── selfcheck.mjs          # 结构与素材自检
    ├── simtest.mjs            # Headless 整局模拟
    ├── slice-sprites.py       # 精灵切帧工具
    └── normalize-sprites.py   # 素材画布归一化
```

## 自动测试

仓库现在提供统一测试入口：

```bash
npm test
```

也可以分别执行：

```bash
npm run test:selfcheck
npm run test:sim
```

GitHub Actions 会在 Pull Request 与 `main` 分支提交时自动执行这些检查。

## 技术栈

- HTML / CSS / JavaScript
- Canvas 2D
- Web Audio API
- localStorage
- Node.js 测试脚本
- Python + Pillow 素材处理工具

## 第三方资源与许可

项目原创代码采用 **MIT License**。

仓库中的美术素材、字体和第三方资源继续使用各自原始许可证，包括 MIT、CC BY-SA 4.0 与 SIL Open Font License 等。详细说明见 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)。

本项目是独立的修仙 / xianxia Survivors-like 游戏实验，并非任何小说、动画或商业游戏的官方作品，也不存在隶属或授权关系。

## Roadmap

- [ ] 增加真实游戏截图与短 GIF，直接展示核心战斗循环
- [ ] 继续平衡 20 门神通与 10 组融合路线
- [ ] 将 `entities.js` 拆分为玩家、普通敌人、Boss 与投射物模块
- [ ] 将 `render.js` 拆分为场景、角色、弹幕与后处理层
- [ ] 增加更多突破事件与高境界机制
- [ ] 增加可复现的性能基准和长局稳定性测试
- [ ] 部署在线试玩版本
- [ ] 使用 Releases 管理可玩版本

## 开发目标

Mortal Tribulation 的重点不是复刻某个现成作品，而是把“修炼、破境、渡劫、心魔”真正做成 Survivors-like 的战斗机制，让境界成长不仅存在于文字和数值中，而会改变玩家面对的战斗规则。
