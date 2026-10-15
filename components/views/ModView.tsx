"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/lib/ctx";
import { photoUrl } from "@/lib/supabase";
import { reasonLabel, starStr } from "@/lib/utils";
import { openLightbox } from "../ui";

export default function ModView() {
  const {
    isAdmin, reports, reviews, cafes, closedCafes, cafeReports, go, select, nameOf,
    deleteReview, dismissReports, setCafeClosed, dismissCafeReports,
  } = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setErr("");
    try {
      await fn();
    } catch (x) {
      setErr(x instanceof Error ? x.message : "No se pudo completar la acción");
    }
    setBusy(null);
  };

  const cafeItems = useMemo(() => {
    const m = new Map<string, typeof cafeReports>();
    for (const r of cafeReports) m.set(r.cafe_id, [...(m.get(r.cafe_id) || []), r]);
    return [...m.entries()]
      .map(([cid, list]) => ({ cid, list, cafe: cafes.find((x) => x.id === cid) }))
      .filter((x) => x.cafe)
      .sort((a, b) => b.list.length - a.list.length);
  }, [cafeReports, cafes]);

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
      <h2>Moderación</h2>
      <p className="hint">Solo ves esto porque eres moderador.</p>
      {err && <div className="err" role="alert">{err}</div>}

      <h3>Cafeterías reportadas</h3>
      <p className="hint" style={{ marginTop: 0 }}>
        Marcar como cerrada la oculta del mapa y la lista sin borrarla, así no vuelve al importar de OpenStreetMap. Descartar quita los reportes y la deja visible.
      </p>
      {!cafeItems.length ? (
        <div className="hint" style={{ padding: "8px 0" }}>No hay cafeterías reportadas.</div>
      ) : (
        cafeItems.map(({ cid, list, cafe }) => {
          const counts: Record<string, number> = {};
          list.forEach((x) => { counts[x.reason] = (counts[x.reason] || 0) + 1; });
          const notes = list.filter((x) => x.note);
          const key = "c:" + cid;
          return (
            <div className="modcard" key={cid}>
              <div className="meta" style={{ margin: 0 }}>
                <button className="who" type="button" style={{ fontWeight: 700 }} onClick={() => select(cid)}>{cafe!.name}</button>
                <span>{[cafe!.barrio, cafe!.address].filter(Boolean).join(" · ") || "Tijuana"}</span>
              </div>
              <div className="reasons">
                {Object.entries(counts).map(([k, v]) => <span className="tag" key={k}>{reasonLabel(k)} ×{v}</span>)}
              </div>
              {notes.map((n) => <blockquote key={n.id}>{n.note}<span className="hint"> — {nameOf(n.reporter_id)}</span></blockquote>)}
              <div className="row" style={{ marginTop: 8 }}>
                <button className="btn sm" type="button" onClick={() => select(cid)}>Ver ficha</button>
                <button className="btn sm danger" type="button" disabled={busy === key} onClick={() => run(key, () => setCafeClosed(cid, true))}>Marcar como cerrada</button>
                <button className="btn sm" type="button" disabled={busy === key} onClick={() => run(key, () => dismissCafeReports(cid))}>Descartar</button>
              </div>
            </div>
          );
        })
      )}

      <h3>Reseñas reportadas</h3>
      <p className="hint" style={{ marginTop: 0 }}>Borrar una reseña la quita para todos. Descartar el reporte la deja publicada.</p>
      {!items.length ? (
        <div className="hint" style={{ padding: "8px 0" }}>No hay reseñas reportadas.</div>
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
                <button className="btn sm danger" type="button" disabled={busy === rid} onClick={() => run(rid, () => deleteReview(rid))}>Borrar reseña</button>
                <button className="btn sm" type="button" disabled={busy === rid} onClick={() => run(rid, () => dismissReports(rid))}>Descartar reporte</button>
              </div>
            </div>
          );
        })
      )}

      <h3>Cafeterías cerradas (ocultas)</h3>
      {!closedCafes.length ? (
        <div className="hint" style={{ padding: "8px 0" }}>Ninguna por ahora. Las que marques como cerradas aparecerán aquí por si quieres reabrirlas.</div>
      ) : (
        closedCafes.map((c) => (
          <div className="modcard" key={c.id}>
            <div className="meta" style={{ margin: 0 }}>
              <b style={{ color: "var(--ink)" }}>{c.name}</b>
              <span>{[c.barrio, c.address].filter(Boolean).join(" · ") || "Tijuana"}</span>
              {c.source === "osm" && <span className="pill ex">OpenStreetMap</span>}
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn sm" type="button" disabled={busy === "o:" + c.id} onClick={() => run("o:" + c.id, () => setCafeClosed(c.id, false))}>Reabrir</button>
            </div>
          </div>
        ))
      )}
    </>
  );
}
