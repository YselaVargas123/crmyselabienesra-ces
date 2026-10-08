import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Home, ListChecks, Kanban, CheckCircle2, Users, Building2, CalendarClock, TrendingUp, BarChart3, Settings, Moon, Sun, LogOut, Menu, X, Search, Plus, type LucideIcon } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useApp, type Modo } from "../context/AppContext";
import { Avatar, Boton } from "./ui";
import Buscador from "./Buscador";
import ContactoForm from "./ContactoForm";

interface Item { a: string; t: string; i: LucideIcon }
const GRUPOS: { g: string; items: Item[] }[] = [
  { g: "Trabajo diario", items: [{ a: "/", t: "Hoy", i: Home }, { a: "/actividades", t: "Actividades", i: ListChecks }, { a: "/pipeline", t: "Pipeline", i: Kanban }, { a: "/cierre", t: "Cierre del día", i: CheckCircle2 }] },
  { g: "Personas y propiedades", items: [{ a: "/contactos", t: "Contactos", i: Users }, { a: "/propiedades", t: "Propiedades", i: Building2 }, { a: "/vencimientos", t: "Vencimientos", i: CalendarClock }] },
  { g: "Análisis", items: [{ a: "/resumen", t: "Resumen", i: TrendingUp }, { a: "/reportes", t: "Reportes", i: BarChart3 }] },
];

function Marca() {
  return (
    <div className="px-4 pt-4">
      <div className="text-sm font-extrabold tracking-wide">YSELA VARGAS</div>
      <div className="text-xs opacity-80">Bienes Raíces</div>
      <div className="mt-2 flex h-1 w-12 overflow-hidden rounded-sm" aria-hidden><i className="flex-1 bg-white" /><i className="flex-1 bg-accent" /><i className="flex-1 bg-white" /></div>
    </div>
  );
}
function Enlaces({ alNavegar }: { alNavegar?: () => void }) {
  return (
    <div className="flex-1 overflow-y-auto px-2 py-3">
      {GRUPOS.map((gr) => (
        <div key={gr.g} className="mb-3">
          <div className="px-2 pb-1 text-xs font-semibold opacity-80">{gr.g}</div>
          {gr.items.map(({ a, t, i: I }) => (
            <NavLink key={a} to={a} end={a === "/"} onClick={alNavegar}
              className={({ isActive }) => `flex min-h-[40px] items-center gap-2 rounded-md px-2 text-sm ${isActive ? "bg-white font-bold text-brand" : "font-medium text-white hover:bg-white/10"}`}>
              {({ isActive }) => (<><I size={16} />{t}{isActive && <i className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />}</>)}
            </NavLink>
          ))}
        </div>
      ))}
    </div>
  );
}
function Ajustes({ alNavegar }: { alNavegar?: () => void }) {
  return (
    <NavLink to="/configuracion" onClick={alNavegar} className={({ isActive }) => `mx-2 mb-3 flex min-h-[40px] items-center gap-2 rounded-md px-2 text-sm ${isActive ? "bg-white font-bold text-brand" : "text-white hover:bg-white/10"}`}>
      <Settings size={16} />Configuración
    </NavLink>
  );
}

export default function Layout() {
  const { perfil, salir } = useAuth();
  const { oscuro, alternarTema, modo, setModo } = useApp();
  const [menu, setMenu] = useState(false);
  const [perfilAbierto, setPerfilAbierto] = useState(false);
  const [buscar, setBuscar] = useState(false);
  const [nuevo, setNuevo] = useState(false);
  const nav = useNavigate();
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setBuscar(true); } };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, []);
  const nombre = perfil?.full_name ?? "";

  return (
    <div className="flex h-full">
      <nav aria-label="Principal" className="hidden w-[216px] shrink-0 flex-col bg-brand text-white md:flex"><Marca /><Enlaces /><Ajustes /></nav>

      {menu && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Menú">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMenu(false)} />
          <nav className="absolute inset-y-0 left-0 flex w-[260px] flex-col bg-brand text-white">
            <button aria-label="Cerrar menú" onClick={() => setMenu(false)} className="absolute right-2 top-2 p-2"><X size={20} /></button>
            <Marca /><Enlaces alNavegar={() => setMenu(false)} /><Ajustes alNavegar={() => setMenu(false)} />
          </nav>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-line bg-card px-4 py-2 md:px-6" style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}>
          <div role="group" aria-label="Proceso comercial" className="flex rounded-full border border-line p-0.5">
            {(["Captación", "Colocación"] as Modo[]).map((m) => (
              <button key={m} onClick={() => setModo(m)} aria-pressed={modo === m} className={`min-h-[32px] rounded-full px-3 text-sm font-semibold ${modo === m ? "bg-brand text-white" : "text-muted"}`}>{m}</button>
            ))}
          </div>
          <button onClick={() => setBuscar(true)} aria-label="Buscar o ejecutar acción" className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-md border border-line px-3 text-sm text-muted md:h-9 md:max-w-md">
            <Search size={15} /><span className="hidden truncate sm:inline">Buscar o ejecutar acción</span><kbd className="ml-auto hidden rounded border border-line px-1 text-xs md:inline">Ctrl K</kbd>
          </button>
          <Boton variante="principal" onClick={() => setNuevo(true)}><Plus size={15} />Contacto</Boton>
          <button onClick={alternarTema} aria-label={oscuro ? "Cambiar a tema claro" : "Cambiar a tema oscuro"} className="flex h-11 w-11 items-center justify-center text-muted md:h-9 md:w-9">
            {oscuro ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <div className="relative">
            <button onClick={() => setPerfilAbierto((p) => !p)} aria-haspopup="menu" aria-expanded={perfilAbierto} aria-label="Menú de perfil" className="flex items-center gap-2"><Avatar nombre={nombre} /></button>
            {perfilAbierto && (
              <div role="menu" className="absolute right-0 top-9 z-30 w-56 rounded-lg border border-line bg-card p-2 shadow-lg">
                <div className="px-2 py-1 text-sm font-bold">{nombre}</div>
                <div className="px-2 pb-2 text-xs text-muted">{perfil?.role === "agente" ? "Agente inmobiliario" : "Asistente"}</div>
                <button role="menuitem" onClick={salir} className="flex min-h-[40px] w-full items-center gap-2 rounded-md px-2 text-sm hover:bg-head"><LogOut size={15} />Cerrar sesión</button>
              </div>
            )}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 pb-24 md:p-7 md:pb-7"><Outlet /></main>
        <nav aria-label="Barra inferior" className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-line bg-card md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          {[{ a: "/", t: "Hoy", i: Home }, { a: "/contactos", t: "Contactos", i: Users }, { a: "/pipeline", t: "Pipeline", i: Kanban }].map(({ a, t, i: I }) => (
            <NavLink key={a} to={a} end={a === "/"} className={({ isActive }) => `flex min-h-[56px] flex-1 flex-col items-center justify-center text-xs ${isActive ? "font-bold text-brand dark:text-blue-300" : "text-muted"}`}><I size={20} />{t}</NavLink>
          ))}
          <button onClick={() => setMenu(true)} className="flex min-h-[56px] flex-1 flex-col items-center justify-center text-xs text-muted"><Menu size={20} />Más</button>
        </nav>
      </div>
      {buscar && <Buscador onClose={() => setBuscar(false)} onNuevoContacto={() => setNuevo(true)} />}
      {nuevo && <ContactoForm onClose={() => setNuevo(false)} onVer={(id) => { setNuevo(false); nav(`/contactos?ficha=${id}`); }} onGuardado={(id) => { setNuevo(false); nav(`/contactos?ficha=${id}`); }} />}
    </div>
  );
}
