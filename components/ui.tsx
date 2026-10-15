"use client";

import { useState } from "react";
import type { Cafe, Review } from "@/lib/types";
import { useApp } from "@/lib/ctx";
import { REASONS, kmText, openState, starStr, stateText, PRICEHINT } from "@/lib/utils";
import { photoUrl } from "@/lib/supabase";

export function Price({ p }: { p: number }) {
  if (!p) return null;
  return (
    <span className="price" title={PRICEHINT}>
      {"$".repeat(p)}
      <i>{"$".repeat(4 - p)}</i>
    </span>
  );
}

export function Stars({ v, n }: { v: number; n?: number }) {
  return (
    <span className="stars">
      {starStr(v)} {v.toFixed(1)}
      {n !== undefined ? ` (${n})` : ""}
    </span>
  );
}

export function Lightbox({ src, onClose }: { src: string | null; onClose: () => void }) {
  if (!src) return null;
  return (
    <div className="lightbox" onClick={onClose} role="dialog" aria-label="Foto ampliada">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Foto ampliada" />
    </div>
  );
}

export function CafeCard({ cafe }: { cafe: Cafe }) {
  const { stats, favs, select, distanceTo } = useApp();
  const s = stats(cafe.id);
  const st = openState(cafe);
  const f = favs[cafe.id];
  const d = distanceTo(cafe);
  return (
    <button className="card" type="button" onClick={() => select(cafe.id)}>
      <div className="nm">{cafe.name}</div>
      <div className="meta">
        <span>{cafe.barrio || "Tijuana"}</span>
        <Price p={cafe.price} />
        {s.n ? <Stars v={s.avg} n={s.n} /> : <span>Sin reseñas aún</span>}
        <span className={"pill " + (st.open ? "on" : "off")}>{stateText(st)}</span>
        {d !== null && <span className="pill near">a {kmText(d)}</span>}
        {f && <span className="pill fav">{f === "been" ? "Ya fui" : "Quiero ir"}</span>}
        {cafe.is_example && <span className="pill ex">Ejemplo</span>}
        {cafe.source === "osm" && <span className="pill ex" title="Datos importados de OpenStreetMap">OpenStreetMap</span>}
      </div>
      <div className="tagrow">
        {cafe.tags.slice(0, 4).map((t) => (
          <span className="tag" key={t}>{t}</span>
        ))}
      </div>
    </button>
  );
}

/** Una reseña. `showWho` muestra el autor (en la ficha); si no, muestra el nombre de la cafetería (en el perfil). */
export function ReviewItem({ r, showWho }: { r: Review; showWho: boolean }) {
  const { user, isAdmin, nameOf, cafes, go, select, myReports, deleteReview, reportReview } = useApp();
  const [confirm, setConfirm] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [busy, setBusy] = useState(false);
  const mine = user?.id === r.user_id;
  const cafe = cafes.find((c) => c.id === r.cafe_id);
  const reported = myReports.has(r.id);

  return (
    <div className="review">
      <div className="meta" style={{ margin: 0 }}>
        {showWho ? (
          <button className="who" type="button" onClick={() => go("profile", { profId: r.user_id })}>{nameOf(r.user_id)}</button>
        ) : (
          <button className="who" type="button" onClick={() => select(r.cafe_id)}>{cafe?.name || "Cafetería"}</button>
        )}
        <span className="stars">{starStr(r.rating)}</span>
        <span className="when">{new Date(r.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}</span>
        <span className="acts">
          {(mine || isAdmin) && (
            <button
              className="btn ghost sm"
              type="button"
              disabled={busy}
              onClick={async () => {
                if (!confirm) return setConfirm(true);
                setBusy(true);
                await deleteReview(r.id);
              }}
            >
              {confirm ? "¿Seguro?" : "Borrar"}
            </button>
          )}
          {!mine && user && (reported ? (
            <span className="hint" style={{ padding: "6px 8px" }}>Reportada</span>
          ) : (
            <button className="btn ghost sm" type="button" onClick={() => setReporting(!reporting)}>Reportar</button>
          ))}
        </span>
      </div>
      {r.body && <p>{r.body}</p>}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {r.photo && <img src={photoUrl(r.photo)} alt="Foto de la reseña" loading="lazy" onClick={() => window.dispatchEvent(new CustomEvent("lightbox", { detail: photoUrl(r.photo!) }))} />}
      {reporting && (
        <div className="reportbox">
          <select className="field" aria-label="Motivo del reporte" value={reason} onChange={(e) => setReason(e.target.value)}>
            {REASONS.map((x) => <option key={x}>{x}</option>)}
          </select>
          <button
            className="btn sm primary"
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await reportReview(r.id, reason);
              setBusy(false);
              setReporting(false);
            }}
          >
            Enviar reporte
          </button>
          <button className="btn sm" type="button" onClick={() => setReporting(false)}>Cancelar</button>
        </div>
      )}
    </div>
  );
}

export const openLightbox = (src: string) => window.dispatchEvent(new CustomEvent("lightbox", { detail: src }));
