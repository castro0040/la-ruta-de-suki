"use client";

import { useApp } from "@/lib/ctx";
import { TAGS } from "@/lib/utils";
import { CafeCard } from "../ui";

export default function ListView() {
  const { visible, loaded, cafes, filters, setFilters, user, favs, userLoc } = useApp();
  const favCount = Object.keys(favs).length;

  return (
    <>
      <div className="searchrow">
        <input
          type="search"
          placeholder="Buscar cafetería, colonia o etiqueta"
          aria-label="Buscar"
          value={filters.q}
          onChange={(e) => setFilters({ q: e.target.value })}
        />
      </div>
      <div className="chips">
        <button className="chip" type="button" aria-pressed={filters.onlyOpen} onClick={() => setFilters({ onlyOpen: !filters.onlyOpen })}>
          Abierto ahora
        </button>
        {userLoc && (
          <button className="chip" type="button" aria-pressed={filters.near} onClick={() => setFilters({ near: !filters.near })}>
            Más cercanas
          </button>
        )}
        {user && (
          <button className="chip" type="button" aria-pressed={filters.onlyFav} onClick={() => setFilters({ onlyFav: !filters.onlyFav })}>
            Mis guardadas{favCount ? ` (${favCount})` : ""}
          </button>
        )}
        {TAGS.map((t) => (
          <button key={t} className="chip" type="button" aria-pressed={filters.tag === t} onClick={() => setFilters({ tag: filters.tag === t ? null : t })}>
            {t}
          </button>
        ))}
      </div>

      {!loaded ? (
        <div className="empty">Cargando cafeterías…</div>
      ) : !cafes.length ? (
        <div className="empty">
          <strong>Aún no hay cafeterías</strong>
          Sé la primera persona en agregar una. Toca “+ Agregar”.
        </div>
      ) : !visible.length ? (
        <div className="empty">
          <strong>Nada con ese filtro</strong>
          Quita un filtro o busca otra palabra.
        </div>
      ) : (
        <>
          <p className="count">{visible.length} {visible.length === 1 ? "cafetería" : "cafeterías"}</p>
          {visible.map((c) => <CafeCard key={c.id} cafe={c} />)}
        </>
      )}

      {cafes.some((c) => c.source === "osm") && (
        <p className="hint" style={{ marginTop: 16 }}>
          Algunas cafeterías vienen de{" "}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>
          , © colaboradores de OpenStreetMap. Puede faltar información.
        </p>
      )}
    </>
  );
}
