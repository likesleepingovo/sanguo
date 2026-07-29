/** 应用模式 */
export type AppMode = 'timeline' | 'battle';

/** 势力标识 */
export type FactionId = 'wei' | 'shu' | 'wu' | 'qunxiong' | 'han';

/** 图层标识 */
export type LayerId = 'cities' | 'rivers' | 'factions' | 'routes';

/** 历史事件 */
export interface HistoricalEvent {
  year: number;
  title: string;
  description: string;
}

/** 城池属性 */
export interface CityProperties {
  id: string;
  name: string;
  faction: string;
  importance: 'capital' | 'major' | 'battlefield';
  description: string;
  events: string[];
}

/** 势力 GeoJSON 索引：年份 -> FeatureCollection */
export type FactionIndex = Record<string, GeoJSON.FeatureCollection>;

/** 战役阶段 */
export interface BattlePhase {
  title: string;
  text: string;
  routes: BattleRoute[];
  highlights: GeoJSON.Polygon[];
  occupations: { cityId: string; faction: FactionId }[];
}

/** 行军路线 */
export interface BattleRoute {
  id: string;
  faction: FactionId;
  coordinates: [number, number][];
}

/** 战役定义 */
export interface BattleDefinition {
  id: string;
  name: string;
  year: number;
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
  phases: BattlePhase[];
}

/** 势力配色 */
export const FACTION_COLORS: Record<FactionId, string> = {
  wei: '#4a90d9',
  shu: '#c0392b',
  wu: '#27ae60',
  qunxiong: '#9b59b6',
  han: '#d4a574',
};

/** 势力填充透明度 */
export const FACTION_FILL_OPACITY = 0.35;
