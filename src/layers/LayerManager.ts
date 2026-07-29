import type { ExpressionSpecification } from 'maplibre-gl';
import type { Map as MaplibreMap, GeoJSONSource } from 'maplibre-gl';
import type { LayerId, FactionId, FactionIndex } from '../types';
import { FACTION_COLORS, FACTION_FILL_OPACITY } from '../types';
import { loadJson, nearestYearKey, toFeatureCollection } from '../utils/geo';

/** 图层 ID 常量 */
const SOURCE = {
  cities: 'src-cities',
  rivers: 'src-rivers',
  factions: 'src-factions',
  routes: 'src-routes',
  highlights: 'src-highlights',
} as const;

/**
 * LayerManager — 图层管理器
 * 负责 GeoJSON 图层的懒加载、显隐控制、势力切换淡入淡出
 */
export class LayerManager {
  private map: MaplibreMap;
  private factionIndex: FactionIndex | null = null;
  private factionYears: number[] = [];
  private loadedLayers = new Set<LayerId>();
  private currentFactionYear: number | null = null;
  private fadeAnimFrame: number | null = null;

  /** 路线粒子动画偏移 */
  private dashOffset = 0;
  private particleAnimFrame: number | null = null;

  constructor(map: MaplibreMap) {
    this.map = map;
  }

  /** 懒加载全部静态图层数据 */
  async initStaticLayers(): Promise<void> {
    await Promise.all([
      this.ensureCitiesLayer(),
      this.ensureRiversLayer(),
      this.loadFactionIndex(),
    ]);
  }

  /** 加载势力索引（懒加载，不立即渲染） */
  private async loadFactionIndex(): Promise<void> {
    if (this.factionIndex) return;
    this.factionIndex = await loadJson<FactionIndex>('/data/factions/index.json');
    this.factionYears = Object.keys(this.factionIndex)
      .map(Number)
      .sort((a, b) => a - b);
  }

  /** 确保城池图层已加载 */
  async ensureCitiesLayer(): Promise<void> {
    if (this.loadedLayers.has('cities')) return;

    const data = await loadJson<GeoJSON.FeatureCollection>('/data/cities.json');
    this.addGeoJSONSource(SOURCE.cities, data);

    this.map.addLayer({
      id: 'cities-glow',
      type: 'circle',
      source: SOURCE.cities,
      paint: {
        'circle-radius': [
          'match',
          ['get', 'importance'],
          'capital', 12,
          'major', 9,
          'battlefield', 8,
          7,
        ],
        'circle-color': '#d4a574',
        'circle-opacity': 0.25,
        'circle-blur': 0.8,
      },
    });

    this.map.addLayer({
      id: 'cities-circle',
      type: 'circle',
      source: SOURCE.cities,
      paint: {
        'circle-radius': [
          'match',
          ['get', 'importance'],
          'capital', 7,
          'major', 5,
          'battlefield', 5,
          4,
        ],
        'circle-color': '#f0dcc0',
        'circle-stroke-color': '#8b6914',
        'circle-stroke-width': 1.5,
      },
    });

    this.map.addLayer({
      id: 'cities-label',
      type: 'symbol',
      source: SOURCE.cities,
      layout: {
        'text-field': ['get', 'name'],
        'text-size': 12,
        'text-offset': [0, 1.2],
        'text-anchor': 'top',
        'text-font': ['Open Sans Regular'],
      },
      paint: {
        'text-color': '#f0dcc0',
        'text-halo-color': '#1a1510',
        'text-halo-width': 1.5,
      },
    });

    this.loadedLayers.add('cities');
  }

  /** 确保水系图层已加载 */
  async ensureRiversLayer(): Promise<void> {
    if (this.loadedLayers.has('rivers')) return;

    const data = await loadJson<GeoJSON.FeatureCollection>('/data/rivers.json');
    this.addGeoJSONSource(SOURCE.rivers, data);

    this.map.addLayer({
      id: 'rivers-line',
      type: 'line',
      source: SOURCE.rivers,
      paint: {
        'line-color': '#3d85c6',
        'line-width': 2.5,
        'line-opacity': 0.7,
        'line-blur': 0.5,
      },
    });

    this.map.addLayer({
      id: 'rivers-label',
      type: 'symbol',
      source: SOURCE.rivers,
      layout: {
        'text-field': ['get', 'name'],
        'text-size': 11,
        'symbol-placement': 'line-center',
        'text-font': ['Open Sans Regular'],
      },
      paint: {
        'text-color': '#6bb3e0',
        'text-halo-color': '#0a1520',
        'text-halo-width': 1,
      },
    });

    this.loadedLayers.add('rivers');
  }

  /**
   * 切换势力版图（带淡入淡出过渡）
   * @param year 目标年份
   */
  async setFactionYear(year: number): Promise<void> {
    await this.loadFactionIndex();
    if (!this.factionIndex) return;

    const key = nearestYearKey(year, this.factionYears);
    if (key === this.currentFactionYear) return;

    const data = this.factionIndex[String(key)];
    if (!data) return;

    if (!this.map.getSource(SOURCE.factions)) {
      this.addGeoJSONSource(SOURCE.factions, data);
      this.addFactionLayers();
      this.currentFactionYear = key;
      return;
    }

    await this.crossfadeFactionData(data);
    this.currentFactionYear = key;
  }

  /** 添加势力 fill + outline 图层 */
  private addFactionLayers(): void {
    const factionColorExpr: ExpressionSpecification = [
      'match',
      ['get', 'faction'],
      'wei', FACTION_COLORS.wei,
      'shu', FACTION_COLORS.shu,
      'wu', FACTION_COLORS.wu,
      'qunxiong', FACTION_COLORS.qunxiong,
      'han', FACTION_COLORS.han,
      '#888888',
    ];

    this.map.addLayer({
      id: 'factions-fill',
      type: 'fill',
      source: SOURCE.factions,
      paint: {
        'fill-color': factionColorExpr,
        'fill-opacity': FACTION_FILL_OPACITY,
      },
    });

    this.map.addLayer({
      id: 'factions-outline',
      type: 'line',
      source: SOURCE.factions,
      paint: {
        'line-color': factionColorExpr,
        'line-width': 2,
        'line-opacity': 0.8,
      },
    });
  }

  /** 势力数据交叉淡入淡出 */
  private crossfadeFactionData(
    newData: GeoJSON.FeatureCollection,
  ): Promise<void> {
    return new Promise((resolve) => {
      if (this.fadeAnimFrame) cancelAnimationFrame(this.fadeAnimFrame);

      const fillLayer = 'factions-fill';
      const outlineLayer = 'factions-outline';
      const duration = 400;
      const start = performance.now();
      let dataSwapped = false;

      const animate = (now: number) => {
        const t = Math.min((now - start) / duration, 1);

        if (this.map.getLayer(fillLayer)) {
          if (t <= 0.5) {
            const opacity = FACTION_FILL_OPACITY * (1 - t * 2);
            this.map.setPaintProperty(fillLayer, 'fill-opacity', opacity);
            this.map.setPaintProperty(outlineLayer, 'line-opacity', 0.8 * (1 - t * 2));
          } else {
            if (!dataSwapped) {
              (this.map.getSource(SOURCE.factions) as GeoJSONSource).setData(newData);
              dataSwapped = true;
            }
            const fadeIn = FACTION_FILL_OPACITY * ((t - 0.5) * 2);
            this.map.setPaintProperty(fillLayer, 'fill-opacity', fadeIn);
            this.map.setPaintProperty(outlineLayer, 'line-opacity', 0.8 * ((t - 0.5) * 2));
          }
        }

        if (t < 1) {
          this.fadeAnimFrame = requestAnimationFrame(animate);
        } else {
          this.map.setPaintProperty(fillLayer, 'fill-opacity', FACTION_FILL_OPACITY);
          this.map.setPaintProperty(outlineLayer, 'line-opacity', 0.8);
          this.fadeAnimFrame = null;
          resolve();
        }
      };

      this.fadeAnimFrame = requestAnimationFrame(animate);
    });
  }

  /** 设置行军路线并启动粒子流动动画 */
  setRoutes(data: GeoJSON.FeatureCollection): void {
    if (!this.map.getSource(SOURCE.routes)) {
      this.addGeoJSONSource(SOURCE.routes, data);
      this.addRouteLayers();
    } else {
      (this.map.getSource(SOURCE.routes) as GeoJSONSource).setData(data);
    }
    this.startRouteAnimation();
  }

  clearRoutes(): void {
    this.stopRouteAnimation();
    if (this.map.getSource(SOURCE.routes)) {
      (this.map.getSource(SOURCE.routes) as GeoJSONSource).setData(
        toFeatureCollection([]),
      );
    }
  }

  setHighlights(data: GeoJSON.FeatureCollection): void {
    if (!this.map.getSource(SOURCE.highlights)) {
      this.addGeoJSONSource(SOURCE.highlights, data);
      this.map.addLayer({
        id: 'battle-highlight',
        type: 'fill',
        source: SOURCE.highlights,
        paint: {
          'fill-color': '#e74c3c',
          'fill-opacity': 0.25,
        },
      });
      this.map.addLayer({
        id: 'battle-highlight-outline',
        type: 'line',
        source: SOURCE.highlights,
        paint: {
          'line-color': '#e74c3c',
          'line-width': 2,
          'line-dasharray': [4, 2],
          'line-opacity': 0.8,
        },
      });
    } else {
      (this.map.getSource(SOURCE.highlights) as GeoJSONSource).setData(data);
    }
  }

  clearHighlights(): void {
    if (this.map.getSource(SOURCE.highlights)) {
      (this.map.getSource(SOURCE.highlights) as GeoJSONSource).setData(
        toFeatureCollection([]),
      );
    }
  }

  /** 添加路线图层（底线 + 流动虚线模拟粒子） */
  private addRouteLayers(): void {
    const factionColorExpr: ExpressionSpecification = [
      'match',
      ['get', 'faction'],
      'wei', FACTION_COLORS.wei,
      'shu', FACTION_COLORS.shu,
      'wu', FACTION_COLORS.wu,
      'qunxiong', FACTION_COLORS.qunxiong,
      'han', FACTION_COLORS.han,
      '#ffffff',
    ];

    this.map.addLayer({
      id: 'routes-base',
      type: 'line',
      source: SOURCE.routes,
      paint: {
        'line-color': factionColorExpr,
        'line-width': 3,
        'line-opacity': 0.4,
      },
    });

    this.map.addLayer({
      id: 'routes-flow',
      type: 'line',
      source: SOURCE.routes,
      paint: {
        'line-color': '#ffffff',
        'line-width': 2,
        'line-opacity': 0.9,
        'line-dasharray': [0, 2, 4],
      },
    });
  }

  private startRouteAnimation(): void {
    this.stopRouteAnimation();
    const animate = () => {
      this.dashOffset = (this.dashOffset + 0.15) % 6;
      if (this.map.getLayer('routes-flow')) {
        this.map.setPaintProperty('routes-flow', 'line-dasharray', [
          this.dashOffset,
          2,
          4,
        ]);
      }
      this.particleAnimFrame = requestAnimationFrame(animate);
    };
    this.particleAnimFrame = requestAnimationFrame(animate);
  }

  private stopRouteAnimation(): void {
    if (this.particleAnimFrame) {
      cancelAnimationFrame(this.particleAnimFrame);
      this.particleAnimFrame = null;
    }
  }

  setLayerVisibility(layerId: LayerId, visible: boolean): void {
    const visibility = visible ? 'visible' : 'none';
    const layerGroups: Record<LayerId, string[]> = {
      cities: ['cities-glow', 'cities-circle', 'cities-label'],
      rivers: ['rivers-line', 'rivers-label'],
      factions: ['factions-fill', 'factions-outline'],
      routes: ['routes-base', 'routes-flow'],
    };

    for (const id of layerGroups[layerId]) {
      if (this.map.getLayer(id)) {
        this.map.setLayoutProperty(id, 'visibility', visibility);
      }
    }
  }

  highlightCity(cityId: string, faction: FactionId): void {
    if (this.map.getLayer('cities-circle')) {
      this.map.setPaintProperty('cities-circle', 'circle-color', [
        'case',
        ['==', ['get', 'id'], cityId],
        FACTION_COLORS[faction],
        '#f0dcc0',
      ]);
    }
  }

  resetCityStyles(): void {
    if (this.map.getLayer('cities-circle')) {
      this.map.setPaintProperty('cities-circle', 'circle-color', '#f0dcc0');
    }
  }

  private addGeoJSONSource(
    id: string,
    data: GeoJSON.FeatureCollection,
  ): void {
    this.map.addSource(id, { type: 'geojson', data });
  }

  destroy(): void {
    this.stopRouteAnimation();
    if (this.fadeAnimFrame) cancelAnimationFrame(this.fadeAnimFrame);
  }
}
