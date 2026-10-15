"use client";

import { useState } from "react";
import { useApp } from "@/lib/ctx";
import { BARRIOS, DAYN, ORDER, PRICEHINT, TAGS, safeIg, safePhone, safeWeb } from "@/lib/utils";

export default function CafeForm() {
  const { draft: D, patchDraft, go, select, setPlacing, placing, showOnMap, uploadPhoto, saveCafe, cafes } = useApp();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  if (!D) return null;
  const editing = !!D.id;

  const pinText = D.pinned
    ? "Pin colocado en el mapa"
    : `Pin en el centro de ${D.barrio || "la colonia"}. Muévelo para ser más preciso.`;

  const setHour = (d: (typeof ORDER)[number], p: Partial<{ closed: boolean; o: string; c: string }>) =>
    patchDraft({ hours: { ...D.hours, [d]: { ...D.hours[d], ...p } } });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!D) return;
    setErr("");
    const phone = D.phone.trim();
    const web = D.website.trim();
    const ig = D.instagram.trim() ? safeIg(D.instagram) : "";
    if (D.name.trim().length < 2) return setErr("Escribe el nombre de la cafetería.");
    if (phone && !safePhone(phone)) return setErr("El teléfono solo puede llevar números, +, paréntesis y guiones.");
    if (D.instagram.trim() && !ig) return setErr("Escribe el usuario de Instagram, por ejemplo @micafe.");
    if (web && !safeWeb(web)) return setErr("El sitio web debe empezar con https://");
    setBusy(true);
    try {
      const photos = [...D.photos];
      const menu = [...D.menu];
      if (D.file) photos.push(await uploadPhoto(D.file));
      for (const f of D.menuFiles) menu.push(await uploadPhoto(f));
      const hours: Record<string, { o: string; c: string } | null> = {};
      for (const d of ORDER) hours[d] = D.hours[d].closed ? null : { o: D.hours[d].o, c: D.hours[d].c };
      const id = await saveCafe({
        id: D.id, name: D.name.trim(), address: D.address.trim(), barrio: D.barrio, lat: D.lat, lng: D.lng,
        description: D.description.trim(), tags: D.tags, price: D.price, phone, instagram: ig, website: web,
        drinks: D.drinks.trim(), hours, photos, menu,
      });
      setPlacing(false);
      select(id);
      showOnMap({ lat: D.lat, lng: D.lng });
    } catch (x) {
      setErr(x instanceof Error ? x.message : "No se pudo guardar");
    }
    setBusy(false);
  }

  return (
    <>
      <button
        className="btn ghost"
        type="button"
        onClick={() => {
          if (editing && cafes.some((c) => c.id === D.id)) select(D.id!);
          else go("list");
        }}
      >
        ← Cancelar
      </button>
      <h2>{editing ? "Editar cafetería" : "Agregar cafetería"}</h2>
      <p className="hint">Completa lo que sepas. Puedes volver a editarlo después.</p>

      <form className="form" onSubmit={submit} style={{ marginTop: 12 }}>
        <label htmlFor="fname">
          Nombre
          <input id="fname" className="field" required maxLength={80} value={D.name} onChange={(e) => patchDraft({ name: e.target.value })} />
        </label>
        <label htmlFor="faddr">
          Dirección o referencia
          <input id="faddr" className="field" maxLength={160} placeholder="Calle, número o cerca de…" value={D.address} onChange={(e) => patchDraft({ address: e.target.value })} />
        </label>
        <label htmlFor="fbarrio">
          Colonia o zona
          <select
            id="fbarrio"
            className="field"
            value={D.barrio}
            onChange={(e) => {
              const b = e.target.value;
              if (!D.pinned && BARRIOS[b]) {
                patchDraft({ barrio: b, lat: BARRIOS[b][0], lng: BARRIOS[b][1] });
                showOnMap({ lat: BARRIOS[b][0], lng: BARRIOS[b][1] });
              } else patchDraft({ barrio: b });
            }}
          >
            <option value="">Otra zona</option>
            {Object.keys(BARRIOS).map((b) => <option key={b}>{b}</option>)}
          </select>
        </label>

        <div>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Ubicación</div>
          <div className="hint">{pinText}</div>
          <button className="btn" type="button" style={{ marginTop: 6 }} onClick={() => setPlacing(!placing)} aria-pressed={placing}>
            {placing ? "Listo, ya la coloqué" : "Colocar pin en el mapa"}
          </button>
        </div>

        <div>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Horario</div>
          <div className="form" style={{ gap: 8 }}>
            {ORDER.map((d) => (
              <div className="hrow" key={d}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{DAYN[d]}</span>
                <input type="time" className="field" aria-label={`${DAYN[d]} abre`} value={D.hours[d].o} disabled={D.hours[d].closed} onChange={(e) => setHour(d, { o: e.target.value })} />
                <input type="time" className="field" aria-label={`${DAYN[d]} cierra`} value={D.hours[d].c} disabled={D.hours[d].closed} onChange={(e) => setHour(d, { c: e.target.value })} />
                <label style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 12, fontWeight: 500 }}>
                  <input type="checkbox" aria-label={`${DAYN[d]} cerrado`} checked={D.hours[d].closed} onChange={(e) => setHour(d, { closed: e.target.checked })} />
                  Cerrado
                </label>
              </div>
            ))}
          </div>
          <button
            className="btn sm"
            type="button"
            style={{ marginTop: 8 }}
            onClick={() => {
              const m = D.hours.lun;
              patchDraft({ hours: { ...D.hours, mar: { ...m }, mie: { ...m }, jue: { ...m }, vie: { ...m } } });
            }}
          >
            Copiar el lunes a martes–viernes
          </button>
        </div>

        <div>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Etiquetas</div>
          <div className="checks">
            {TAGS.map((t) => (
              <label key={t}>
                <input type="checkbox" checked={D.tags.includes(t)} onChange={(e) => patchDraft({ tags: e.target.checked ? [...D.tags, t] : D.tags.filter((x) => x !== t) })} />
                {t}
              </label>
            ))}
          </div>
        </div>

        <label htmlFor="fdesc">
          Descripción
          <textarea id="fdesc" className="field" rows={3} maxLength={600} placeholder="Qué la hace especial" value={D.description} onChange={(e) => patchDraft({ description: e.target.value })} />
        </label>
        <label htmlFor="fprice">
          Rango de precio
          <select id="fprice" className="field" value={D.price} onChange={(e) => patchDraft({ price: Number(e.target.value) })}>
            <option value={0}>Sin dato</option>
            <option value={1}>$</option>
            <option value={2}>$$</option>
            <option value={3}>$$$</option>
            <option value={4}>$$$$</option>
          </select>
          <span className="hint" style={{ fontWeight: 400 }}>{PRICEHINT}</span>
        </label>
        <label htmlFor="fphone">
          Teléfono
          <input id="fphone" className="field" type="tel" maxLength={20} value={D.phone} onChange={(e) => patchDraft({ phone: e.target.value })} />
        </label>
        <label htmlFor="fig">
          Instagram
          <input id="fig" className="field" maxLength={60} placeholder="@micafe" value={D.instagram} onChange={(e) => patchDraft({ instagram: e.target.value })} />
        </label>
        <label htmlFor="fweb">
          Sitio web
          <input id="fweb" className="field" type="url" maxLength={200} placeholder="https://" value={D.website} onChange={(e) => patchDraft({ website: e.target.value })} />
        </label>
        <label htmlFor="fdrinks">
          Bebidas destacadas
          <textarea id="fdrinks" className="field" rows={4} maxLength={900} placeholder={"Una por línea. Ejemplo:\nLatte de vainilla · $65\nCold brew · $70"} value={D.drinks} onChange={(e) => patchDraft({ drinks: e.target.value })} />
        </label>
        <label htmlFor="fphoto">
          Agregar foto del lugar
          <input id="fphoto" type="file" accept="image/*" onChange={(e) => patchDraft({ file: e.target.files?.[0] || null })} />
        </label>
        <label htmlFor="fmenu">
          Agregar fotos de la carta
          <input id="fmenu" type="file" accept="image/*" multiple onChange={(e) => patchDraft({ menuFiles: (Array.from(e.target.files || []) as File[]).slice(0, 6) })} />
        </label>

        <div className="err" role="alert">{err}</div>
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? "Guardando…" : editing ? "Guardar cambios" : "Publicar cafetería"}
        </button>
      </form>
    </>
  );
}
