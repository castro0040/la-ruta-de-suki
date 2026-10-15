"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Cafe } from "@/lib/types";
import { CENTER, openState } from "@/lib/utils";

const pinSvg = (color: string, w: number) =>
  `<svg width="${w}" height="${Math.round(w * 1.36)}" viewBox="-14 -37 28 38" xmlns="http://www.w3.org/2000/svg">` +
  `<path d="M0 0C-8-10-13-16-13-23a13 13 0 1 1 26 0c0 7-5 13-13 23z" fill="${color}" stroke="#15181C" stroke-width="1.5"/>` +
  `<path d="M-6-27h9v5a4.5 4.5 0 0 1-4.5 4.5h0A4.5 4.5 0 0 1-6-22zM3-26h2a2.5 2.5 0 0 1 0 5H3" fill="none" stroke="#0B1220" stroke-width="1.8" stroke-linecap="round"/>` +
  `</svg>`;

function pinIcon(color: string, w: number) {
  const h = Math.round(w * 1.36);
  return L.divIcon({ className: "pinicon", html: pinSvg(color, w), iconSize: [w, h], iconAnchor: [w / 2, h] });
}

export type FlyTarget = { lat: number; lng: number; zoom: number; key: number } | null;

type Props = {
  cafes: Cafe[];
  selId: string | null;
  onSelect: (id: string) => void;
  placing: boolean;
  pin: { lat: number; lng: number } | null;
  onPick: (lat: number, lng: number) => void;
  fly: FlyTarget;
  userLoc: [number, number] | null;
  route: [number, number][] | null;
  follow: boolean;
};

export default function MapView({ cafes, selId, onSelect, placing, pin, onPick, fly, userLoc, route, follow }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const userDot = useRef<L.CircleMarker | null>(null);
  const markers = useRef<L.LayerGroup | null>(null);
  const extra = useRef<L.LayerGroup | null>(null);
  const routeLayer = useRef<L.LayerGroup | null>(null);
  const placingRef = useRef(placing);
  const pickRef = useRef(onPick);
  const selectRef = useRef(onSelect);
  placingRef.current = placing;
  pickRef.current = onPick;
  selectRef.current = onSelect;

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: false }).setView(CENTER, 12);
    L.control.zoom({ position: "topright" }).addTo(m);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m);
    routeLayer.current = L.layerGroup().addTo(m);
    markers.current = L.layerGroup().addTo(m);
    extra.current = L.layerGroup().addTo(m);
    m.on("click", (e: L.LeafletMouseEvent) => {
      if (placingRef.current) pickRef.current(e.latlng.lat, e.latlng.lng);
    });
    map.current = m;
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
      userDot.current = null;
    };
  }, []);

  // Pines de cafeterías
  useEffect(() => {
    const g = markers.current;
    if (!g) return;
    g.clearLayers();
    for (const c of cafes) {
      const sel = c.id === selId;
      const open = openState(c).open;
      const mk = L.marker([c.lat, c.lng], {
        icon: pinIcon(open ? "#81C995" : "#80868B", sel ? 36 : 28),
        zIndexOffset: sel ? 1000 : 0,
        title: c.name,
      });
      mk.bindTooltip(c.name, { direction: "right", offset: [12, -24], className: "cafe-tip", permanent: sel });
      mk.on("click", () => selectRef.current(c.id));
      mk.addTo(g);
    }
  }, [cafes, selId]);

  // Pin temporal al agregar o editar
  useEffect(() => {
    const g = extra.current;
    if (!g) return;
    g.clearLayers();
    if (placing && pin) L.marker([pin.lat, pin.lng], { icon: pinIcon("#FDD663", 36), zIndexOffset: 2000 }).addTo(g);
  }, [placing, pin]);

  // Punto azul con la ubicación del usuario (se mueve sin redibujar todo)
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!userLoc) {
      userDot.current?.remove();
      userDot.current = null;
      return;
    }
    if (userDot.current) userDot.current.setLatLng(userLoc);
    else
      userDot.current = L.circleMarker(userLoc, {
        radius: 8, color: "#fff", weight: 2, fillColor: "#8AB4F8", fillOpacity: 1, interactive: false,
      }).addTo(m);
  }, [userLoc]);

  // Con "Seguir mi ubicación" activo, el mapa se mueve solo cuando el punto se acerca al borde.
  useEffect(() => {
    const m = map.current;
    if (!follow || !userLoc || !m) return;
    if (!m.getBounds().pad(-0.25).contains(userLoc)) m.panTo(userLoc);
  }, [userLoc, follow]);

  // Ruta dibujada hasta la cafetería
  useEffect(() => {
    const g = routeLayer.current;
    const m = map.current;
    if (!g || !m) return;
    g.clearLayers();
    if (route && route.length > 1) {
      const line = L.polyline(route, { color: "#8AB4F8", weight: 5, opacity: 0.9 }).addTo(g);
      // En el celular el mapa puede estar oculto un instante: se espera a que tenga tamaño.
      requestAnimationFrame(() => {
        m.invalidateSize();
        m.fitBounds(line.getBounds(), { padding: [50, 50] });
      });
    }
  }, [route]);

  useEffect(() => {
    if (fly && map.current) map.current.flyTo([fly.lat, fly.lng], fly.zoom, { duration: 0.7 });
  }, [fly]);

  return <div ref={el} id="map" role="application" aria-label="Mapa de cafeterías de Tijuana" style={{ cursor: placing ? "crosshair" : undefined }} />;
}
