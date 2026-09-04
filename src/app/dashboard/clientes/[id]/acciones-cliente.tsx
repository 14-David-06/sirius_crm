"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  FormularioCliente,
  type DatosCliente,
} from "../formulario-cliente";

/**
 * Los botones de la ficha. Viven en un componente cliente porque la página es
 * un server component: solo esta parte necesita estado.
 */
export function AccionesCliente({
  cliente,
  activo,
}: {
  cliente: DatosCliente;
  activo: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cambiarEstado() {
    // Inactivar un cliente lo saca de los selectores de visitas y pedidos;
    // conviene que sea una decisión consciente y no un clic de paso.
    if (
      activo &&
      !window.confirm(
        `¿Inactivar a ${cliente.nombre}? Dejará de aparecer al registrar visitas y pedidos.`,
      )
    ) {
      return;
    }

    setOcupado(true);
    setError(null);

    const respuesta = await fetch(`/api/clientes/${cliente.recordId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "estado", activo: !activo }),
    });

    setOcupado(false);

    if (!respuesta.ok) {
      const data = await respuesta.json().catch(() => ({}));
      setError(String(data.error ?? "No pudimos actualizar el cliente."));
      return;
    }

    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="cursor-pointer rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium transition-colors duration-200 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none dark:border-white/10 dark:hover:bg-white/10"
        >
          Editar ficha
        </button>
        <button
          type="button"
          onClick={cambiarEstado}
          disabled={ocupado}
          className="cursor-pointer rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium transition-colors duration-200 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/10"
        >
          {activo ? "Inactivar" : "Reactivar"}
        </button>
      </div>

      {error ? (
        <p
          role="alert"
          className="text-xs font-medium text-red-700 dark:text-red-400"
        >
          {error}
        </p>
      ) : null}

      {abierto ? (
        <FormularioCliente
          cliente={cliente}
          onCerrar={() => setAbierto(false)}
        />
      ) : null}
    </div>
  );
}
