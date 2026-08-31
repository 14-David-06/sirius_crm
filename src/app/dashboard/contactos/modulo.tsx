"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  IconFilter,
  IconMail,
  IconPhone,
  IconPlus,
  IconSearch,
} from "../icons";
import { FormularioContacto } from "./formulario-contacto";

const card =
  "tarjeta3d rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900";
const input =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors duration-200 placeholder:text-slate-500 focus:border-blue-600 disabled:opacity-60 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-blue-400";

export type ClienteDelContacto = {
  recordId: string;
  nombre: string;
  ciudad: string | null;
  activo: boolean;
};

export type FilaContacto = {
  recordId: string;
  codigo: string | null;
  nombre: string;
  cargo: string | null;
  cedula: string | null;
  email: string | null;
  telefono: string | null;
  activo: boolean;
  clientes: ClienteDelContacto[];
};

export type ClienteSelector = {
  recordId: string;
  nombre: string;
  ciudad: string | null;
};

export function ModuloContactos({
  filas,
  clientes,
}: {
  filas: FilaContacto[];
  clientes: ClienteSelector[];
}) {
  const [formularioAbierto, setFormularioAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("activos");
  const [cliente, setCliente] = useState("");
  const [contacto, setContacto] = useState("");

  const clientesConContacto = useMemo(() => {
    const valores = new Map<string, string>();
    for (const fila of filas) {
      for (const c of fila.clientes) valores.set(c.recordId, c.nombre);
    }
    return [...valores.entries()].sort((a, b) => a[1].localeCompare(b[1], "es"));
  }, [filas]);

  const cargos = useMemo(() => {
    const valores = new Set<string>();
    for (const fila of filas) {
      if (fila.cargo) valores.add(fila.cargo);
    }
    return [...valores].sort((a, b) => a.localeCompare(b, "es"));
  }, [filas]);

  const resumen = useMemo(
    () => ({
      activos: filas.filter((f) => f.activo).length,
      sinTelefono: filas.filter((f) => f.activo && !f.telefono).length,
      sinEmail: filas.filter((f) => f.activo && !f.email).length,
      clientes: new Set(
        filas.flatMap((f) => f.clientes.map((c) => c.recordId)),
      ).size,
    }),
    [filas],
  );

  const filtradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();

    return filas.filter((fila) => {
      const texto = [
        fila.nombre,
        fila.cargo ?? "",
        fila.codigo ?? "",
        fila.cedula ?? "",
        fila.email ?? "",
        fila.telefono ?? "",
        ...fila.clientes.map((c) => c.nombre),
      ]
        .join(" ")
        .toLowerCase();

      if (termino && !texto.includes(termino)) return false;
      if (estado === "activos" && !fila.activo) return false;
      if (estado === "inactivos" && fila.activo) return false;
      if (estado === "sin-telefono" && fila.telefono) return false;
      if (estado === "sin-email" && fila.email) return false;
      if (cliente && !fila.clientes.some((c) => c.recordId === cliente)) {
        return false;
      }
      if (contacto && fila.cargo !== contacto) return false;

      return true;
    });
  }, [filas, busqueda, estado, cliente, contacto]);

  return (
    <div className="mx-auto flex max-w-[100rem] flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contactos</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            El directorio del personal de tus clientes: quién es, qué cargo
            tiene y cómo ubicarlo.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setFormularioAbierto(true)}
          className="flex cursor-pointer items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none dark:bg-blue-600 dark:hover:bg-blue-500"
        >
          <IconPlus className="h-4 w-4" />
          Nuevo contacto
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Resumen titulo="Contactos activos" valor={resumen.activos} />
        <Resumen titulo="Clientes cubiertos" valor={resumen.clientes} />
        <Resumen
          titulo="Sin teléfono"
          valor={resumen.sinTelefono}
          tono="ambar"
        />
        <Resumen titulo="Sin correo" valor={resumen.sinEmail} tono="ambar" />
      </div>

      <section className={`${card} p-5`}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-56 flex-1 lg:max-w-sm">
            <IconSearch className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
            <label htmlFor="buscar-contacto" className="sr-only">
              Buscar contactos
            </label>
            <input
              id="buscar-contacto"
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, cargo, cliente, correo o teléfono…"
              className={`${input} pl-9`}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
            <IconFilter className="h-4 w-4 text-slate-500 dark:text-slate-400" />

            <label htmlFor="filtro-estado-contacto" className="sr-only">
              Estado del contacto
            </label>
            <select
              id="filtro-estado-contacto"
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className={`${input} w-auto cursor-pointer`}
            >
              <option value="activos">Activos</option>
              <option value="sin-telefono">Sin teléfono</option>
              <option value="sin-email">Sin correo</option>
              <option value="inactivos">Inactivos</option>
              <option value="todos">Todos</option>
            </select>

            <label htmlFor="filtro-cliente-contacto" className="sr-only">
              Cliente
            </label>
            <select
              id="filtro-cliente-contacto"
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              className={`${input} w-auto max-w-48 cursor-pointer`}
            >
              <option value="">Todo cliente</option>
              {clientesConContacto.map(([recordId, nombre]) => (
                <option key={recordId} value={recordId}>
                  {nombre}
                </option>
              ))}
            </select>

            <label htmlFor="filtro-cargo-contacto" className="sr-only">
              Cargo
            </label>
            <select
              id="filtro-cargo-contacto"
              value={contacto}
              onChange={(e) => setContacto(e.target.value)}
              className={`${input} w-auto max-w-48 cursor-pointer`}
            >
              <option value="">Todo cargo</option>
              {cargos.map((valor) => (
                <option key={valor} value={valor}>
                  {valor}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filtradas.length === 0 ? (
          <div className="mt-8 pb-4 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {filas.length === 0
                ? "Todavía no hay personal de contacto en Sirius Clients Core."
                : "Ningún contacto coincide con estos filtros."}
            </p>
            {filas.length === 0 ? (
              <button
                type="button"
                onClick={() => setFormularioAbierto(true)}
                className="mt-4 cursor-pointer rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium transition-colors duration-200 hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10"
              >
                Registrar el primer contacto
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <p className="mt-4 text-xs text-slate-500 dark:text-slate-500">
              {filtradas.length}{" "}
              {filtradas.length === 1 ? "contacto" : "contactos"} · el correo y
              el teléfono se corrigen desde la misma fila
            </p>

            <div className="-mx-5 mt-2 overflow-x-auto">
              <table className="w-full min-w-[62rem] text-sm">
                <thead>
                  <tr className="border-y border-slate-200 text-left text-xs tracking-wide text-slate-600 uppercase dark:border-white/10 dark:text-slate-400">
                    {[
                      "Contacto",
                      "Cliente",
                      "Teléfono",
                      "Correo",
                      "Estado",
                      "",
                    ].map((columna, indice) => (
                      <th
                        key={columna || `col-${indice}`}
                        scope="col"
                        className="px-5 py-2.5 font-semibold whitespace-nowrap"
                      >
                        {columna}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {filtradas.map((fila) => (
                    <Fila key={fila.recordId} fila={fila} />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {formularioAbierto ? (
        <FormularioContacto
          clientes={clientes}
          cargos={cargos}
          onCerrar={() => setFormularioAbierto(false)}
        />
      ) : null}
    </div>
  );
}

function Fila({ fila }: { fila: FilaContacto }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [email, setEmail] = useState(fila.email ?? "");
  const [telefono, setTelefono] = useState(fila.telefono ?? "");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(cuerpo: Record<string, unknown>) {
    setOcupado(true);
    setError(null);

    const respuesta = await fetch(`/api/contactos/${fila.recordId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });

    setOcupado(false);

    if (!respuesta.ok) {
      const data = await respuesta.json().catch(() => ({}));
      setError(String(data.error ?? "No pudimos actualizar el contacto."));
      return;
    }

    setEditando(false);
    router.refresh();
  }

  function cancelar() {
    setEmail(fila.email ?? "");
    setTelefono(fila.telefono ?? "");
    setError(null);
    setEditando(false);
  }

  return (
    <tr className="align-top transition-colors duration-200 hover:bg-slate-50 dark:hover:bg-white/5">
      <td className="px-5 py-3">
        <p className="font-medium">{fila.nombre}</p>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          {fila.cargo ?? "Cargo sin definir"}
        </p>
        <p className="mt-0.5 text-xs text-slate-500 tabular-nums dark:text-slate-500">
          {fila.codigo ?? "sin código"}
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

      <td className="px-5 py-3">
        {fila.clientes.length === 0 ? (
          <span className="text-slate-500 dark:text-slate-500">
            sin cliente
          </span>
        ) : (
          fila.clientes.map((cliente) => (
            <span key={cliente.recordId} className="block">
              <Link
                href={`/dashboard/clientes/${cliente.recordId}`}
                className="rounded font-medium text-blue-800 hover:underline focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none dark:text-blue-300"
              >
                {cliente.nombre}
              </Link>
              {cliente.ciudad ? (
                <span className="block text-xs text-slate-500 dark:text-slate-500">
                  {cliente.ciudad}
                </span>
              ) : null}
            </span>
          ))
        )}
      </td>

      {editando ? (
        <>
          <td className="px-5 py-3">
            <label htmlFor={`tel-${fila.recordId}`} className="sr-only">
              Teléfono de {fila.nombre}
            </label>
            <input
              id={`tel-${fila.recordId}`}
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="300 1234567"
              disabled={ocupado}
              className={`${input} w-36`}
            />
          </td>
          <td className="px-5 py-3">
            <label htmlFor={`mail-${fila.recordId}`} className="sr-only">
              Correo de {fila.nombre}
            </label>
            <input
              id={`mail-${fila.recordId}`}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@empresa.com"
              disabled={ocupado}
              className={`${input} w-52`}
            />
          </td>
        </>
      ) : (
        <>
          <td className="px-5 py-3 whitespace-nowrap">
            {fila.telefono ? (
              <a
                href={`tel:${fila.telefono.replace(/\s+/g, "")}`}
                className="inline-flex items-center gap-1.5 rounded text-blue-800 hover:underline focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none dark:text-blue-300"
              >
                <IconPhone className="h-3.5 w-3.5" />
                {fila.telefono}
              </a>
            ) : (
              <Falta />
            )}
          </td>
          <td className="px-5 py-3">
            {fila.email ? (
              <a
                href={`mailto:${fila.email}`}
                className="inline-flex items-center gap-1.5 rounded break-all text-blue-800 hover:underline focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none dark:text-blue-300"
              >
                <IconMail className="h-3.5 w-3.5 shrink-0" />
                {fila.email}
              </a>
            ) : (
              <Falta />
            )}
          </td>
        </>
      )}

      <td className="px-5 py-3">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
            fila.activo
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
              : "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300"
          }`}
        >
          {fila.activo ? "Activo" : "Inactivo"}
        </span>
      </td>

      <td className="px-5 py-3 whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          {editando ? (
            <>
              <Accion
                onClick={() => enviar({ accion: "datos", email, telefono })}
                disabled={ocupado}
                destacada
              >
                Guardar
              </Accion>
              <Accion onClick={cancelar} disabled={ocupado}>
                Cancelar
              </Accion>
            </>
          ) : (
            <>
              <Accion onClick={() => setEditando(true)} disabled={ocupado}>
                Editar
              </Accion>
              <Accion
                onClick={() =>
                  enviar({ accion: "estado", activo: !fila.activo })
                }
                disabled={ocupado}
              >
                {fila.activo ? "Inactivar" : "Activar"}
              </Accion>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

function Falta() {
  return (
    <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
      falta
    </span>
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
          ? "bg-blue-700 text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
          : "border border-slate-200 hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

function Resumen({
  titulo,
  valor,
  tono,
}: {
  titulo: string;
  valor: number;
  tono?: "ambar";
}) {
  return (
    <div className={`${card} p-5`}>
      <p className="text-sm text-slate-600 dark:text-slate-400">{titulo}</p>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          tono === "ambar" && valor > 0
            ? "text-amber-700 dark:text-amber-400"
            : "text-slate-900 dark:text-slate-100"
        }`}
      >
        {valor}
      </p>
    </div>
  );
}
