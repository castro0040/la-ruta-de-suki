export type Group<T> = { items: T[]; lat: number; lng: number };

/**
 * Agrupa puntos cercanos. Divide el mapa en una cuadrícula de `cell` píxeles (al zoom actual)
 * y junta los puntos que caen en la misma celda. `project` convierte lat/lng a píxeles.
 * El centro de cada grupo es el promedio de sus puntos.
 */
export function groupByGrid<T extends { lat: number; lng: number }>(
  items: T[],
  project: (lat: number, lng: number) => { x: number; y: number },
  cell: number
): Group<T>[] {
  const cells = new Map<string, T[]>();
  for (const it of items) {
    const p = project(it.lat, it.lng);
    const key = `${Math.floor(p.x / cell)},${Math.floor(p.y / cell)}`;
    const list = cells.get(key);
    if (list) list.push(it);
    else cells.set(key, [it]);
  }
  const out: Group<T>[] = [];
  cells.forEach((list) => {
    let la = 0;
    let ln = 0;
    for (const it of list) {
      la += it.lat;
      ln += it.lng;
    }
    out.push({ items: list, lat: la / list.length, lng: ln / list.length });
  });
  return out;
}
