"use client";

import { useState } from "react";
import { useApp } from "@/lib/ctx";
import { sb } from "@/lib/supabase";

export default function AuthView() {
  const { go } = useApp();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setInfo("");
    setBusy(true);
    if (mode === "in") {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) setErr(error.message === "Invalid login credentials" ? "Correo o contraseña incorrectos." : error.message);
      else go("list");
    } else {
      const { data, error } = await sb.auth.signUp({ email, password, options: { data: { display_name: name.trim() } } });
      if (error) setErr(error.message);
      else if (!data.session) setInfo("Te enviamos un correo para confirmar tu cuenta. Ábrelo y luego inicia sesión.");
      else go("list");
    }
    setBusy(false);
  }

  return (
    <>
      <button className="btn ghost" type="button" onClick={() => go("list")}>← Volver</button>
      <h2>{mode === "in" ? "Entrar" : "Crear cuenta"}</h2>
      <p className="hint">Con tu cuenta puedes agregar cafeterías, reseñar y guardar tus lugares.</p>
      <form className="form" onSubmit={submit} style={{ marginTop: 12 }}>
        {mode === "up" && (
          <label htmlFor="aname">
            Tu nombre
            <input id="aname" className="field" required minLength={2} maxLength={60} autoComplete="nickname" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        )}
        <label htmlFor="aemail">
          Correo
          <input id="aemail" className="field" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label htmlFor="apass">
          Contraseña
          <input id="apass" className="field" type="password" required minLength={6} autoComplete={mode === "in" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <div className="err" role="alert">{err}</div>
        {info && <div className="notice">{info}</div>}
        <button className="btn primary" type="submit" disabled={busy}>{busy ? "Un momento…" : mode === "in" ? "Entrar" : "Crear cuenta"}</button>
      </form>
      <p className="hint" style={{ marginTop: 12 }}>
        {mode === "in" ? "¿Primera vez? " : "¿Ya tienes cuenta? "}
        <button className="link" type="button" onClick={() => { setMode(mode === "in" ? "up" : "in"); setErr(""); setInfo(""); }}>
          {mode === "in" ? "Crea tu cuenta" : "Entra aquí"}
        </button>
      </p>
    </>
  );
}
