"use client";

import { useMemo } from "react";
import { useApp } from "@/lib/ctx";
import { BARRIOS, TAGS } from "@/lib/utils";
import { CafeCard } from "../ui";

export default function RankView() {
  const { cafes, reviews, stats, go, rankTag, rankBarrio, setRank } = useApp();

  const rows = useMemo(() => {
    const C = reviews.length ? reviews.reduce((a, b) => a + b.rating, 0) / reviews.length : 3.5;
    const m = 2; // peso de "reseñas imaginarias" para no premiar un solo 5
    return cafes
      .filter((c) => (!rankTag || c.tags.includes(rankTag)) && (!rankBarrio || c.barrio === rankBarrio))
      .map((c) => {
        const s = stats(c.id);
        return { c, s, score: s.n ? (s.n * s.avg + m * C) / (s.n + m) : 0 };
      })
      .filter((x) => x.s.n > 0)
      .sort((a, b) => b.score - a.score || b.s.n - a.s.n || a.c.name.localeCompare(b.c.name, "es"));
  }, [cafes, reviews, stats, rankTag, rankBarrio]);

  return (
    <>
      <button className="btn ghost" type="button" onClick={() => go("list")}>← Todas las cafeterías</button>
      <h2>Las mejores de Tijuana</h2>
      <p className="hint">
        Ordenadas por calificación de la comunidad. Los lugares con pocas reseñas pesan menos, así una sola reseña de 5 estrellas no los pone arriba.
      </p>
      <div className="chips" style={{ marginTop: 12 }}>
        <button className="chip" type="button" aria-pressed={!rankTag} onClick={() => setRank({ tag: null })}>Todas</button>
        {TAGS.map((t) => (
          <button key={t} className="chip" type="button" aria-pressed={rankTag === t} onClick={() => setRank({ tag: rankTag === t ? null : t })}>{t}</button>
        ))}
      </div>
      <div style={{ marginBottom: 12 }}>
        <select className="field" aria-label="Zona" value={rankBarrio} onChange={(e) => setRank({ barrio: e.target.value })}>
          <option value="">Toda la ciudad</option>
          {Object.keys(BARRIOS).map((b) => <option key={b}>{b}</option>)}
        </select>
      </div>

      {!rows.length ? (
        <div className="empty">
          <strong>Todavía no hay ranking</strong>
          Aparece cuando haya reseñas{rankTag || rankBarrio ? " con estos filtros." : ". Reseña tu cafetería favorita para empezar."}
        </div>
      ) : (
        rows.map((x, i) => (
          <div key={x.c.id} className={"rk" + (i < 3 ? " top" : "")}>
            <div className="n">{i + 1}</div>
            <CafeCard cafe={x.c} />
          </div>
        ))
      )}
    </>
  );
}
