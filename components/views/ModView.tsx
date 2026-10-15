"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/lib/ctx";
import { photoUrl } from "@/lib/supabase";
import { starStr } from "@/lib/utils";
import { openLightbox } from "../ui";

export default function ModView() {
  const { isAdmin, reports, reviews, cafes, go, select, nameOf, deleteReview, dismissReports } = useApp();
  const [busy, setBusy] = useState<string | null>(null);

  const items = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const r of reports) m.set(r.review_id, [...(m.get(r.review_id) || []), r.reason]);
    return [...m.entries()]
      .map(([rid, reasons]) => ({ rid, reasons, review: reviews.find((x) => x.id === rid) }))
      .filter((x) => x.review)
      .sort((a, b) => b.reasons.length - a.reasons.length);
  }, [reports, reviews]);

  if (!isAdmin) return <div className="empty"><strong>Solo para moderadores</strong></div>;

  return (
    <>
      <button className="btn ghost" type="button" onClick={() => go("list")}>← Todas las cafeterías</button>
      <h2>Reportes de reseñas</h2>
      <p className="hint">Solo ves esto porque eres moderador. Borrar una reseña la quita para todos. Descartar el reporte la deja publicada.</p>

      {!items.length ? (
        <div className="empty">
          <strong>No hay reportes pendientes</strong>
          Cuando alguien reporte una reseña aparecerá aquí.
        </div>
      ) : (
        items.map(({ rid, reasons, review }) => {
          const r = review!;
          const cafe = cafes.find((c) => c.id === r.cafe_id);
          const counts: Record<string, number> = {};
          reasons.forEach((x) => { counts[x] = (counts[x] || 0) + 1; });
          return (
            <div className="modcard" key={rid}>
              <div className="meta" style={{ margin: 0 }}>
                <button className="who" type="button" style={{ fontWeight: 700 }} onClick={() => select(r.cafe_id)}>{cafe?.name || "Cafetería"}</button>
                <span className="stars">{starStr(r.rating)}</span>
                <span>de {nameOf(r.user_id)}</span>
              </div>
              <div className="reasons">
                {Object.entries(counts).map(([k, v]) => <span className="tag" key={k}>{k} ×{v}</span>)}
              </div>
              {r.body ? <blockquote>{r.body}</blockquote> : <div className="hint">(sin texto)</div>}
              {r.photo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl(r.photo)} alt="Foto reportada" style={{ height: 90, borderRadius: 8, cursor: "zoom-in" }} onClick={() => openLightbox(photoUrl(r.photo!))} />
              )}
              <div className="row" style={{ marginTop: 8 }}>
                <button className="btn sm danger" type="button" disabled={busy === rid} onClick={async () => { setBusy(rid); await deleteReview(rid); setBusy(null); }}>Borrar reseña</button>
                <button className="btn sm" type="button" disabled={busy === rid} onClick={async () => { setBusy(rid); await dismissReports(rid); setBusy(null); }}>Descartar reporte</button>
              </div>
            </div>
          );
        })
      )}
    </>
  );
}
