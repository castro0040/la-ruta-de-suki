// Importa las cafeterías de Tijuana desde OpenStreetMap y genera un archivo SQL.
//
//   node scripts/import-osm.mjs                 descarga los datos y escribe supabase/import-osm.sql
//   node scripts/import-osm.mjs --file x.json   usa un archivo ya descargado (resultado de Overpass)
//   node scripts/import-osm.mjs --out ruta.sql  elige dónde escribir el SQL
//
// Después pega el contenido de supabase/import-osm.sql en Supabase > SQL Editor y presiona Run.
// Es seguro repetirlo: las cafeterías que ya existen se omiten (no se duplican).

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

// Zona de Tijuana (sur, oeste, norte, este) limitada a México para no traer cafeterías de San Diego.
const QUERY = `[out:json][timeout:90];
area["ISO3166-1"="MX"]->.mx;
(
  node["amenity"="cafe"](32.42,-117.14,32.56,-116.80)(area.mx);
  way["amenity"="cafe"](32.42,-117.14,32.56,-116.80)(area.mx);
);
out center tags;`;

const BARRIOS = {
  Centro: [32.533, -117.0385],
  "Zona Río": [32.5272, -117.0195],
  Cacho: [32.5195, -117.029],
  Chapultepec: [32.509, -117.0035],
  Otay: [32.537, -116.97],
  Playas: [32.5262, -117.118],
};

/* ---------- horarios (formato opening_hours de OSM) ---------- */

const OSM_DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const DAYMAP = { Mo: "lun", Tu: "mar", We: "mie", Th: "jue", Fr: "vie", Sa: "sab", Su: "dom" };
const DAY = "(?:Mo|Tu|We|Th|Fr|Sa|Su)";
const DAYSPEC = new RegExp(`^(${DAY}(?:\\s*-\\s*${DAY})?(?:\\s*,\\s*${DAY}(?:\\s*-\\s*${DAY})?)*)\\s+(.+)$`);

function expandDays(spec) {
  const out = [];
  for (const part of spec.split(",")) {
    const m = part.trim().match(new RegExp(`^(${DAY})(?:\\s*-\\s*(${DAY}))?$`));
    if (!m) return null;
    const a = OSM_DAYS.indexOf(m[1]);
    const b = m[2] ? OSM_DAYS.indexOf(m[2]) : a;
    let i = a;
    for (let n = 0; n < 7; n++) {
      out.push(OSM_DAYS[i]);
      if (i === b) break;
      i = (i + 1) % 7;
    }
  }
  return out;
}

const normTime = (t) => {
  const [h, m] = t.split(":");
  const hh = Number(h) === 24 ? 0 : Number(h);
  return String(hh).padStart(2, "0") + ":" + m;
};

/** Convierte "Mo-Fr 08:00-20:00; Sa 09:00-14:00; Su off" a { lun:{o,c}, ..., dom:null }.
 *  Lo que no se entiende (varios turnos, salida del sol, etc.) se deja sin dato en vez de inventarlo. */
export function parseHours(raw) {
  if (!raw || typeof raw !== "string") return {};
  const s = raw.trim();
  const hours = {};
  if (s === "24/7") {
    for (const d of OSM_DAYS) hours[DAYMAP[d]] = { o: "00:00", c: "23:59" };
    return hours;
  }
  for (const seg of s.split(";")) {
    const t = seg.trim();
    if (!t || /^(PH|SH)\b/.test(t)) continue; // feriados y vacaciones
    const m = t.match(DAYSPEC);
    let days;
    let rest;
    if (m) {
      days = expandDays(m[1]);
      rest = m[2].trim();
    } else {
      days = [...OSM_DAYS];
      rest = t;
    }
    if (!days) return {};
    if (/^(off|closed)$/i.test(rest)) {
      for (const d of days) hours[DAYMAP[d]] = null;
      continue;
    }
    const tm = rest.match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
    if (!tm) continue;
    for (const d of days) hours[DAYMAP[d]] = { o: normTime(tm[1]), c: normTime(tm[2]) };
  }
  return hours;
}

/* ---------- datos de contacto y etiquetas ---------- */

const clean = (v, max) => {
  if (v == null) return null;
  const s = String(v).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : null;
};

function cleanPhone(v) {
  if (!v) return null;
  const first = String(v).split(";")[0].trim();
  return /^[0-9+()\s-]{7,20}$/.test(first) ? first : null;
}

function cleanWeb(v) {
  if (!v) return null;
  let w = String(v).split(";")[0].trim();
  if (/^www\./i.test(w)) w = "https://" + w;
  return /^https?:\/\/[^\s]+$/i.test(w) && w.length <= 200 ? w : null;
}

function cleanInstagram(v) {
  if (!v) return null;
  const h = String(v)
    .split(";")[0]
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/[/?].*$/, "");
  return /^[A-Za-z0-9._]{1,30}$/.test(h) ? h : null;
}

function mapTags(t) {
  const out = [];
  if (/^(wlan|yes|wifi)$/i.test(t.internet_access || "")) out.push("Wifi");
  if (t.outdoor_seating === "yes") out.push("Terraza");
  if (/^(yes|leashed)$/i.test(t.dog || "")) out.push("Pet friendly");
  if (/^(yes|only)$/i.test(t["diet:vegan"] || "")) out.push("Vegano");
  if (/(cake|pastry|dessert|ice_cream|donut)/i.test(t.cuisine || "")) out.push("Postres");
  return out;
}

function distKm(a, b) {
  const R = 6371;
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function nearestBarrio(lat, lng) {
  let best = null;
  let bd = 3; // a más de 3 km de las zonas conocidas se deja como "Otra zona"
  for (const [name, c] of Object.entries(BARRIOS)) {
    const d = distKm([lat, lng], c);
    if (d < bd) {
      bd = d;
      best = name;
    }
  }
  return best;
}

/** Convierte un elemento de Overpass en una fila de la tabla cafes, o null si no sirve. */
export function rowFromElement(el) {
  const t = el.tags || {};
  const name = clean(t.name, 80);
  if (!name || name.length < 2) return null;
  const lat = el.type === "node" ? el.lat : el.center && el.center.lat;
  const lng = el.type === "node" ? el.lon : el.center && el.center.lon;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const street = [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(" ");
  const address = clean([street, t["addr:suburb"]].filter(Boolean).join(", "), 160);
  return {
    name,
    address,
    barrio: nearestBarrio(lat, lng),
    lat: Math.round(lat * 1e6) / 1e6,
    lng: Math.round(lng * 1e6) / 1e6,
    hours: parseHours(t.opening_hours),
    tags: mapTags(t),
    description: clean(t.description, 600),
    phone: cleanPhone(t.phone || t["contact:phone"]),
    instagram: cleanInstagram(t["contact:instagram"] || t.instagram),
    website: cleanWeb(t.website || t["contact:website"] || t.url),
    osm_id: `${el.type}/${el.id}`,
  };
}

/* ---------- SQL ---------- */

const q = (v) => (v == null ? "null" : "'" + String(v).replace(/'/g, "''") + "'");
const arr = (a) => (a.length ? "array[" + a.map(q).join(",") + "]::text[]" : "'{}'::text[]");

export function toSql(rows) {
  const head = [
    "-- Cafeterías importadas de OpenStreetMap (© colaboradores de OpenStreetMap, licencia ODbL).",
    "-- Pégalo completo en Supabase > SQL Editor > New query y presiona Run.",
    "-- Es seguro repetirlo: lo que ya existe se omite.",
    "-- Para quitar todo lo importado:  delete from public.cafes where source = 'osm';",
    "",
  ];
  const cols =
    "insert into public.cafes (name, address, barrio, lat, lng, hours, tags, description, price, phone, instagram, website, source, osm_id, is_example) values";
  const stmts = [];
  for (let i = 0; i < rows.length; i += 100) {
    const values = rows
      .slice(i, i + 100)
      .map(
        (r) =>
          `(${q(r.name)}, ${q(r.address)}, ${q(r.barrio)}, ${r.lat}, ${r.lng}, ${q(JSON.stringify(r.hours))}::jsonb, ${arr(r.tags)}, ${q(r.description)}, 0, ${q(r.phone)}, ${q(r.instagram)}, ${q(r.website)}, 'osm', ${q(r.osm_id)}, false)`
      );
    stmts.push(`${cols}\n${values.join(",\n")}\non conflict (osm_id) do nothing;`);
  }
  return head.join("\n") + "\n" + stmts.join("\n\n") + "\n";
}

export function build(elements) {
  const rows = [];
  const seen = new Set();
  let skipped = 0;
  for (const el of elements) {
    const r = rowFromElement(el);
    if (!r || seen.has(r.osm_id)) {
      skipped++;
      continue;
    }
    seen.add(r.osm_id);
    rows.push(r);
  }
  return { rows, skipped };
}

/* ---------- ejecución ---------- */

async function download() {
  let last = "";
  for (const url of ENDPOINTS) {
    try {
      console.log("Descargando desde " + new URL(url).host + " (puede tardar hasta un minuto)...");
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "LaRutaDeSuki-import/1.0", Accept: "*/*" },
        body: "data=" + encodeURIComponent(QUERY),
      });
      if (!res.ok) {
        last = `${res.status} ${res.statusText}`;
        continue;
      }
      return await res.json();
    } catch (e) {
      last = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(
    "No se pudieron descargar los datos (" + last + "). Revisa tu internet y vuelve a intentar en unos minutos; los servidores gratuitos a veces están ocupados."
  );
}

async function main() {
  const args = process.argv.slice(2);
  const get = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : null);
  const file = get("--file");
  const out = get("--out") || join(dirname(fileURLToPath(import.meta.url)), "..", "supabase", "import-osm.sql");

  const data = file ? JSON.parse(readFileSync(file, "utf8")) : await download();
  const { rows, skipped } = build(data.elements || []);
  if (!rows.length) {
    console.error("No se encontraron cafeterías con nombre. No se escribió ningún archivo.");
    process.exit(1);
  }
  writeFileSync(out, toSql(rows), "utf8");

  const withHours = rows.filter((r) => Object.keys(r.hours).length).length;
  console.log(`\nListo. ${rows.length} cafeterías guardadas en:\n  ${out}`);
  console.log(`  con horario: ${withHours} · con teléfono: ${rows.filter((r) => r.phone).length} · con sitio web: ${rows.filter((r) => r.website).length}`);
  console.log(`  omitidas (sin nombre o repetidas): ${skipped}`);
  console.log("\nSiguiente paso: abre ese archivo, copia todo y pégalo en Supabase > SQL Editor > New query > Run.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
