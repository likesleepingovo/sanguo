import type { MapLayerMouseEvent } from 'maplibre-gl';
import { MapInstance } from './map/MapInstance';
import { LayerManager } from './layers/LayerManager';
import { TimelineManager } from './timeline/TimelineManager';
import { BattleAnimationController } from './battle/BattleAnimationController';
import { Sidebar, CityPanel, LayerControl, MeasureTool } from './ui/components';
import type { AppMode, CityProperties } from './types';

/**
 * App — 应用主控制器
 * 协调地图、时间轴、战役动画、UI 各模块
 */
export class App {
  private mapInstance: MapInstance;
  private layerManager: LayerManager;
  private timelineManager: TimelineManager;
  private battleController: BattleAnimationController;
  private cityPanel: CityPanel;
  private sidebar: Sidebar;
  private mode: AppMode = 'timeline';

  constructor() {
    this.mapInstance = new MapInstance('map');
    this.layerManager = new LayerManager(this.mapInstance.map);

    this.timelineManager = new TimelineManager((year) => {
      this.onYearChange(year);
    });

    this.cityPanel = new CityPanel();

    this.battleController = new BattleAnimationController(
      this.mapInstance,
      this.layerManager,
      (phase) => {
        const textEl = document.getElementById('battle-text')!;
        textEl.innerHTML = `<h4>${phase.title}</h4><p>${phase.text}</p>`;
      },
    );

    this.sidebar = new Sidebar((event) => {
      this.timelineManager.setYear(event.year);
    });

    new LayerControl((layerId, visible) => {
      this.layerManager.setLayerVisibility(layerId, visible);
    });

    this.setupModeSwitch();
    this.setupCityClick();
  }

  /** 启动应用 */
  async start(): Promise<void> {
    await this.mapInstance.whenReady();
    await this.layerManager.initStaticLayers();
    await this.timelineManager.init();
    await this.battleController.init();

    new MeasureTool(this.mapInstance.map);

    // 初始年份势力
    await this.onYearChange(184);
  }

  /** 模式切换 */
  private setupModeSwitch(): void {
    document.querySelectorAll<HTMLButtonElement>('.mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode as AppMode;
        this.setMode(mode);
      });
    });
  }

  private setMode(mode: AppMode): void {
    this.mode = mode;

    document.querySelectorAll('.mode-btn').forEach((btn) => {
      btn.classList.toggle('active', (btn as HTMLElement).dataset.mode === mode);
    });

    this.sidebar.setMode(mode);
    this.timelineManager.setVisible(mode === 'timeline');

    if (mode === 'timeline') {
      this.battleController.exit();
      this.mapInstance.resetView();
    }
  }

  /** 年份切换 — 更新势力版图 */
  private async onYearChange(year: number): Promise<void> {
    if (this.mode !== 'timeline') return;
    await this.layerManager.setFactionYear(year);
  }

  /** 城池点击 — 弹出信息面板 */
  private setupCityClick(): void {
    this.mapInstance.map.on('click', 'cities-circle', (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (!feature?.properties) return;
      this.cityPanel.show(feature.properties as CityProperties);
    });

    this.mapInstance.map.on('mouseenter', 'cities-circle', () => {
      this.mapInstance.map.getCanvas().style.cursor = 'pointer';
    });
    this.mapInstance.map.on('mouseleave', 'cities-circle', () => {
      this.mapInstance.map.getCanvas().style.cursor = '';
    });
  }
}
