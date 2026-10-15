"use client";

import dynamic from "next/dynamic";

// El mapa y la sesión solo funcionan en el navegador, por eso se carga sin render en servidor.
const App = dynamic(() => import("@/components/App"), {
  ssr: false,
  loading: () => <p style={{ padding: 24, color: "#9AA0A6" }}>Cargando La Ruta de Suki…</p>,
});

export default function Page() {
  return <App />;
}
