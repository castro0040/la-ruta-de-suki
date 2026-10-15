"use client";

import { createContext, useContext } from "react";
import type { User } from "@supabase/supabase-js";
import type { Cafe, Draft, FavStatus, Profile, Report, Review, View } from "./types";
import type { Route, RouteMode } from "./routing";

export type Filters = { q: string; onlyOpen: boolean; onlyFav: boolean; near: boolean; tag: string | null };

export type SaveCafeInput = Omit<Draft, "file" | "menuFiles" | "hours" | "pinned"> & {
  hours: Record<string, { o: string; c: string } | null>;
};

export interface AppCtx {
  user: User | null;
  me: Profile | null;
  isAdmin: boolean;
  cafes: Cafe[];
  visible: Cafe[];
  reviews: Review[];
  profiles: Record<string, Profile>;
  favs: Record<string, FavStatus>;
  reports: Report[];
  myReports: Set<string>;
  loaded: boolean;
  userLoc: [number, number] | null;

  view: View;
  selId: string | null;
  profId: string | null;
  draft: Draft | null;
  placing: boolean;
  filters: Filters;
  rankTag: string | null;
  rankBarrio: string;

  setFilters: (f: Partial<Filters>) => void;
  setRank: (f: { tag?: string | null; barrio?: string }) => void;
  setPlacing: (v: boolean) => void;
  patchDraft: (p: Partial<Draft>) => void;
  go: (v: View, extra?: { selId?: string | null; profId?: string | null; draft?: Draft | null }) => void;
  select: (id: string) => void;
  showOnMap: (c: { lat: number; lng: number }) => void;
  locate: () => void;

  route: Route | null;
  routeBusy: boolean;
  routeErr: string;
  requestRoute: (c: Cafe, mode: RouteMode) => Promise<void>;
  clearRoute: () => void;

  stats: (cafeId: string) => { n: number; avg: number };
  nameOf: (userId: string | null) => string;
  distanceTo: (c: Cafe) => number | null;

  uploadPhoto: (file: File) => Promise<string>;
  saveCafe: (input: SaveCafeInput) => Promise<string>;
  deleteCafe: (id: string) => Promise<void>;
  addReview: (cafeId: string, rating: number, body: string, photo: string | null) => Promise<void>;
  deleteReview: (id: string) => Promise<void>;
  reportReview: (reviewId: string, reason: string) => Promise<void>;
  dismissReports: (reviewId: string) => Promise<void>;
  toggleFav: (cafeId: string, st: FavStatus) => Promise<void>;
  renameMe: (name: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const Ctx = createContext<AppCtx>(null as unknown as AppCtx);
export const useApp = () => useContext(Ctx);
