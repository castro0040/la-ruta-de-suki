export type DayKey = "lun" | "mar" | "mie" | "jue" | "vie" | "sab" | "dom";
export type Hours = Partial<Record<DayKey, { o: string; c: string } | null>>;

export type Cafe = {
  id: string;
  owner_id: string | null;
  name: string;
  address: string | null;
  barrio: string | null;
  lat: number;
  lng: number;
  hours: Hours;
  tags: string[];
  description: string | null;
  price: number;
  phone: string | null;
  instagram: string | null;
  website: string | null;
  drinks: string | null;
  photos: string[];
  menu: string[];
  is_example: boolean;
  source: string | null;
  osm_id: string | null;
  status?: "active" | "closed";
  created_at: string;
};

export type Review = {
  id: string;
  cafe_id: string;
  user_id: string;
  rating: number;
  body: string | null;
  photo: string | null;
  created_at: string;
};

export type Profile = {
  id: string;
  display_name: string | null;
  role: "user" | "admin";
};

export type Report = {
  id: string;
  review_id: string;
  reporter_id: string;
  reason: string;
  created_at: string;
};

export type CafeReason = "closed" | "other_place" | "duplicate" | "wrong_data";

export type CafeReport = {
  id: string;
  cafe_id: string;
  reporter_id: string;
  reason: CafeReason;
  note: string | null;
  created_at: string;
};

export type FavStatus = "want" | "been";

export type DraftHours = Record<DayKey, { closed: boolean; o: string; c: string }>;

export type Draft = {
  id: string | null;
  name: string;
  address: string;
  barrio: string;
  lat: number;
  lng: number;
  pinned: boolean;
  description: string;
  tags: string[];
  price: number;
  phone: string;
  instagram: string;
  website: string;
  drinks: string;
  hours: DraftHours;
  photos: string[];
  menu: string[];
  file: File | null;
  menuFiles: File[];
};

export type View = "list" | "detail" | "rank" | "profile" | "mod" | "add" | "auth";
