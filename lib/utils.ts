import type { Cafe, DayKey, Draft, DraftHours } from "./types";

export const CENTER: [number, number] = [32.5149, -117.0382];

export const BARRIOS: Record<string, [number, number]> = {
  Centro: [32.533, -117.0385],
  "Zona Río": [32.5272, -117.0195],
  Cacho: [32.5195, -117.029],
  Chapultepec: [32.509, -117.0035],
  Otay: [32.537, -116.97],
  Playas: [32.5262, -117.118],
};

export const TAGS = ["Café de especialidad", "Wifi", "Para trabajar", "Pet friendly", "Postres", "Terraza", "Vegano"];
export const DAYS: DayKey[] = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"];
export const ORDER: DayKey[] = ["lun", "mar", "mie", "jue", "vie", "sab", "dom"];
export const DAYN: Record<DayKey, string> = {
  lun: "Lunes", mar: "Martes", mie: "Miércoles", jue: "Jueves", vie: "Viernes", sab: "Sábado", dom: "Domingo",
};
export const REASONS = ["Spam o publicidad", "Lenguaje ofensivo", "No es de esta cafetería", "Información falsa", "Otro motivo"];
export const PRICEHINT = "Precio de un café: $ menos de $50 · $$ $50–80 · $$$ $80–120 · $$$$ más de $120";

const mins = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

export const fmt = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")}${h < 12 ? " a. m." : " p. m."}`;
};

export type OpenState = { open: boolean; until?: string; opens?: string; unknown?: boolean };

/** true si la cafetería tiene al menos un día con horario */
export function hasHours(c: Pick<Cafe, "hours">): boolean {
  return ORDER.some((d) => {
    const h = c.hours?.[d];
    return !!(h && h.o && h.c);
  });
}

export function openState(c: Pick<Cafe, "hours">, now = new Date()): OpenState {
  if (!hasHours(c)) return { open: false, unknown: true };
  const d = now.getDay();
  const cur = now.getHours() * 60 + now.getMinutes();
  const today = c.hours?.[DAYS[d]];
  const prev = c.hours?.[DAYS[(d + 6) % 7]];
  if (prev && prev.o && prev.c) {
    const o = mins(prev.o), cl = mins(prev.c);
    if (cl <= o && cur < cl) return { open: true, until: prev.c };
  }
  if (today && today.o && today.c) {
    const o = mins(today.o), cl = mins(today.c);
    if (cl > o) {
      if (cur >= o && cur < cl) return { open: true, until: today.c };
      if (cur < o) return { open: false, opens: today.o };
    } else {
      if (cur >= o) return { open: true, until: today.c };
      if (cur < o) return { open: false, opens: today.o };
    }
  }
  return { open: false };
}

export const stateText = (s: OpenState) =>
  s.unknown ? "Sin horario" : s.open ? `Abierto · cierra ${fmt(s.until!)}` : s.opens ? `Cerrado · abre ${fmt(s.opens)}` : "Cerrado";

export const starStr = (v: number) => "★".repeat(Math.round(v)) + "☆".repeat(5 - Math.round(v));

export const safeIg = (v: string) => {
  const h = (v || "")
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/\/+$/, "");
  return /^[A-Za-z0-9._]{1,30}$/.test(h) ? h : "";
};
export const safeWeb = (v: string | null) => (/^https?:\/\/[^\s]+$/i.test(v || "") ? (v as string) : "");
export const safePhone = (v: string | null) => (/^[0-9+()\s-]{7,20}$/.test(v || "") ? (v as string) : "");

export function km(a: [number, number], b: [number, number]) {
  const R = 6371;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const kmText = (v: number) => (v < 1 ? `${Math.round(v * 10) * 100} m` : `${v.toFixed(1)} km`);

/** Reduce una foto a máximo 1280 px y la convierte a JPEG para ahorrar espacio. */
export function shrinkImage(file: File, max = 1280): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo leer la foto"))), "image/jpeg", 0.82);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Ese archivo no es una imagen válida"));
    };
    img.src = url;
  });
}

export function emptyHours(): DraftHours {
  const h = {} as DraftHours;
  for (const d of ORDER) h[d] = { closed: false, o: "08:00", c: "20:00" };
  return h;
}

export function newDraft(): Draft {
  return {
    id: null, name: "", address: "", barrio: "Centro",
    lat: BARRIOS.Centro[0], lng: BARRIOS.Centro[1], pinned: false,
    description: "", tags: [], price: 0, phone: "", instagram: "", website: "", drinks: "",
    hours: emptyHours(), photos: [], menu: [], file: null, menuFiles: [],
  };
}

export function draftFromCafe(c: Cafe): Draft {
  const hours = emptyHours();
  for (const d of ORDER) {
    const h = c.hours?.[d];
    hours[d] = h && h.o && h.c ? { closed: false, o: h.o, c: h.c } : { closed: true, o: "08:00", c: "20:00" };
  }
  return {
    id: c.id, name: c.name, address: c.address || "", barrio: c.barrio ?? "",
    lat: c.lat, lng: c.lng, pinned: true, description: c.description || "", tags: [...c.tags],
    price: c.price, phone: c.phone || "", instagram: c.instagram || "", website: c.website || "",
    drinks: c.drinks || "", hours, photos: [...c.photos], menu: [...c.menu], file: null, menuFiles: [],
  };
}
