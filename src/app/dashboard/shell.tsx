"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { BotonSalir } from "./boton-salir";
import {
  IconBell,
  IconBuilding,
  IconCart,
  IconChart,
  IconCheckSquare,
  IconClose,
  IconFile,
  IconHome,
  IconLifebuoy,
  IconMegaphone,
  IconMenu,
  IconPackage,
  IconPlus,
  IconRoute,
  IconSearch,
  IconSettings,
  IconTrending,
  IconUsers,
} from "./icons";

type ItemNav = {
  id: string;
  etiqueta: string;
  Icono: (props: { className?: string }) => React.ReactElement;
  contador?: number;
  /** Solo los módulos ya construidos tienen ruta; el resto va deshabilitado. */
  href?: string;
};

const grupos: { titulo: string; items: ItemNav[] }[] = [
  {
    titulo: "Comercial",
    items: [
      { id: "inicio", etiqueta: "Inicio", Icono: IconHome, href: "/dashboard" },
      {
        id: "clientes",
        etiqueta: "Clientes",
        Icono: IconBuilding,
        href: "/dashboard/clientes",
      },
      { id: "contactos", etiqueta: "Contactos", Icono: IconUsers },
      {
        id: "oportunidades",
        etiqueta: "Oportunidades",
        Icono: IconTrending,
        contador: 38,
      },
      {
        id: "visitas",
        etiqueta: "Visitas",
        Icono: IconRoute,
        href: "/dashboard/visitas",
      },
      { id: "cotizaciones", etiqueta: "Cotizaciones", Icono: IconFile },
    ],
  },
  {
    titulo: "Operación",
    items: [
      { id: "pedidos", etiqueta: "Pedidos", Icono: IconCart },
      { id: "productos", etiqueta: "Productos", Icono: IconPackage },
      { id: "casos", etiqueta: "Casos", Icono: IconLifebuoy, contador: 17 },
      { id: "tareas", etiqueta: "Tareas", Icono: IconCheckSquare, contador: 4 },
    ],
  },
  {
    titulo: "Análisis",
    items: [
      { id: "campanas", etiqueta: "Campañas", Icono: IconMegaphone },
      { id: "reportes", etiqueta: "Reportes", Icono: IconChart },
      { id: "configuracion", etiqueta: "Configuración", Icono: IconSettings },
    ],
  },
];

export function Shell({
  nombre,
  rol,
  children,
}: {
  nombre: string;
  rol: string | null;
  children: React.ReactNode;
}) {
  const [menuAbierto, setMenuAbierto] = useState(false);

  return (
    <div className="flex min-h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Fondo oscuro del menú en móvil */}
      {menuAbierto ? (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setMenuAbierto(false)}
          className="fixed inset-0 z-20 cursor-pointer bg-slate-900/40 lg:hidden"
        />
      ) : null}

      <Sidebar abierto={menuAbierto} onCerrar={() => setMenuAbierto(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          nombre={nombre}
          rol={rol}
          onAbrirMenu={() => setMenuAbierto(true)}
        />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function Sidebar({
  abierto,
  onCerrar,
}: {
  abierto: boolean;
  onCerrar: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-30 flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 dark:border-white/10 dark:bg-slate-900 ${
        abierto ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5 dark:border-white/10">
        <span className="text-base font-semibold tracking-tight">
          Sirius <span className="text-blue-700 dark:text-blue-400">CRM</span>
        </span>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar menú"
          className="cursor-pointer rounded-lg p-2 text-slate-600 transition-colors duration-200 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-white/10"
        >
          <IconClose className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Principal">
        {grupos.map((grupo) => (
          <div key={grupo.titulo} className="mb-6">
            <p className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
              {grupo.titulo}
            </p>
            <ul className="flex flex-col gap-0.5">
              {grupo.items.map((item) => {
                const activo = item.href === pathname;
                const clases = `flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none ${
                  activo
                    ? "bg-blue-50 font-semibold text-blue-800 dark:bg-blue-500/15 dark:text-blue-300"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
                }`;

                const contenido = (
                  <>
                    <item.Icono className="h-5 w-5 shrink-0" />
                    <span className="flex-1 text-left">{item.etiqueta}</span>
                    {item.contador ? (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-200">
                        {item.contador}
                      </span>
                    ) : null}
                  </>
                );

                return (
                  <li key={item.id}>
                    {item.href ? (
                      <Link
                        href={item.href}
                        onClick={onCerrar}
                        aria-current={activo ? "page" : undefined}
                        className={clases}
                      >
                        {contenido}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        title="Próximamente"
                        className={clases}
                      >
                        {contenido}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-200 p-3 dark:border-white/10">
        <div className="rounded-xl bg-slate-100 p-4 dark:bg-white/5">
          <p className="text-sm font-semibold">Plan de siembra 2027</p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            12 cuentas clave sin visita en los últimos 60 días.
          </p>
        </div>
      </div>
    </aside>
  );
}

function TopBar({
  nombre,
  rol,
  onAbrirMenu,
}: {
  nombre: string;
  rol: string | null;
  onAbrirMenu: () => void;
}) {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6 lg:px-8 dark:border-white/10 dark:bg-slate-900/90">
      <button
        type="button"
        onClick={onAbrirMenu}
        aria-label="Abrir menú"
        className="cursor-pointer rounded-lg p-2 text-slate-700 transition-colors duration-200 hover:bg-slate-100 lg:hidden dark:text-slate-200 dark:hover:bg-white/10"
      >
        <IconMenu className="h-5 w-5" />
      </button>

      <div className="relative hidden min-w-0 flex-1 sm:block">
        <IconSearch className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
        <label htmlFor="buscador" className="sr-only">
          Buscar en el CRM
        </label>
        <input
          id="buscador"
          type="search"
          placeholder="Buscar clientes, oportunidades, casos…"
          className="w-full max-w-md rounded-lg border border-slate-200 bg-slate-50 py-2 pr-3 pl-9 text-sm text-slate-900 transition-colors duration-200 outline-none placeholder:text-slate-500 focus:border-blue-600 focus:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-blue-400"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          title="Próximamente"
          className="hidden cursor-pointer items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-blue-800 sm:flex dark:bg-blue-600 dark:hover:bg-blue-500"
        >
          <IconPlus className="h-4 w-4" />
          Nuevo
        </button>

        <button
          type="button"
          aria-label="Notificaciones (3 sin leer)"
          title="Próximamente"
          className="relative cursor-pointer rounded-lg p-2 text-slate-700 transition-colors duration-200 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
        >
          <IconBell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900" />
        </button>

        <div className="flex items-center gap-2 border-l border-slate-200 pl-2 dark:border-white/10">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-700 text-sm font-semibold text-white"
          >
            {iniciales(nombre)}
          </span>
          <div className="hidden text-left md:block">
            <p className="max-w-[14rem] truncate text-sm font-medium">
              {nombre}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {rol ?? "Equipo Sirius"}
            </p>
          </div>
          <BotonSalir />
        </div>
      </div>
    </header>
  );
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  return `${partes[0]?.[0] ?? ""}${partes[1]?.[0] ?? ""}`.toUpperCase();
}
