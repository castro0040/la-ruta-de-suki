"use client";

import { useState } from "react";
import { useApp } from "@/lib/ctx";
import { CafeCard, ReviewItem } from "../ui";

export default function ProfileView() {
  const { profId, user, profiles, cafes, reviews, favs, nameOf, go, renameMe, signOut } = useApp();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [err, setErr] = useState("");

  if (!profId) return null;
  const me = user?.id === profId;
  const p = profiles[profId];
  const shownName = p?.display_name || nameOf(profId);
  const revs = reviews.filter((r) => r.user_id === profId).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const added = cafes.filter((c) => c.owner_id === profId);
  const avg = revs.length ? revs.reduce((a, b) => a + b.rating, 0) / revs.length : 0;

  const byStatus = (st: "want" | "been") =>
    Object.entries(favs)
      .filter(([id, s]) => s === st && cafes.some((c) => c.id === id))
      .map(([id]) => cafes.find((c) => c.id === id)!);
  const want = me ? byStatus("want") : [];
  const been = me ? byStatus("been") : [];

  return (
    <>
      <button className="btn ghost" type="button" onClick={() => go("list")}>← Todas las cafeterías</button>
      <div className="phead">
        <div className="avatar" aria-hidden="true">{shownName.trim().charAt(0).toUpperCase() || "?"}</div>
        <div>
          <h2 style={{ margin: 0 }}>{shownName}</h2>
          <div className="hint">
            {me ? "Tu perfil. Tus guardadas solo las ves tú." : "Miembro de la comunidad"}
            {p?.role === "admin" ? " · Moderador" : ""}
          </div>
        </div>
      </div>

      {me && (
        <div style={{ margin: "8px 0" }}>
          {editing ? (
            <form
              className="row"
              onSubmit={async (e) => {
                e.preventDefault();
                setErr("");
                try {
                  await renameMe(name.trim());
                  setEditing(false);
                } catch (x) {
                  setErr(x instanceof Error ? x.message : "No se pudo guardar");
                }
              }}
            >
              <input className="field" style={{ flex: 1, minWidth: 140 }} aria-label="Tu nombre" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
              <button className="btn sm primary" type="submit" disabled={name.trim().length < 2}>Guardar</button>
              <button className="btn sm" type="button" onClick={() => setEditing(false)}>Cancelar</button>
            </form>
          ) : (
            <div className="row">
              <button className="btn sm" type="button" onClick={() => { setName(p?.display_name || ""); setEditing(true); }}>Cambiar mi nombre</button>
              <button className="btn sm" type="button" onClick={signOut}>Cerrar sesión</button>
            </div>
          )}
          <div className="err">{err}</div>
        </div>
      )}

      <div className="stat">
        <div><b>{revs.length}</b><span>{revs.length === 1 ? "reseña" : "reseñas"}</span></div>
        <div><b>{added.length}</b><span>{added.length === 1 ? "cafetería agregada" : "cafeterías agregadas"}</span></div>
        <div><b>{revs.length ? avg.toFixed(1) : "–"}</b><span>promedio que da</span></div>
      </div>

      {me && (
        <>
          <h3>Quiero ir ({want.length})</h3>
          {want.length ? want.map((c) => <CafeCard key={c.id} cafe={c} />) : <div className="hint">Guarda cafeterías con el botón “Quiero ir” en su ficha.</div>}
          <h3>Ya fui ({been.length})</h3>
          {been.length ? been.map((c) => <CafeCard key={c.id} cafe={c} />) : <div className="hint">Marca “Ya fui” en los lugares que ya visitaste.</div>}
        </>
      )}

      <h3>{me ? "Mis reseñas" : "Reseñas"}</h3>
      {revs.length ? revs.map((r) => <ReviewItem key={r.id} r={r} showWho={false} />) : (
        <div className="hint">{me ? "Aún no has publicado reseñas." : "Todavía no ha publicado reseñas."}</div>
      )}

      {added.length > 0 && (
        <>
          <h3>{me ? "Cafeterías que agregué" : "Cafeterías que agregó"}</h3>
          {added.map((c) => <CafeCard key={c.id} cafe={c} />)}
        </>
      )}
    </>
  );
}
