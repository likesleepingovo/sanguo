import type { MapInstance } from '../map/MapInstance';
import type { LayerManager } from '../layers/LayerManager';
import type { BattleDefinition, BattlePhase } from '../types';
import { loadJson, routesToGeoJSON, highlightsToGeoJSON } from '../utils/geo';

export type PhaseChangeHandler = (phase: BattlePhase, index: number) => void;

/**
 * BattleAnimationController — 战役动画控制器
 * 负责战役选择、镜头飞行、阶段步进/自动播放、路线与高亮动画
 */
export class BattleAnimationController {
  private mapInstance: MapInstance;
  private layerManager: LayerManager;
  private battles: BattleDefinition[] = [];
  private currentBattle: BattleDefinition | null = null;
  private currentPhaseIndex = 0;
  private isPlaying = false;
  private playTimer: ReturnType<typeof setInterval> | null = null;
  private onPhaseChange: PhaseChangeHandler;

  constructor(
    mapInstance: MapInstance,
    layerManager: LayerManager,
    onPhaseChange: PhaseChangeHandler,
  ) {
    this.mapInstance = mapInstance;
    this.layerManager = layerManager;
    this.onPhaseChange = onPhaseChange;
  }

  /** 加载战役数据并填充选择器 */
  async init(): Promise<void> {
    this.battles = await loadJson<BattleDefinition[]>('/data/battles/index.json');
    const select = document.getElementById('battle-select') as HTMLSelectElement;
    select.innerHTML = '<option value="">— 选择战役 —</option>';
    for (const battle of this.battles) {
      const opt = document.createElement('option');
      opt.value = battle.id;
      opt.textContent = `${battle.name}（${battle.year}年）`;
      select.appendChild(opt);
    }

    select.addEventListener('change', () => {
      const id = select.value;
      if (id) this.selectBattle(id);
    });

    document.getElementById('battle-play')!.addEventListener('click', () => this.play());
    document.getElementById('battle-pause')!.addEventListener('click', () => this.pause());
    document.getElementById('battle-step')!.addEventListener('click', () => this.stepForward());
  }

  /** 选择并进入战役 */
  selectBattle(battleId: string): void {
    const battle = this.battles.find((b) => b.id === battleId);
    if (!battle) return;

    this.pause();
    this.currentBattle = battle;
    this.currentPhaseIndex = 0;
    this.layerManager.resetCityStyles();

    // 镜头飞行到战场
    this.mapInstance.flyTo({
      center: battle.center,
      zoom: battle.zoom,
      pitch: battle.pitch,
      bearing: battle.bearing,
    });

    this.applyPhase(0);
  }

  /** 应用指定阶段的可视化与文本 */
  private applyPhase(index: number): void {
    if (!this.currentBattle) return;
    const phase = this.currentBattle.phases[index];
    if (!phase) return;

    this.currentPhaseIndex = index;

    // 更新路线
    if (phase.routes.length > 0) {
      this.layerManager.setRoutes(routesToGeoJSON(phase.routes));
    } else {
      this.layerManager.clearRoutes();
    }

    // 更新战场高亮
    if (phase.highlights.length > 0) {
      this.layerManager.setHighlights(highlightsToGeoJSON(phase.highlights));
    } else {
      this.layerManager.clearHighlights();
    }

    // 更新占领标记
    for (const occ of phase.occupations) {
      this.layerManager.highlightCity(occ.cityId, occ.faction);
    }

    this.onPhaseChange(phase, index);
  }

  /** 自动播放 */
  play(): void {
    if (!this.currentBattle || this.isPlaying) return;
    this.isPlaying = true;

    this.playTimer = setInterval(() => {
      if (!this.currentBattle) return;
      const next = this.currentPhaseIndex + 1;
      if (next >= this.currentBattle.phases.length) {
        this.pause();
        return;
      }
      this.applyPhase(next);
    }, 3000);
  }

  pause(): void {
    this.isPlaying = false;
    if (this.playTimer) {
      clearInterval(this.playTimer);
      this.playTimer = null;
    }
  }

  /** 步进到下一阶段 */
  stepForward(): void {
    if (!this.currentBattle) return;
    this.pause();
    const next = Math.min(
      this.currentPhaseIndex + 1,
      this.currentBattle.phases.length - 1,
    );
    this.applyPhase(next);
  }

  /** 退出战役模式，清理动画状态 */
  exit(): void {
    this.pause();
    this.currentBattle = null;
    this.currentPhaseIndex = 0;
    this.layerManager.clearRoutes();
    this.layerManager.clearHighlights();
    this.layerManager.resetCityStyles();
  }

  destroy(): void {
    this.pause();
  }
}
