"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { IconMail, IconPhone } from "../../icons";
import { FormularioContacto } from "../../contactos/formulario-contacto";
import type { ClienteSelector, FilaContacto } from "../../contactos/modulo";

/**
 * Los contactos del cliente, desde su propia ficha.
 *
 * Reutiliza el formulario del directorio en vez de tener uno propio: es el
 * mismo registro y las mismas reglas, y dos formularios para lo mismo se
 * separan a la primera corrección.
 */
export function ContactosCliente({
  contactos,
  cliente,
  cargos,
  puedeEditar,
}: {
  contactos: FilaContacto[];
  /** El cliente de la ficha, para el formulario. */
  cliente: ClienteSelector;
  /** Los cargos ya usados por el equipo: el campo es texto libre. */
  cargos: string[];
  puedeEditar: boolean;
}) {
  const [enEdicion, setEnEdicion] = useState<FilaContacto | null>(null);

  return (
    <>
      {contactos.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-600 dark:border-white/15 dark:text-slate-400">
          Este cliente no tiene personal registrado en Sirius Clients Core.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {contactos.map((contacto) => (
            <Tarjeta
              key={contacto.recordId}
              contacto={contacto}
              puedeEditar={puedeEditar}
              onEditar={() => setEnEdicion(contacto)}
            />
          ))}
        </ul>
      )}

      {enEdicion ? (
        <FormularioContacto
          key={enEdicion.recordId}
          clientes={[cliente]}
          cargos={cargos}
          contacto={enEdicion}
          onCerrar={() => setEnEdicion(null)}
        />
      ) : null}
    </>
  );
}

function Tarjeta({
  contacto,
  puedeEditar,
  onEditar,
}: {
  contacto: FilaContacto;
  puedeEditar: boolean;
  onEditar: () => void;
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cambiarEstado() {
    setOcupado(true);
    setError(null);

    const respuesta = await fetch(`/api/contactos/${contacto.recordId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "estado", activo: !contacto.activo }),
    });

    setOcupado(false);

    if (!respuesta.ok) {
      const data = await respuesta.json().catch(() => ({}));
      setError(String(data.error ?? "No pudimos actualizar el contacto."));
      return;
    }

    router.refresh();
  }

  return (
    <li className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold">{contacto.nombre}</p>
          {contacto.funciones.map((funcion) => (
            <span
              key={funcion}
              className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-800 dark:bg-blue-500/15 dark:text-blue-300"
            >
              {funcion}
            </span>
          ))}
          {contacto.activo ? null : (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-300">
              Inactivo
            </span>
          )}
        </div>

        {puedeEditar ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <Accion onClick={onEditar} disabled={ocupado}>
              Editar
            </Accion>
            <Accion onClick={cambiarEstado} disabled={ocupado}>
              {contacto.activo ? "Inactivar" : "Activar"}
            </Accion>
          </div>
        ) : null}
      </div>

      {contacto.cargo ? (
        <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
          {contacto.cargo}
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {contacto.telefono ? (
          <a
            href={`tel:${contacto.telefono.replace(/\s/g, "")}`}
            className="flex items-center gap-1.5 rounded text-slate-700 hover:text-blue-800 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none dark:text-slate-300 dark:hover:text-blue-300"
          >
            <IconPhone className="h-3.5 w-3.5" />
            {contacto.telefono}
          </a>
        ) : null}
        {contacto.email ? (
          <a
            href={`mailto:${contacto.email}`}
            className="flex items-center gap-1.5 rounded break-all text-slate-700 hover:text-blue-800 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none dark:text-slate-300 dark:hover:text-blue-300"
          >
            <IconMail className="h-3.5 w-3.5 shrink-0" />
            {contacto.email}
          </a>
        ) : null}
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-2 text-xs font-medium text-red-700 dark:text-red-400"
        >
          {error}
        </p>
      ) : null}
    </li>
  );
}

function Accion({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium transition-colors duration-200 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none disabled:opacity-50 dark:border-white/10 dark:bg-transparent dark:hover:bg-white/10"
    >
      {children}
    </button>
  );
}
