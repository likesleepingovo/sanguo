import type { Map as MaplibreMap, MapMouseEvent, GeoJSONSource } from 'maplibre-gl';
import type { HistoricalEvent, CityProperties, LayerId, AppMode } from '../types';

/**
 * 侧边栏 — 渲染历史事件目录
 */
export class Sidebar {
  private listEl: HTMLElement;

  constructor(onEventClick: (event: HistoricalEvent) => void) {
    this.listEl = document.getElementById('event-list')!;

    fetch('/data/events.json')
      .then((r) => r.json())
      .then((events: HistoricalEvent[]) => {
        for (const event of events) {
          const li = document.createElement('li');
          li.className = 'event-item';
          li.innerHTML = `
            <span class="event-year">${event.year}</span>
            <span class="event-title">${event.title}</span>
          `;
          li.title = event.description;
          li.addEventListener('click', () => onEventClick(event));
          this.listEl.appendChild(li);
        }
      });
  }

  setMode(mode: AppMode): void {
    const battlePanel = document.getElementById('battle-panel')!;
    battlePanel.classList.toggle('hidden', mode !== 'battle');
  }
}

/** 城池信息面板 */
export class CityPanel {
  private panel: HTMLElement;
  private nameEl: HTMLElement;
  private descEl: HTMLElement;
  private metaEl: HTMLElement;

  constructor() {
    this.panel = document.getElementById('city-panel')!;
    this.nameEl = document.getElementById('city-name')!;
    this.descEl = document.getElementById('city-desc')!;
    this.metaEl = document.getElementById('city-meta')!;

    document.getElementById('city-panel-close')!.addEventListener('click', () => {
      this.hide();
    });
  }

  show(props: CityProperties): void {
    this.nameEl.textContent = props.name;
    this.descEl.textContent = props.description;
    this.metaEl.innerHTML = `
      <dt>所属势力</dt><dd>${props.faction}</dd>
      <dt>地位</dt><dd>${this.importanceLabel(props.importance)}</dd>
      <dt>相关事件</dt><dd>${props.events.join('；')}</dd>
    `;
    this.panel.classList.remove('hidden');
  }

  hide(): void {
    this.panel.classList.add('hidden');
  }

  private importanceLabel(imp: string): string {
    const map: Record<string, string> = {
      capital: '都城',
      major: '重镇',
      battlefield: '战场',
    };
    return map[imp] ?? imp;
  }
}

/** 图层控制面板 */
export class LayerControl {
  constructor(onToggle: (layerId: LayerId, visible: boolean) => void) {
    const container = document.getElementById('layer-control')!;
    container.querySelectorAll<HTMLInputElement>('input[data-layer]').forEach((input) => {
      input.addEventListener('change', () => {
        onToggle(input.dataset.layer as LayerId, input.checked);
      });
    });
  }
}

/** 测距工具 — 点击地图测量距离 */
export class MeasureTool {
  private map: MaplibreMap;
  private active = false;
  private points: [number, number][] = [];
  private infoPanel: HTMLElement;
  private distanceEl: HTMLElement;
  private sourceId = 'measure-source';

  constructor(map: MaplibreMap) {
    this.map = map;
    this.infoPanel = document.getElementById('measure-info')!;
    this.distanceEl = document.getElementById('measure-distance')!;

    document.getElementById('measure-toggle')!.addEventListener('click', () => {
      this.toggle();
    });
    document.getElementById('measure-clear')!.addEventListener('click', () => {
      this.clear();
    });
  }

  private toggle(): void {
    this.active = !this.active;
    document.getElementById('measure-toggle')!.classList.toggle('active', this.active);
    this.map.getCanvas().style.cursor = this.active ? 'crosshair' : '';

    if (this.active) {
      this.map.on('click', this.onMapClick);
    } else {
      this.map.off('click', this.onMapClick);
    }
  }

  private onMapClick = (e: MapMouseEvent): void => {
    if (!this.active) return;
    this.points.push([e.lngLat.lng, e.lngLat.lat]);
    this.updateSource();
    this.updateDistance();
    this.infoPanel.classList.remove('hidden');
  };

  private updateSource(): void {
    const features: GeoJSON.Feature[] = [];

    if (this.points.length >= 1) {
      features.push({
        type: 'Feature',
        properties: {},
        geometry: { type: 'MultiPoint', coordinates: this.points },
      });
    }
    if (this.points.length >= 2) {
      features.push({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: this.points },
      });
    }

    const data: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features,
    };

    if (!this.map.getSource(this.sourceId)) {
      this.map.addSource(this.sourceId, { type: 'geojson', data });
      this.map.addLayer({
        id: 'measure-line',
        type: 'line',
        source: this.sourceId,
        filter: ['==', ['geometry-type'], 'LineString'],
        paint: {
          'line-color': '#f1c40f',
          'line-width': 2,
          'line-dasharray': [3, 2],
        },
      });
      this.map.addLayer({
        id: 'measure-points',
        type: 'circle',
        source: this.sourceId,
        filter: ['==', ['geometry-type'], 'MultiPoint'],
        paint: {
          'circle-radius': 5,
          'circle-color': '#f1c40f',
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 1,
        },
      });
    } else {
      (this.map.getSource(this.sourceId) as GeoJSONSource).setData(data);
    }
  }

  private updateDistance(): void {
    let total = 0;
    for (let i = 1; i < this.points.length; i++) {
      total += this.haversine(this.points[i - 1], this.points[i]);
    }
    this.distanceEl.textContent =
      total >= 1 ? `${total.toFixed(1)} km` : `${(total * 1000).toFixed(0)} m`;
  }

  private haversine(a: [number, number], b: [number, number]): number {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(b[1] - a[1]);
    const dLon = toRad(b[0] - a[0]);
    const lat1 = toRad(a[1]);
    const lat2 = toRad(b[1]);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  clear(): void {
    this.points = [];
    if (this.map.getSource(this.sourceId)) {
      (this.map.getSource(this.sourceId) as GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: [],
      });
    }
    this.distanceEl.textContent = '0 km';
    this.infoPanel.classList.add('hidden');
  }
}
