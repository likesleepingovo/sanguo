# 三国时空历史地图

基于 **Vite + TypeScript + MapLibre GL JS** 的交互式三国历史地图 Demo。

## 项目目录结构

```
sanguo/
├── index.html                      # 入口 HTML
├── package.json
├── tsconfig.json
├── vite.config.ts
├── public/
│   └── data/                       # 外部地理/历史数据（JSON，可独立扩充）
│       ├── cities.json             # 城池点位 GeoJSON
│       ├── events.json             # 重大历史事件列表
│       ├── rivers.json             # 水系 GeoJSON
│       ├── factions/
│       │   └── index.json          # 各年份势力版图索引
│       └── battles/
│           └── index.json          # 战役推演数据
└── src/
    ├── main.ts                     # 应用入口
    ├── app.ts                      # 主控制器（协调各模块）
    ├── style.css                   # 深色文史风格 UI
    ├── types/
    │   └── index.ts                # 类型定义与常量
    ├── map/
    │   └── MapInstance.ts          # 地图实例（底图、3D 地形、控件）
    ├── timeline/
    │   └── TimelineManager.ts      # 时间轴管理器（184–280 年）
    ├── battle/
    │   └── BattleAnimationController.ts  # 战役动画控制器
    ├── layers/
    │   └── LayerManager.ts         # 图层管理器（懒加载、淡入淡出）
    ├── ui/
    │   └── components.ts           # UI 组件（侧边栏、城池面板、测距）
    └── utils/
        └── geo.ts                  # 地理计算工具
```

## 快速启动

```bash
npm install
npm run dev
```

浏览器访问 `http://localhost:5173`。

## 功能概览

| 模块 | 功能 |
|------|------|
| **模式 A · 全局时空浏览** | 底部时间轴 184–280 年，拖动切换势力版图，事件刻度，点击城池弹面板 |
| **模式 B · 战役推演沙盘** | 选择官渡/赤壁等战役，镜头飞行，播放/暂停/步进，行军路线动画 |
| **图层控制** | 城池、水系、势力边界、行军路线开关 |
| **测距工具** | 点击地图测量距离 |

## 瓦片资源（免费开源，无需 API Key）

- **卫星影像**：Esri World Imagery
- **3D 地形 DEM**：MapLibre Demo Terrain Tiles
- **山体阴影**：同源 DEM 数据

## 数据扩充

所有地理数据位于 `public/data/`，直接编辑 JSON 即可：

- 新增城池 → `cities.json`
- 新增年份势力 → `factions/index.json` 添加 `"年份": FeatureCollection`
- 新增战役 → `battles/index.json` 追加战役对象
- 新增事件 → `events.json`

## 构建

```bash
npm run build
npm run preview
```
