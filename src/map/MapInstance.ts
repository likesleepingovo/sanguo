import maplibregl from 'maplibre-gl';

/** 地图默认视角：中国中部，略倾斜以展示 3D 地形 */
const DEFAULT_CENTER: [number, number] = [110.5, 34.0];
const DEFAULT_ZOOM = 4.8;
const DEFAULT_PITCH = 45;

/**
 * MapInstance — 地图实例封装
 * 负责初始化 MapLibre 地图、3D 地形、底图与基础控件
 */
export class MapInstance {
  readonly map: maplibregl.Map;
  private readyPromise: Promise<void>;
  private resolveReady!: () => void;

  constructor(container: string | HTMLElement) {
    this.readyPromise = new Promise((resolve) => {
      this.resolveReady = resolve;
    });

    this.map = new maplibregl.Map({
      container,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      pitch: DEFAULT_PITCH,
      bearing: -5,
      maxPitch: 85,
      antialias: true,
      style: this.buildBaseStyle(),
    });

    this.map.addControl(new maplibregl.NavigationControl(), 'top-right');
    this.map.addControl(
      new maplibregl.TerrainControl({
        source: 'terrain-dem',
        exaggeration: 1.5,
      }),
    );

    this.map.on('load', () => {
      this.resolveReady();
    });
  }

  /** 等待地图加载完成 */
  whenReady(): Promise<void> {
    return this.readyPromise;
  }

  /** 飞行到指定视角 */
  flyTo(options: {
    center: [number, number];
    zoom?: number;
    pitch?: number;
    bearing?: number;
    duration?: number;
  }): void {
    this.map.flyTo({
      center: options.center,
      zoom: options.zoom ?? this.map.getZoom(),
      pitch: options.pitch ?? this.map.getPitch(),
      bearing: options.bearing ?? this.map.getBearing(),
      duration: options.duration ?? 2500,
      essential: true,
    });
  }

  /** 重置到默认全局视角 */
  resetView(): void {
    this.flyTo({
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      pitch: DEFAULT_PITCH,
      bearing: -5,
    });
  }

  /**
   * 构建底图样式
   * - 卫星影像：Esri World Imagery（免费公开）
   * - 高程 DEM：MapLibre demo tiles / Mapterhorn（免费开源）
   */
  private buildBaseStyle(): maplibregl.StyleSpecification {
    return {
      version: 8,
      name: 'Sanguo Terrain',
      sources: {
        // Esri 世界影像（免费，无需 key）
        'satellite': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          attribution:
            '© Esri, Maxar, Earthstar Geographics | © OpenStreetMap contributors',
          maxzoom: 18,
        },
        // 3D 地形高程（MapLibre 官方 demo，免费）
        'terrain-dem': {
          type: 'raster-dem',
          url: 'https://demotiles.maplibre.org/terrain-tiles/tiles.json',
          tileSize: 256,
        },
        // 山体阴影同源
        'hillshade-dem': {
          type: 'raster-dem',
          url: 'https://demotiles.maplibre.org/terrain-tiles/tiles.json',
          tileSize: 256,
        },
      },
      layers: [
        {
          id: 'satellite-layer',
          type: 'raster',
          source: 'satellite',
        },
        {
          id: 'hillshade-layer',
          type: 'hillshade',
          source: 'hillshade-dem',
          layout: { visibility: 'visible' },
          paint: {
            'hillshade-shadow-color': '#1a1510',
            'hillshade-highlight-color': '#8b7355',
            'hillshade-accent-color': '#4a3f35',
            'hillshade-exaggeration': 0.4,
          },
        },
      ],
      terrain: {
        source: 'terrain-dem',
        exaggeration: 1.5,
      },
      sky: {
        'sky-color': '#1a1a2e',
        'horizon-color': '#2d2d44',
        'fog-color': '#1a1a2e',
        'fog-ground-blend': 0.6,
      },
    };
  }
}
