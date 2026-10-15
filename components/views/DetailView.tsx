"use client";

import { useState } from "react";
import { useApp } from "@/lib/ctx";
import { photoUrl } from "@/lib/supabase";
import { DAYN, DAYS, ORDER, draftFromCafe, fmt, hasHours, openState, safeIg, safePhone, safeWeb, stateText, kmText } from "@/lib/utils";
import { durText, mapLinks } from "@/lib/routing";
import { Price, ReviewItem, Stars, openLightbox } from "../ui";

export default function DetailView() {
  const {
    cafes, selId, go, stats, reviews, user, favs, toggleFav, isAdmin, showOnMap, deleteCafe, distanceTo,
    route, routeBusy, routeErr, requestRoute, clearRoute,
  } = useApp();
  const [confirmDel, setConfirmDel] = useState(false);
  const [copied, setCopied] = useState(false);
  const c = cafes.find((x) => x.id === selId);
  if (!c) return null;

  const s = stats(c.id);
  const st = openState(c);
  const revs = reviews.filter((r) => r.cafe_id === c.id).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const photos = [...c.photos, ...revs.filter((r) => r.photo).map((r) => r.photo as string)];
  const today = DAYS[new Date().getDay()];
  const f = favs[c.id];
  const ig = safeIg(c.instagram || "");
  const web = safeWeb(c.website);
  const phone = safePhone(c.phone);
  const drinks = (c.drinks || "").split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 30);
  const canEdit = !!user && (c.owner_id === user.id || isAdmin);
  const dist = distanceTo(c);

  return (
    <>
      <button className="btn ghost" type="button" onClick={() => go("list")}>← Todas las cafeterías</button>
      <h2>{c.name}</h2>
      <div className="meta">
        <span>{[c.barrio, c.address].filter(Boolean).join(" · ") || "Tijuana"}</span>
        {dist !== null && <span className="pill near">a {kmText(dist)}</span>}
        {c.is_example && <span className="pill ex">Ejemplo</span>}
        {c.source === "osm" && <span className="pill ex" title="Datos importados de OpenStreetMap">OpenStreetMap</span>}
      </div>
      <div className="meta" style={{ marginTop: 8 }}>
        {s.n ? <Stars v={s.avg} n={s.n} /> : <span>Sin reseñas aún</span>}
        <span className={"pill " + (st.open ? "on" : "off")}>{stateText(st)}</span>
        <Price p={c.price} />
      </div>

      {user && (
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn sm" type="button" aria-pressed={f === "want"} onClick={() => toggleFav(c.id, "want")}>Quiero ir</button>
          <button className="btn sm" type="button" aria-pressed={f === "been"} onClick={() => toggleFav(c.id, "been")}>Ya fui</button>
        </div>
      )}

      {c.description && <p style={{ overflowWrap: "anywhere" }}>{c.description}</p>}
      <div className="tagrow">{c.tags.map((t) => <span className="tag" key={t}>{t}</span>)}</div>

      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn sm" type="button" onClick={() => showOnMap(c)}>Ver en el mapa</button>
        {canEdit && <button className="btn sm" type="button" onClick={() => go("add", { draft: draftFromCafe(c) })}>Editar datos</button>}
        {canEdit && (
          <button
            className="btn sm danger"
            type="button"
            onClick={async () => {
              if (!confirmDel) return setConfirmDel(true);
              await deleteCafe(c.id);
              go("list");
            }}
          >
            {confirmDel ? "¿Seguro? Toca otra vez" : "Eliminar"}
          </button>
        )}
      </div>

      <h3>Cómo llegar</h3>
      <div className="row">
        <button className="btn sm" type="button" aria-pressed={route?.mode === "car"} disabled={routeBusy} onClick={() => requestRoute(c, "car")}>En coche</button>
        <button className="btn sm" type="button" aria-pressed={route?.mode === "foot"} disabled={routeBusy} onClick={() => requestRoute(c, "foot")}>A pie</button>
        {route && <button className="btn ghost sm" type="button" onClick={clearRoute}>Quitar ruta</button>}
      </div>
      {routeBusy && <div className="hint" style={{ marginTop: 8 }}>Calculando ruta…</div>}
      {route && !routeBusy && (
        <div className="routebox">
          <b>{durText(route.duration)}</b> · {kmText(route.distance / 1000)} {route.mode === "car" ? "en coche" : "a pie"}
          <span className="hint"> · la ruta está dibujada en el mapa</span>
        </div>
      )}
      {routeErr && <div className="err" style={{ marginTop: 8 }}>{routeErr}</div>}
      <div className="row" style={{ marginTop: 8 }}>
        {(() => {
          const l = mapLinks(c.lat, c.lng);
          return (
            <>
              <a className="btn sm" href={l.google} target="_blank" rel="noopener noreferrer">Google Maps</a>
              <a className="btn sm" href={l.waze} target="_blank" rel="noopener noreferrer">Waze</a>
              <a className="btn sm" href={l.apple} target="_blank" rel="noopener noreferrer">Apple Maps</a>
            </>
          );
        })()}
      </div>
      <div className="hint" style={{ marginTop: 6 }}>Para navegar con voz paso a paso, ábrela en tu app de mapas. Pedirá permiso para usar tu ubicación.</div>

      {(phone || ig || web) && (
        <>
          <h3>Contacto</h3>
          <div className="contact">
            {phone && (
              <div className="line">
                <span className="k">Teléfono</span>
                <span className="sel">{phone}</span>
                <button
                  className="btn ghost sm"
                  type="button"
                  onClick={() => navigator.clipboard.writeText(phone).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1400); }, () => {})}
                >
                  {copied ? "Copiado" : "Copiar"}
                </button>
              </div>
            )}
            {ig && (
              <div className="line">
                <span className="k">Instagram</span>
                <a href={`https://instagram.com/${ig}`} target="_blank" rel="noopener noreferrer">@{ig}</a>
              </div>
            )}
            {web && (
              <div className="line">
                <span className="k">Sitio web</span>
                <a href={web} target="_blank" rel="noopener noreferrer">{web.replace(/^https?:\/\//i, "")}</a>
              </div>
            )}
          </div>
        </>
      )}

      {drinks.length > 0 && (
        <>
          <h3>Bebidas destacadas</h3>
          <div className="drinks">{drinks.map((d, i) => <div key={i}>{d}</div>)}</div>
        </>
      )}

      {c.menu.length > 0 && (
        <>
          <h3>Carta</h3>
          <div className="gallery">
            {c.menu.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p} src={photoUrl(p)} alt={`Carta de ${c.name}`} loading="lazy" onClick={() => openLightbox(photoUrl(p))} />
            ))}
          </div>
        </>
      )}

      {photos.length > 0 && (
        <>
          <h3>Fotos</h3>
          <div className="gallery">
            {photos.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p} src={photoUrl(p)} alt={`Foto de ${c.name}`} loading="lazy" onClick={() => openLightbox(photoUrl(p))} />
            ))}
          </div>
        </>
      )}

      <h3>Horario</h3>
      {hasHours(c) ? (
        <div className="hours">
          {ORDER.map((d) => {
            const h = c.hours?.[d];
            const cls = d === today ? "today" : "";
            return [
              <span key={d + "a"} className={cls}>{DAYN[d]}</span>,
              <span key={d + "b"} className={cls}>
                {h === undefined ? "Sin dato" : h && h.o && h.c ? `${fmt(h.o)} – ${fmt(h.c)}` : "Cerrado"}
              </span>,
            ];
          })}
        </div>
      ) : (
        <div className="hint">Todavía no tenemos el horario de este lugar.</div>
      )}

      <h3>Reseñas</h3>
      <ReviewForm cafeId={c.id} />
      <div>
        {revs.length ? revs.map((r) => <ReviewItem key={r.id} r={r} showWho />) : (
          <div className="hint" style={{ padding: "12px 0" }}>Todavía nadie reseñó este lugar.</div>
        )}
      </div>
    </>
  );
}

function ReviewForm({ cafeId }: { cafeId: string }) {
  const { user, go, uploadPhoto, addReview } = useApp();
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  if (!user) {
    return (
      <p className="hint">
        <button className="link" type="button" onClick={() => go("auth")}>Inicia sesión</button> para publicar una reseña.
      </p>
    );
  }

  return (
    <form
      className="form"
      style={{ marginBottom: 8 }}
      onSubmit={async (e) => {
        e.preventDefault();
        setErr("");
        if (!rating) return setErr("Elige de 1 a 5 estrellas.");
        setBusy(true);
        try {
          const photo = file ? await uploadPhoto(file) : null;
          await addReview(cafeId, rating, body.trim(), photo);
          setRating(0);
          setBody("");
          setFile(null);
          (e.target as HTMLFormElement).reset();
        } catch (x) {
          setErr(x instanceof Error ? x.message : "No se pudo publicar la reseña");
        }
        setBusy(false);
      }}
    >
      <label>
        Tu calificación
        <div className="rate" role="radiogroup" aria-label="Calificación">
          {[1, 2, 3, 4, 5].map((i) => (
            <button key={i} type="button" role="radio" aria-checked={i === rating} aria-label={`${i} ${i === 1 ? "estrella" : "estrellas"}`} className={i <= rating ? "on" : ""} onClick={() => setRating(i)}>★</button>
          ))}
        </div>
      </label>
      <label htmlFor="rtext">
        Tu reseña
        <textarea id="rtext" className="field" rows={3} maxLength={1500} placeholder="¿Cómo estuvo el café, el ambiente, el servicio?" value={body} onChange={(e) => setBody(e.target.value)} />
      </label>
      <label htmlFor="rfile">
        Foto (opcional)
        <input id="rfile" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      </label>
      <div className="err" role="alert">{err}</div>
      <button className="btn primary" type="submit" disabled={busy}>{busy ? "Publicando…" : "Publicar reseña"}</button>
    </form>
  );
}
