import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AppProvider } from "./context/AppContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Hoy from "./pages/Hoy";
import Pendiente from "./pages/Pendiente";
import Contactos from "./pages/Contactos";
import Pipeline from "./pages/Pipeline";
import Propiedades from "./pages/Propiedades";
import Actividades from "./pages/Actividades";
import Cierre from "./pages/Cierre";
import Vencimientos from "./pages/Vencimientos";
import { ToastProvider } from "./components/Toast";

const SECCIONES: [string, string, string][] = [
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
        <Route path="pipeline" element={<Pipeline />} />
        <Route path="propiedades" element={<Propiedades />} />
        <Route path="actividades" element={<Actividades />} />
        <Route path="cierre" element={<Cierre />} />
        <Route path="vencimientos" element={<Vencimientos />} />
        {SECCIONES.map(([ruta, t, f]) => <Route key={ruta} path={ruta} element={<Pendiente titulo={t} fase={f} />} />)}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
export default function App() {
  return <BrowserRouter><AppProvider><ToastProvider><AuthProvider><Rutas /></AuthProvider></ToastProvider></AppProvider></BrowserRouter>;
}
