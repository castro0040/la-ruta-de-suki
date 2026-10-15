"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import dynamic from "next/dynamic";
import { Ctx, type AppCtx, type Filters, type SaveCafeInput } from "@/lib/ctx";
import { configured, sb } from "@/lib/supabase";
import type { Cafe, CafeReason, CafeReport, Draft, FavStatus, Profile, Report, Review, View } from "@/lib/types";
import { km, newDraft, openState, shrinkImage, stateText, kmText } from "@/lib/utils";
import { durText, fetchRoute, type Route, type RouteMode } from "@/lib/routing";
import { Lightbox, Stars } from "./ui";
import type { FlyTarget } from "./MapView";
import ListView from "./views/ListView";
import DetailView from "./views/DetailView";
import RankView from "./views/RankView";
import ProfileView from "./views/ProfileView";
import ModView from "./views/ModView";
import CafeForm from "./views/CafeForm";
import AuthView from "./views/AuthView";

const MapView = dynamic(() => import("./MapView"), { ssr: false });

const isMobile = () => typeof window !== "undefined" && window.matchMedia("(max-width: 820px)").matches;

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [allCafes, setAllCafes] = useState<Cafe[]>([]);
  const [cafeReports, setCafeReports] = useState<CafeReport[]>([]);
  const [myCafeReports, setMyCafeReports] = useState<Set<string>>(new Set());
  const [reviews, setReviews] = useState<Review[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [favs, setFavs] = useState<Record<string, FavStatus>>({});
  const [reports, setReports] = useState<Report[]>([]);
  const [myReports, setMyReports] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [loadErr, setLoadErr] = useState("");
  const [userLoc, setUserLoc] = useState<[number, number] | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [routeBusy, setRouteBusy] = useState(false);
  const [routeErr, setRouteErr] = useState("");
  const [following, setFollowing] = useState(false);

  const [view, setView] = useState<View>("list");
  const [selId, setSelId] = useState<string | null>(null);
  const [profId, setProfId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [placing, setPlacingRaw] = useState(false);
  const [filters, setFiltersRaw] = useState<Filters>({ q: "", onlyOpen: false, onlyFav: false, near: false, tag: null });
  const [rankTag, setRankTag] = useState<string | null>(null);
  const [rankBarrio, setRankBarrio] = useState("");
  const [tab, setTab] = useState<"map" | "panel">("map");
  const [fly, setFly] = useState<FlyTarget>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const sideRef = useRef<HTMLElement>(null);
  const userRef = useRef<User | null>(null);
  userRef.current = user;

  /* ---------- sesión ---------- */
  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data } = sb.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  /* ---------- carga de datos ---------- */
  const load = useCallback(async () => {
    const [c, r, p] = await Promise.all([
      sb.from("cafes").select("*"),
      sb.from("reviews").select("*"),
      sb.from("profiles").select("id,display_name,role"),
    ]);
    if (c.error) {
      setLoadErr(c.error.message);
      setLoaded(true);
      return;
    }
    setLoadErr("");
    setAllCafes((c.data || []) as Cafe[]);
    setReviews((r.data || []) as Review[]);
    const pm: Record<string, Profile> = {};
    ((p.data || []) as Profile[]).forEach((x) => (pm[x.id] = x));
    setProfiles(pm);

    const uid = userRef.current?.id;
    if (uid) {
      const [f, mine, cr] = await Promise.all([
        sb.from("favorites").select("cafe_id,status").eq("user_id", uid),
        sb.from("reports").select("*").eq("reporter_id", uid),
        // Un usuario recibe solo sus reportes; un moderador recibe todos.
        sb.from("cafe_reports").select("*"),
      ]);
      const crRows = (cr.data || []) as CafeReport[];
      setCafeReports(crRows);
      setMyCafeReports(new Set(crRows.filter((x) => x.reporter_id === uid).map((x) => x.cafe_id)));
      const fm: Record<string, FavStatus> = {};
      (f.data || []).forEach((x: { cafe_id: string; status: FavStatus }) => (fm[x.cafe_id] = x.status));
      setFavs(fm);
      setMyReports(new Set(((mine.data || []) as Report[]).map((x) => x.review_id)));
      if (pm[uid]?.role === "admin") {
        const all = await sb.from("reports").select("*");
        setReports((all.data || []) as Report[]);
      } else setReports([]);
    } else {
      setFavs({});
      setMyReports(new Set());
      setReports([]);
      setCafeReports([]);
      setMyCafeReports(new Set());
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (configured) load();
  }, [user?.id, load]);

  // Cambios en vivo de otras personas
  useEffect(() => {
    if (!configured) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const ch = sb
      .channel("cambios")
      .on("postgres_changes", { event: "*", schema: "public" }, () => {
        clearTimeout(t);
        t = setTimeout(load, 500);
      })
      .subscribe();
    return () => {
      clearTimeout(t);
      sb.removeChannel(ch);
    };
  }, [load]);

  // Foto ampliada
  useEffect(() => {
    const h = (e: Event) => setLightbox((e as CustomEvent<string>).detail);
    window.addEventListener("lightbox", h);
    return () => window.removeEventListener("lightbox", h);
  }, []);

  useEffect(() => {
    sideRef.current?.scrollTo({ top: 0 });
  }, [view, selId, profId]);

  // La ruta pertenece a una cafetería: al elegir otra, se quita.
  useEffect(() => {
    setRoute((r) => (r && r.cafeId === selId ? r : null));
    setRouteErr("");
  }, [selId]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  /* ---------- derivados ---------- */
  // Las cafeterías cerradas no salen en el mapa, la lista ni el ranking. Solo un moderador las recibe (para poder reabrirlas).
  const cafes = useMemo(() => allCafes.filter((c) => c.status !== "closed"), [allCafes]);
  const closedCafes = useMemo(() => allCafes.filter((c) => c.status === "closed"), [allCafes]);
  const me = user ? profiles[user.id] ?? null : null;
  const isAdmin = me?.role === "admin";

  const statMap = useMemo(() => {
    const m = new Map<string, { n: number; sum: number }>();
    for (const r of reviews) {
      const e = m.get(r.cafe_id) || { n: 0, sum: 0 };
      e.n += 1;
      e.sum += r.rating;
      m.set(r.cafe_id, e);
    }
    return m;
  }, [reviews]);

  const stats = useCallback(
    (id: string) => {
      const e = statMap.get(id);
      return e ? { n: e.n, avg: e.sum / e.n } : { n: 0, avg: 0 };
    },
    [statMap]
  );

  const nameOf = useCallback(
    (id: string | null) => (id && profiles[id]?.display_name) || (id && id === user?.id ? "Tú" : "Alguien de la comunidad"),
    [profiles, user]
  );

  const distanceTo = useCallback((c: Cafe) => (userLoc ? km(userLoc, [c.lat, c.lng]) : null), [userLoc]);

  // Solo se reordena por cercanía cuando el filtro "Más cercanas" está activo,
  // para no redibujar la lista cada vez que cambia la ubicación en vivo.
  const sortLoc = filters.near ? userLoc : null;

  const visible = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    const list = cafes.filter((c) => {
      if (filters.onlyOpen && !openState(c).open) return false;
      if (filters.onlyFav && !favs[c.id]) return false;
      if (filters.tag && !c.tags.includes(filters.tag)) return false;
      if (q && !`${c.name} ${c.barrio || ""} ${c.tags.join(" ")}`.toLowerCase().includes(q)) return false;
      return true;
    });
    return list.sort((a, b) => {
      if (sortLoc) return km(sortLoc, [a.lat, a.lng]) - km(sortLoc, [b.lat, b.lng]);
      const sa = stats(a.id), sb2 = stats(b.id);
      return sb2.avg - sa.avg || sb2.n - sa.n || a.name.localeCompare(b.name, "es");
    });
  }, [cafes, filters, favs, sortLoc, stats]);

  /* ---------- navegación ---------- */
  const flyTo = useCallback((lat: number, lng: number, zoom = 16) => setFly({ lat, lng, zoom, key: Date.now() }), []);

  const go: AppCtx["go"] = useCallback(
    (v, extra) => {
      let next = v;
      if (v === "add" && !user) next = "auth";
      if (v === "mod" && !isAdmin) next = "list";
      if (view === "add" && next !== "add") {
        setPlacingRaw(false);
        setDraft(null);
      }
      if (next === "add") setDraft(extra?.draft ?? newDraft());
      if (extra && "selId" in extra) setSelId(extra.selId ?? null);
      if (extra && "profId" in extra) setProfId(extra.profId ?? null);
      setView(next);
      setTab("panel");
    },
    [user, isAdmin, view]
  );

  const select = useCallback(
    (id: string) => {
      const c = cafes.find((x) => x.id === id);
      go("detail", { selId: id });
      if (c) flyTo(c.lat, c.lng, 16);
    },
    [cafes, go, flyTo]
  );

  const onMapSelect = (id: string) => {
    setSelId(id);
    if (!isMobile()) {
      if (view === "add") return;
      setView("detail");
    }
  };

  const showOnMap = useCallback(
    (c: { lat: number; lng: number }) => {
      flyTo(c.lat, c.lng, 16);
      setTab("map");
    },
    [flyTo]
  );

  const setPlacing = useCallback(
    (v: boolean) => {
      setPlacingRaw(v);
      if (v) {
        setDraft((d) => {
          if (d) flyTo(d.lat, d.lng, 15);
          return d;
        });
        setTab("map");
      } else if (isMobile()) setTab("panel");
    },
    [flyTo]
  );

  const getPosition = useCallback(
    () =>
      new Promise<[number, number]>((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error("Tu navegador no permite obtener la ubicación."));
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve([pos.coords.latitude, pos.coords.longitude]),
          () => reject(new Error("No pudimos obtener tu ubicación. Revisa el permiso de ubicación del navegador.")),
          { enableHighAccuracy: true, timeout: 10000 }
        );
      }),
    []
  );

  const locate = useCallback(() => {
    getPosition()
      .then((loc) => {
        setUserLoc(loc);
        flyTo(loc[0], loc[1], 14);
      })
      .catch((e: Error) => setNotice(e.message));
  }, [getPosition, flyTo]);

  // Seguimiento en vivo: el punto azul se mueve mientras tú te mueves.
  useEffect(() => {
    if (!following) return;
    if (!navigator.geolocation) {
      setNotice("Tu navegador no permite obtener la ubicación.");
      setFollowing(false);
      return;
    }
    let first = true;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const next: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        // Se ignoran movimientos de menos de 5 m (ruido del GPS) para no redibujar sin necesidad.
        setUserLoc((prev) => (prev && km(prev, next) < 0.005 ? prev : next));
        if (first) {
          first = false;
          flyTo(next[0], next[1], 16);
          setTab("map");
        }
      },
      (err) => {
        if (err.code === err.TIMEOUT) return; // se reintenta solo
        setNotice(
          err.code === err.PERMISSION_DENIED
            ? "No hay permiso de ubicación. Actívalo en el navegador para seguirte."
            : "No pudimos seguir tu ubicación."
        );
        setFollowing(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [following, flyTo]);

  const requestRoute = useCallback(
    async (c: Cafe, mode: RouteMode) => {
      setRouteErr("");
      setRouteBusy(true);
      try {
        const from = userLoc ?? (await getPosition());
        if (!userLoc) setUserLoc(from);
        const r = await fetchRoute(from, [c.lat, c.lng], mode);
        setRoute({ cafeId: c.id, mode, ...r });
        setTab("map");
      } catch (e) {
        setRouteErr(e instanceof Error ? e.message : "No se pudo calcular la ruta.");
      }
      setRouteBusy(false);
    },
    [userLoc, getPosition]
  );

  const clearRoute = useCallback(() => {
    setRoute(null);
    setRouteErr("");
  }, []);

  /* ---------- acciones ---------- */
  const need = () => {
    if (!user) throw new Error("Inicia sesión para hacer esto.");
    return user;
  };

  const uploadPhoto = useCallback(async (file: File) => {
    const u = need();
    const blob = await shrinkImage(file);
    const path = `${u.id}/${crypto.randomUUID()}.jpg`;
    const { error } = await sb.storage.from("photos").upload(path, blob, { contentType: "image/jpeg" });
    if (error) throw new Error("No se pudo subir la foto: " + error.message);
    return path;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const saveCafe = useCallback(
    async (i: SaveCafeInput) => {
      const u = need();
      const row = {
        name: i.name,
        address: i.address || null,
        barrio: i.barrio || null,
        lat: i.lat,
        lng: i.lng,
        hours: i.hours,
        tags: i.tags,
        description: i.description || null,
        price: i.price,
        phone: i.phone || null,
        instagram: i.instagram || null,
        website: i.website || null,
        drinks: i.drinks || null,
        photos: i.photos,
        menu: i.menu,
      };
      let id = i.id;
      if (id) {
        const { error } = await sb.from("cafes").update(row).eq("id", id);
        if (error) throw new Error("No se pudo guardar: " + error.message);
      } else {
        const { data, error } = await sb.from("cafes").insert({ ...row, owner_id: u.id }).select("id").single();
        if (error || !data) throw new Error("No se pudo guardar: " + (error?.message || "intenta de nuevo"));
        id = data.id as string;
      }
      await load();
      return id as string;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, load]
  );

  const deleteCafe = useCallback(
    async (id: string) => {
      await sb.from("cafes").delete().eq("id", id);
      setSelId(null);
      await load();
    },
    [load]
  );

  const addReview = useCallback(
    async (cafeId: string, rating: number, body: string, photo: string | null) => {
      const u = need();
      const { error } = await sb.from("reviews").insert({ cafe_id: cafeId, user_id: u.id, rating, body: body || null, photo });
      if (error) throw new Error("No se pudo publicar la reseña: " + error.message);
      await load();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, load]
  );

  const deleteReview = useCallback(
    async (id: string) => {
      await sb.from("reviews").delete().eq("id", id);
      await load();
    },
    [load]
  );

  const reportReview = useCallback(
    async (reviewId: string, reason: string) => {
      const u = need();
      const { error } = await sb.from("reports").insert({ review_id: reviewId, reporter_id: u.id, reason });
      if (error && error.code !== "23505") throw new Error(error.message);
      setMyReports((s) => new Set(s).add(reviewId));
      await load();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, load]
  );

  const dismissReports = useCallback(
    async (reviewId: string) => {
      await sb.from("reports").delete().eq("review_id", reviewId);
      await load();
    },
    [load]
  );

  const reportCafe = useCallback(
    async (cafeId: string, reason: CafeReason, note: string) => {
      const u = need();
      const { error } = await sb.from("cafe_reports").insert({ cafe_id: cafeId, reporter_id: u.id, reason, note: note || null });
      if (error && error.code !== "23505") throw new Error("No se pudo enviar el reporte: " + error.message);
      setMyCafeReports((s) => new Set(s).add(cafeId));
      await load();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, load]
  );

  const setCafeClosed = useCallback(
    async (cafeId: string, closed: boolean) => {
      const { error } = await sb.from("cafes").update({ status: closed ? "closed" : "active" }).eq("id", cafeId);
      if (error) throw new Error("No se pudo cambiar: " + error.message);
      // Al cerrarla se da por atendido lo que reportaron.
      if (closed) await sb.from("cafe_reports").delete().eq("cafe_id", cafeId);
      if (closed) setSelId((cur) => (cur === cafeId ? null : cur));
      await load();
    },
    [load]
  );

  const dismissCafeReports = useCallback(
    async (cafeId: string) => {
      await sb.from("cafe_reports").delete().eq("cafe_id", cafeId);
      await load();
    },
    [load]
  );

  const toggleFav = useCallback(
    async (cafeId: string, st: FavStatus) => {
      const u = need();
      const cur = favs[cafeId];
      const next = { ...favs };
      if (cur === st) {
        delete next[cafeId];
        setFavs(next);
        await sb.from("favorites").delete().eq("user_id", u.id).eq("cafe_id", cafeId);
      } else {
        next[cafeId] = st;
        setFavs(next);
        await sb.from("favorites").upsert({ user_id: u.id, cafe_id: cafeId, status: st }, { onConflict: "user_id,cafe_id" });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, favs]
  );

  const renameMe = useCallback(
    async (name: string) => {
      const u = need();
      const { error } = await sb.from("profiles").update({ display_name: name }).eq("id", u.id);
      if (error) throw new Error("No se pudo guardar: " + error.message);
      await load();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, load]
  );

  const signOut = useCallback(async () => {
    await sb.auth.signOut();
    setView("list");
  }, []);

  const ctx: AppCtx = {
    user, me, isAdmin, cafes, closedCafes, cafeReports, myCafeReports, visible, reviews, profiles, favs, reports, myReports, loaded, userLoc,
    view, selId, profId, draft, placing, filters, rankTag, rankBarrio,
    setFilters: (f) => setFiltersRaw((x) => ({ ...x, ...f })),
    setRank: (f) => {
      if ("tag" in f) setRankTag(f.tag ?? null);
      if (f.barrio !== undefined) setRankBarrio(f.barrio);
    },
    setPlacing,
    patchDraft: (p) => setDraft((d) => (d ? { ...d, ...p } : d)),
    go, select, showOnMap, locate, stats, nameOf, distanceTo,
    route: route && route.cafeId === selId ? route : null, routeBusy, routeErr, requestRoute, clearRoute,
    uploadPhoto, saveCafe, deleteCafe, addReview, deleteReview, reportReview, dismissReports, reportCafe, setCafeClosed, dismissCafeReports, toggleFav, renameMe, signOut,
  };

  /* ---------- pantalla de configuración pendiente ---------- */
  if (!configured) {
    return (
      <div style={{ padding: 24, maxWidth: 560 }}>
        <h2>Falta conectar Supabase</h2>
        <p>
          La app ya está lista, pero todavía no tiene tu base de datos. Crea el archivo <b>.env.local</b> con tu URL y tu llave de Supabase
          (hay un ejemplo en <b>.env.example</b>) y reinicia con <b>npm run dev</b>. Los pasos están en el README.
        </p>
      </div>
    );
  }

  const reportedCount = new Set(reports.map((r) => r.review_id)).size + new Set(cafeReports.map((r) => r.cafe_id)).size;
  const selCafe = cafes.find((c) => c.id === selId);
  const mapCafes = view === "list" ? visible : cafes;

  return (
    <Ctx.Provider value={ctx}>
      <div id="app">
        <header>
          <button className="brand" id="brand" type="button" aria-label="La Ruta de Suki, ir al inicio" onClick={() => go("list")}>
            <svg width="38" height="38" viewBox="0 0 38 38" aria-hidden="true">
              <rect width="38" height="38" rx="10" fill="var(--bg)" stroke="var(--line)" />
              <path d="M10 15h14v7a7 7 0 0 1-7 7h0a7 7 0 0 1-7-7z" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinejoin="round" />
              <path d="M24 17h2.5a3 3 0 0 1 0 6H23.5" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" />
              <path d="M14 11c0-2 2-2 2-4M18.5 11c0-2 2-2 2-4" fill="none" stroke="var(--muted)" strokeWidth="1.6" strokeLinecap="round" />
              <circle cx="30" cy="9" r="3.2" fill="var(--open)" />
            </svg>
            <span>
              <b>La Ruta de Suki</b>
              <small>El mapa cafetero de Tijuana, hecho por la comunidad</small>
            </span>
          </button>
          <button className="btn" type="button" onClick={() => go("rank")}>Ranking</button>
          {isAdmin && (
            <button className="btn" type="button" onClick={() => go("mod")}>
              Moderar{reportedCount > 0 && <span className="count-badge">{reportedCount}</span>}
            </button>
          )}
          {user ? (
            <button className="btn" type="button" onClick={() => go("profile", { profId: user.id })}>Mi perfil</button>
          ) : (
            <button className="btn" type="button" onClick={() => go("auth")}>Entrar</button>
          )}
          <button className="btn primary" type="button" onClick={() => go("add")}>+ Agregar</button>
        </header>

        <div className="tabs" role="tablist">
          <button role="tab" type="button" aria-selected={tab === "map"} onClick={() => setTab("map")}>Mapa</button>
          <button role="tab" type="button" aria-selected={tab === "panel"} onClick={() => setTab("panel")}>Panel</button>
        </div>

        <div className="main" data-tab={tab}>
          <aside ref={sideRef} aria-live="polite">
            {loadErr && (
              <div className="notice">
                No se pudieron cargar los datos: {loadErr}. Revisa que ejecutaste <b>schema.sql</b> en Supabase y que las llaves de <b>.env.local</b> son correctas.
              </div>
            )}
            {view === "list" && <ListView />}
            {view === "detail" && <DetailView />}
            {view === "rank" && <RankView />}
            {view === "profile" && <ProfileView />}
            {view === "mod" && <ModView />}
            {view === "add" && <CafeForm />}
            {view === "auth" && <AuthView />}
          </aside>

          <div className="mapwrap">
            <MapView
              cafes={mapCafes}
              selId={selId}
              onSelect={onMapSelect}
              placing={placing}
              pin={draft ? { lat: draft.lat, lng: draft.lng } : null}
              onPick={(lat, lng) => setDraft((d) => (d ? { ...d, lat, lng, pinned: true } : d))}
              fly={fly}
              userLoc={userLoc}
              route={view !== "add" ? ctx.route?.coords ?? null : null}
              follow={following}
            />
            <div className="mapbtns">
              <button className="btn" type="button" onClick={locate}>Mi ubicación</button>
              <button className="btn" type="button" aria-pressed={following} onClick={() => setFollowing((f) => !f)}>
                {following ? "Dejar de seguir" : "Seguir mi ubicación"}
              </button>
            </div>
            {placing && (
              <div className="banner">
                <span style={{ flex: 1, fontWeight: 500 }}>Toca el mapa para colocar el pin</span>
                <button className="btn" type="button" onClick={() => setPlacing(false)}>Listo</button>
              </div>
            )}
            {notice && !placing && (
              <div className="banner" role="status">
                <span style={{ flex: 1, fontWeight: 500 }}>{notice}</span>
                <button className="btn" type="button" onClick={() => setNotice("")}>Cerrar</button>
              </div>
            )}
            {selCafe && view !== "add" && !placing && (
              <div className="mapcard">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: "800 16px var(--display)" }}>{selCafe.name}</div>
                  <div className="meta">
                    {stats(selCafe.id).n ? <Stars v={stats(selCafe.id).avg} /> : <span>Sin reseñas</span>}
                    <span className={"pill " + (openState(selCafe).open ? "on" : "off")}>{stateText(openState(selCafe))}</span>
                  </div>
                  {ctx.route && (
                    <div className="meta">
                      <b style={{ color: "var(--ink)" }}>{durText(ctx.route.duration)}</b>
                      <span>{kmText(ctx.route.distance / 1000)} {ctx.route.mode === "car" ? "en coche" : "a pie"}</span>
                      <button className="link" type="button" onClick={clearRoute}>Quitar ruta</button>
                    </div>
                  )}
                  {routeErr && <div className="err">{routeErr}</div>}
                </div>
                <button className="btn" type="button" disabled={routeBusy} onClick={() => requestRoute(selCafe, ctx.route?.mode ?? "car")}>
                  {routeBusy ? "Calculando…" : "Ir"}
                </button>
                <button className="btn primary" type="button" onClick={() => go("detail", { selId: selCafe.id })}>Ver</button>
              </div>
            )}
          </div>
        </div>
      </div>
      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
    </Ctx.Provider>
  );
}
