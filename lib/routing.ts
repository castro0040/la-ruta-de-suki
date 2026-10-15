export type RouteMode = "car" | "foot";

export type Route = {
  cafeId: string;
  mode: RouteMode;
  /** puntos [lat, lng] de la ruta */
  coords: [number, number][];
  /** metros */
  distance: number;
  /** segundos */
  duration: number;
};

/**
 * Servidores públicos y gratuitos de rutas basados en OpenStreetMap (OSRM).
 * Son para uso ligero. Si la app crece mucho, cambia estas direcciones por las de un
 * servicio con llave gratuita (por ejemplo OpenRouteService) o por tu propio servidor.
 * Se prueban en orden: si el primero falla, se intenta el siguiente.
 */
const BASES: Record<RouteMode, string[]> = {
  car: [
    "https://routing.openstreetmap.de/routed-car/route/v1/driving",
    "https://router.project-osrm.org/route/v1/driving",
  ],
  foot: [
    "https://routing.openstreetmap.de/routed-foot/route/v1/foot",
    "https://routing.openstreetmap.de/routed-foot/route/v1/driving",
  ],
};

const WALK_SPEED = 1.35; // m/s, unos 4.9 km/h

export async function fetchRoute(
  from: [number, number],
  to: [number, number],
  mode: RouteMode
): Promise<{ coords: [number, number][]; distance: number; duration: number }> {
  const path = `${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
  let last = "sin respuesta";
  for (const base of BASES[mode]) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 10000);
    try {
      const res = await fetch(`${base}/${path}`, { signal: ctl.signal });
      if (!res.ok) {
        last = `error ${res.status}`;
        continue;
      }
      const j = await res.json();
      const r = j?.routes?.[0];
      const pts = r?.geometry?.coordinates as [number, number][] | undefined;
      if (j?.code !== "Ok" || !pts || pts.length < 2) {
        last = j?.code === "NoRoute" ? "no hay camino entre los dos puntos" : String(j?.code || "sin ruta");
        continue;
      }
      const distance = Number(r.distance);
      return {
        coords: pts.map(([lng, lat]) => [lat, lng] as [number, number]),
        distance,
        // A pie se calcula con una velocidad fija: es más confiable que el tiempo que devuelve el servidor.
        duration: mode === "foot" ? distance / WALK_SPEED : Number(r.duration),
      };
    } catch (e) {
      last = e instanceof Error && e.name === "AbortError" ? "tardó demasiado" : "no se pudo conectar";
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`No pudimos calcular la ruta (${last}). Usa uno de los botones de abajo para abrirla en tu app de mapas.`);
}

export const mapLinks = (lat: number, lng: number) => ({
  google: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
  waze: `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`,
  apple: `https://maps.apple.com/?daddr=${lat},${lng}`,
});

export const durText = (s: number) =>
  s < 3600 ? `${Math.max(1, Math.round(s / 60))} min` : `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min`;
