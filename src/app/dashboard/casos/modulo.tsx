"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { Caso } from "@/lib/casos";
import {
  ESTADOS_CASO,
  estaCerrado,
  TIPOS_CASO,
  type AlertaSla,
  type EstadoCaso,
} from "@/lib/casos-comun";
import type { ClienteCore } from "@/lib/clientes";
import {
  motivoSinAcceso,
  puedeEditar,
  type Permisos,
} from "@/lib/permisos";
import { formatearFecha } from "@/lib/fechas";
import { IconAlert, IconFilter, IconPlus, IconSearch } from "../icons";
import { FormularioCaso } from "./formulario-caso";

const card =
  "rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900";
const input =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors duration-200 placeholder:text-slate-500 focus:border-blue-600 disabled:opacity-60 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-blue-400";

/** Lo mínimo para identificar la visita que originó un caso. */
export type VisitaOrigen = {
  recordId: string;
  idClienteCore: string | null;
  cliente: string;
  fecha: string | null;
  objetivo: string | null;
};

type Props = {
  casos: Caso[];
  clientes: ClienteCore[];
  visitas: VisitaOrigen[];
  personal: { nombre: string; rol: string | null; idEmpleado: string }[];
  sesion: { idEmpleado: string; nombre: string };
  hoy: string;
  permisos: Permisos;
};

export function ModuloCasos({
  casos,
  clientes,
  visitas,
  personal,
  sesion,
  hoy,
  permisos,
}: Props) {
  const [formularioAbierto, setFormularioAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("pendientes");
  const [tipo, setTipo] = useState("");
  const [responsable, setResponsable] = useState("");

  const responsables = useMemo(() => {
    const valores = new Set<string>();
    for (const caso of casos) {
      if (caso.responsable) valores.add(caso.responsable);
    }
    return [...valores].sort((a, b) => a.localeCompare(b, "es"));
  }, [casos]);

  const resumen = useMemo(
    () => ({
      abiertos: casos.filter((c) => !estaCerrado(c.estado)).length,
      vencidos: casos.filter((c) => c.alerta === "vencido").length,
      hoy: casos.filter((c) => c.alerta === "hoy").length,
      sinPlazo: casos.filter((c) => c.alerta === "sin-plazo").length,
    }),
    [casos],
  );

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();

    return casos.filter((caso) => {
      const texto =
        `${caso.cliente} ${caso.id} ${caso.descripcion ?? ""} ${caso.responsable ?? ""}`.toLowerCase();

      if (termino && !texto.includes(termino)) return false;
      if (estado === "pendientes" && estaCerrado(caso.estado)) return false;
      if (estado === "cerrados" && !estaCerrado(caso.estado)) return false;
      if (estado === "vencidos" && caso.alerta !== "vencido") return false;
      if (
        ESTADOS_CASO.includes(estado as EstadoCaso) &&
        caso.estado !== estado
      ) {
        return false;
      }
      if (tipo && caso.tipo !== tipo) return false;
      if (responsable && caso.responsable !== responsable) return false;

      return true;
    });
  }, [casos, busqueda, estado, tipo, responsable]);

  // Lo vencido primero: es lo que el equipo tiene que resolver hoy.
  const ordenados = useMemo(() => {
    const peso: Record<AlertaSla, number> = {
      vencido: 0,
      hoy: 1,
      "en-plazo": 2,
      "sin-plazo": 3,
      cerrado: 4,
    };
    return [...filtrados].sort(
      (a, b) =>
        peso[a.alerta] - peso[b.alerta] ||
        (a.fechaLimite ?? "9999").localeCompare(b.fechaLimite ?? "9999"),
    );
  }, [filtrados]);

  return (
    <div className="mx-auto flex max-w-[100rem] flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Casos</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Requerimientos abiertos por el cliente — quejas, dudas técnicas y
            solicitudes — con su plazo de respuesta.
          </p>
        </div>

        {permisos.crear ? (
          <button
            type="button"
            onClick={() => setFormularioAbierto(true)}
            className="flex cursor-pointer items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            <IconPlus className="h-4 w-4" />
            Abrir caso
          </button>
        ) : null}
      </div>

      {permisos.verTodo ? null : (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
          {motivoSinAcceso(permisos)}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Resumen titulo="Sin resolver" valor={resumen.abiertos} />
        <Resumen titulo="Plazo vencido" valor={resumen.vencidos} tono="rojo" />
        <Resumen titulo="Vencen hoy" valor={resumen.hoy} tono="ambar" />
        <Resumen titulo="Sin plazo definido" valor={resumen.sinPlazo} />
      </div>

      <section className={`${card} p-5`}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-56 flex-1 lg:max-w-md">
            <IconSearch className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
            <label htmlFor="buscar-caso" className="sr-only">
              Buscar casos
            </label>
            <input
              id="buscar-caso"
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por cliente, código, descripción o responsable…"
              className={`${input} pl-9`}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
            <IconFilter className="h-4 w-4 text-slate-500 dark:text-slate-400" />

            <label htmlFor="filtro-estado-caso" className="sr-only">
              Estado del caso
            </label>
            <select
              id="filtro-estado-caso"
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className={`${input} w-auto cursor-pointer`}
            >
              <option value="pendientes">Sin resolver</option>
              <option value="vencidos">Plazo vencido</option>
              {ESTADOS_CASO.map((valor) => (
                <option key={valor} value={valor}>
                  {valor}
                </option>
              ))}
              <option value="cerrados">Resueltos y cerrados</option>
              <option value="todos">Todos</option>
            </select>

            <label htmlFor="filtro-tipo-caso" className="sr-only">
              Tipo de requerimiento
            </label>
            <select
              id="filtro-tipo-caso"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className={`${input} w-auto cursor-pointer`}
            >
              <option value="">Todo tipo</option>
              {TIPOS_CASO.map((valor) => (
                <option key={valor} value={valor}>
                  {valor}
                </option>
              ))}
            </select>

            <label htmlFor="filtro-responsable-caso" className="sr-only">
              Responsable
            </label>
            <select
              id="filtro-responsable-caso"
              value={responsable}
              onChange={(e) => setResponsable(e.target.value)}
              className={`${input} w-auto cursor-pointer`}
            >
              <option value="">Todo responsable</option>
              {responsables.map((valor) => (
                <option key={valor} value={valor}>
                  {valor}
                </option>
              ))}
            </select>
          </div>
        </div>

        {ordenados.length === 0 ? (
          <div className="mt-8 pb-4 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {casos.length === 0
                ? "Todavía no hay casos registrados. Abre el primero cuando un cliente deje un requerimiento."
                : "Ningún caso coincide con estos filtros."}
            </p>
            {casos.length === 0 && permisos.crear ? (
              <button
                type="button"
                onClick={() => setFormularioAbierto(true)}
                className="mt-4 cursor-pointer rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium transition-colors duration-200 hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10"
              >
                Abrir el primer caso
              </button>
            ) : null}
          </div>
        ) : (
          <div className="-mx-5 mt-4 overflow-x-auto">
            <table className="w-full min-w-[62rem] text-sm">
              <thead>
                <tr className="border-y border-slate-200 text-left text-xs tracking-wide text-slate-600 uppercase dark:border-white/10 dark:text-slate-400">
                  {[
                    "Caso",
                    "Cliente",
                    "Tipo",
                    "Responsable",
                    "Abierto",
                    "Plazo",
                    "Estado",
                    "Acciones",
                  ].map((columna) => (
                    <th
                      key={columna}
                      scope="col"
                      className="px-5 py-2.5 font-semibold whitespace-nowrap"
                    >
                      {columna}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {ordenados.map((caso) => (
                  <FilaCaso
                    key={caso.recordId}
                    caso={caso}
                    hoy={hoy}
                    editable={puedeEditar(permisos, caso, sesion)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {formularioAbierto ? (
        <FormularioCaso
          clientes={clientes}
          visitas={visitas}
          personal={personal}
          sesion={sesion}
          hoy={hoy}
          onCerrar={() => setFormularioAbierto(false)}
        />
      ) : null}
    </div>
  );
}

function FilaCaso({
  caso,
  hoy,
  editable,
}: {
  caso: Caso;
  hoy: string;
  editable: boolean;
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reprogramando, setReprogramando] = useState(false);

  async function enviar(cuerpo: Record<string, unknown>) {
    setOcupado(true);
    setError(null);

    const respuesta = await fetch(`/api/casos/${caso.recordId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });

    setOcupado(false);

    if (!respuesta.ok) {
      const data = await respuesta.json().catch(() => ({}));
      setError(String(data.error ?? "No pudimos actualizar el caso."));
      return;
    }

    setReprogramando(false);
    router.refresh();
  }

  const cerrado = estaCerrado(caso.estado);

  return (
    <tr className="align-top transition-colors duration-200 hover:bg-slate-50 dark:hover:bg-white/5">
      <td className="px-5 py-3">
        <span className="block text-xs font-semibold text-slate-500 tabular-nums dark:text-slate-500">
          {caso.id}
        </span>
        <p className="mt-0.5 max-w-xs text-slate-700 dark:text-slate-300">
          {caso.descripcion ?? "Sin descripción"}
        </p>
        {error ? (
          <p
            role="alert"
            className="mt-1 text-xs font-medium text-red-700 dark:text-red-400"
          >
            {error}
          </p>
        ) : null}
      </td>
      <td className="px-5 py-3">{caso.cliente}</td>
      <td className="px-5 py-3">{caso.tipo ?? "—"}</td>
      <td className="px-5 py-3">{caso.responsable ?? "—"}</td>
      <td className="px-5 py-3 whitespace-nowrap">
        {formatearFecha(caso.fechaApertura)}
        {caso.diasAbierto !== null ? (
          <span className="block text-xs text-slate-500 tabular-nums dark:text-slate-500">
            {caso.diasAbierto} {caso.diasAbierto === 1 ? "día" : "días"}
          </span>
        ) : null}
      </td>
      <td className="px-5 py-3 whitespace-nowrap">
        {reprogramando ? (
          <input
            type="date"
            autoFocus
            min={caso.fechaApertura ?? undefined}
            defaultValue={caso.fechaLimite ?? hoy}
            disabled={ocupado}
            onBlur={() => setReprogramando(false)}
            onChange={(e) =>
              e.target.value &&
              enviar({ accion: "reprogramar", fecha: e.target.value })
            }
            className={`${input} w-40`}
          />
        ) : (
          <>
            {formatearFecha(caso.fechaLimite)}
            <span className="mt-1 block">
              <Alerta alerta={caso.alerta} />
            </span>
          </>
        )}
      </td>
      <td className="px-5 py-3">
        <EstadoCasoBadge estado={caso.estado} />
      </td>
      <td className="px-5 py-3 whitespace-nowrap">
        {!editable ? (
          <span className="text-xs text-slate-500 dark:text-slate-500">
            solo lectura
          </span>
        ) : (
        <div className="flex items-center gap-1.5">
          {caso.estado === "Abierto" ? (
            <Accion
              onClick={() => enviar({ accion: "estado", estado: "En proceso" })}
              disabled={ocupado}
            >
              Tomar
            </Accion>
          ) : null}

          {cerrado ? (
            <Accion
              onClick={() => enviar({ accion: "estado", estado: "Abierto" })}
              disabled={ocupado}
            >
              Reabrir
            </Accion>
          ) : (
            <>
              <Accion
                onClick={() => enviar({ accion: "estado", estado: "Resuelto" })}
                disabled={ocupado}
                destacada
              >
                Resolver
              </Accion>
              <Accion
                onClick={() => setReprogramando(true)}
                disabled={ocupado || reprogramando}
              >
                Plazo
              </Accion>
            </>
          )}
        </div>
        )}
      </td>
    </tr>
  );
}

function Accion({
  onClick,
  disabled,
  destacada,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  destacada?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none disabled:opacity-50 ${
        destacada
          ? "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          : "border border-slate-200 hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

const TONOS_ALERTA: Record<AlertaSla, { texto: string; clase: string }> = {
  vencido: {
    texto: "vencido",
    clase: "bg-red-50 text-red-800 dark:bg-red-500/15 dark:text-red-300",
  },
  hoy: {
    texto: "vence hoy",
    clase: "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  },
  "en-plazo": {
    texto: "en plazo",
    clase:
      "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  "sin-plazo": {
    texto: "sin plazo",
    clase: "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300",
  },
  cerrado: {
    texto: "cerrado",
    clase: "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-400",
  },
};

function Alerta({ alerta }: { alerta: AlertaSla }) {
  const tono = TONOS_ALERTA[alerta];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${tono.clase}`}
    >
      {alerta === "vencido" ? <IconAlert className="h-3 w-3" /> : null}
      {tono.texto}
    </span>
  );
}

const TONOS_ESTADO: Record<string, string> = {
  Abierto: "bg-blue-50 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300",
  "En proceso":
    "bg-violet-50 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300",
  Resuelto:
    "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  Cerrado: "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300",
};

function EstadoCasoBadge({ estado }: { estado: string | null }) {
  const clase =
    (estado && TONOS_ESTADO[estado]) ??
    "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300";

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${clase}`}
    >
      {estado ?? "Sin estado"}
    </span>
  );
}

function Resumen({
  titulo,
  valor,
  tono,
}: {
  titulo: string;
  valor: number;
  tono?: "rojo" | "ambar";
}) {
  const color =
    tono === "rojo"
      ? "text-red-700 dark:text-red-400"
      : tono === "ambar"
        ? "text-amber-700 dark:text-amber-400"
        : "text-slate-900 dark:text-slate-100";

  return (
    <div className={`${card} p-5`}>
      <p className="text-sm text-slate-600 dark:text-slate-400">{titulo}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${color}`}>
        {valor}
      </p>
    </div>
  );
}

