"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import type { Permisos } from "@/lib/permisos";
import { LogoSirius } from "../logo";
import { BotonSalir } from "./boton-salir";
import {
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
  /** True si el módulo muestra datos de terceros y exige alcance de equipo. */
  deEquipo?: boolean;
};

const grupos: { titulo: string; items: ItemNav[] }[] = [
  {
    titulo: "Comercial",
    items: [
      { id: "inicio", etiqueta: "Inicio", Icono: IconHome, href: "/dashboard" },
      {
        id: "clientes",
        deEquipo: true,
        etiqueta: "Clientes",
        Icono: IconBuilding,
        href: "/dashboard/clientes",
      },
      {
        id: "contactos",
        deEquipo: true,
        etiqueta: "Contactos",
        Icono: IconUsers,
        href: "/dashboard/contactos",
      },
      { id: "oportunidades", etiqueta: "Oportunidades", Icono: IconTrending },
      {
        id: "visitas",
        etiqueta: "Visitas",
        Icono: IconRoute,
        href: "/dashboard/visitas",
      },
      {
        id: "cotizaciones",
        etiqueta: "Cotizaciones",
        Icono: IconFile,
        href: "/dashboard/cotizaciones",
      },
    ],
  },
  {
    titulo: "Operación",
    items: [
      {
        id: "pedidos",
        etiqueta: "Pedidos",
        Icono: IconCart,
        href: "/dashboard/pedidos",
      },
      {
        id: "productos",
        deEquipo: true,
        etiqueta: "Productos",
        Icono: IconPackage,
        href: "/dashboard/productos",
      },
      {
        id: "casos",
        etiqueta: "Casos",
        Icono: IconLifebuoy,
        href: "/dashboard/casos",
      },
      { id: "tareas", etiqueta: "Tareas", Icono: IconCheckSquare },
    ],
  },
  {
    titulo: "Análisis",
    items: [
      { id: "campanas", etiqueta: "Campañas", Icono: IconMegaphone },
      { id: "reportes", etiqueta: "Reportes", Icono: IconChart },
      {
        id: "configuracion",
        etiqueta: "Configuración",
        Icono: IconSettings,
        href: "/dashboard/configuracion",
      },
    ],
  },
];

export function Shell({
  nombre,
  rol,
  permisos,
  children,
}: {
  nombre: string;
  rol: string | null;
  permisos: Permisos;
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

      <Sidebar
        abierto={menuAbierto}
        permisos={permisos}
        onCerrar={() => setMenuAbierto(false)}
      />

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
  permisos,
  onCerrar,
}: {
  abierto: boolean;
  permisos: Permisos;
  onCerrar: () => void;
}) {
  const pathname = usePathname();

  // No se ofrecen puertas que no abren: sin alcance de equipo, los módulos de
  // datos de terceros no aparecen en el menú.
  const visibles = grupos
    .map((grupo) => ({
      ...grupo,
      items: grupo.items.filter((item) => permisos.verTodo || !item.deEquipo),
    }))
    .filter((grupo) => grupo.items.length > 0);

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-30 flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 dark:border-white/10 dark:bg-slate-900 ${
        abierto ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex h-16 items-center justify-between gap-3 border-b border-slate-200 px-5 dark:border-white/10">
        <Link
          href="/dashboard"
          onClick={onCerrar}
          title="Ir al inicio"
          className="flex items-center rounded-md focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none"
        >
          <LogoSirius />
        </Link>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar menú"
          className="-mr-2 cursor-pointer rounded-lg p-2 text-slate-600 transition-colors duration-200 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-white/10"
        >
          <IconClose className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Principal">
        {visibles.map((grupo) => (
          <div key={grupo.titulo} className="mb-6">
            <p className="px-3 pb-2 text-[10px] font-semibold tracking-[0.12em] text-slate-400 uppercase dark:text-slate-500">
              {grupo.titulo}
            </p>
            <ul className="flex flex-col gap-0.5">
              {grupo.items.map((item) => {
                const activo = item.href === pathname;
                // Los módulos sin ruta aún no existen: deben verse apagados y
                // no idénticos a los que sí navegan.
                const estado = activo
                  ? "bg-blue-50 font-medium text-blue-800 dark:bg-blue-500/15 dark:text-blue-300"
                  : item.href
                    ? "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
                    : "cursor-default text-slate-400 dark:text-slate-600";
                const clases = `flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none ${
                  item.href ? "cursor-pointer" : ""
                } ${estado}`;

                const contenido = (
                  <>
                    <item.Icono className="h-5 w-5 shrink-0" />
                    <span className="flex-1 text-left">{item.etiqueta}</span>
                    {item.contador ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
                          item.href
                            ? "bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-200"
                            : "bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-slate-600"
                        }`}
                      >
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
        className="cursor-pointer rounded-lg p-2 text-slate-700 transition-colors duration-200 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none lg:hidden dark:text-slate-200 dark:hover:bg-white/10"
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
          className="w-full max-w-md rounded-lg border border-slate-200 bg-slate-50 py-2 pr-3 pl-9 text-sm text-slate-900 transition-colors duration-200 outline-none placeholder:text-slate-500 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/20 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-blue-400"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
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
