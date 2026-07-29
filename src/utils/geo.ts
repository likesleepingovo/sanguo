/**
 * 地理计算工具
 */

/** 哈弗辛公式计算两点间距离（公里） */
export function haversineDistance(
  a: [number, number],
  b: [number, number],
): number {
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

/** 计算折线总长度（公里） */
export function polylineLength(coords: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += haversineDistance(coords[i - 1], coords[i]);
  }
  return total;
}

/** 从年份列表中找到最接近的年份键 */
export function nearestYearKey(year: number, keys: number[]): number {
  if (keys.length === 0) return year;
  return keys.reduce((prev, curr) =>
    Math.abs(curr - year) < Math.abs(prev - year) ? curr : prev,
  );
}

/** 异步加载 JSON 数据 */
export async function loadJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return res.json() as Promise<T>;
}

/** 创建 GeoJSON FeatureCollection */
export function toFeatureCollection(
  features: GeoJSON.Feature[],
): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features };
}

/** 将战役路线转为 GeoJSON LineString 要素 */
export function routesToGeoJSON(
  routes: { id: string; faction: string; coordinates: [number, number][] }[],
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: routes.map((r) => ({
      type: 'Feature',
      properties: { id: r.id, faction: r.faction },
      geometry: { type: 'LineString', coordinates: r.coordinates },
    })),
  };
}

/** 将高亮区域转为 GeoJSON */
export function highlightsToGeoJSON(
  highlights: { type: string; coordinates: number[][][] }[],
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: highlights.map((h, i) => ({
      type: 'Feature',
      properties: { id: `highlight-${i}` },
      geometry: h as GeoJSON.Polygon,
    })),
  };
}
