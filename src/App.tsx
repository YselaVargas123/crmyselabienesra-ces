import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AppProvider } from "./context/AppContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Hoy from "./pages/Hoy";
import Pendiente from "./pages/Pendiente";
import Contactos from "./pages/Contactos";
import { ToastProvider } from "./components/Toast";

const SECCIONES: [string, string, string][] = [
  ["actividades", "Actividades", "Fase 4"], ["pipeline", "Pipeline", "Fase 3"], ["cierre", "Cierre del día", "Fase 4"],
  ["propiedades", "Propiedades", "Fase 3"], ["vencimientos", "Vencimientos", "Fase 4"],
  ["resumen", "Resumen", "Fase 5"], ["reportes", "Reportes", "Fase 5"], ["configuracion", "Configuración", "Fase 6"],
];

function Rutas() {
  const { session, perfil, cargando } = useAuth();
  if (cargando) return <div className="flex h-full items-center justify-center text-sm text-muted" role="status">Cargando…</div>;
  if (!session || !perfil) return <Login />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Hoy />} />
        <Route path="contactos" element={<Contactos />} />
        {SECCIONES.map(([ruta, t, f]) => <Route key={ruta} path={ruta} element={<Pendiente titulo={t} fase={f} />} />)}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
export default function App() {
  return <BrowserRouter><AppProvider><ToastProvider><AuthProvider><Rutas /></AuthProvider></ToastProvider></AppProvider></BrowserRouter>;
}
