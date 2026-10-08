import { formatearFecha } from "@/lib/fechas";
import type { Proyecto, TareaProyecto } from "@/lib/proyectos";
import {
  alertaTarea,
  diasEntre,
  rangoCronograma,
  sumarDias,
} from "@/lib/proyectos-comun";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const COLOR_BARRA: Record<string, string> = {
  Pendiente: "bg-blue-500/70 dark:bg-blue-400/60",
  "En curso": "bg-violet-600 dark:bg-violet-500",
  Completada: "bg-emerald-600 dark:bg-emerald-500",
  Cancelada: "bg-slate-300 dark:bg-slate-600",
};

/**
 * Línea de tiempo del proyecto: una fila por tarea, con la ventana planeada
 * del proyecto arriba y una marca en el día de hoy. Las tareas sin fechas se
 * listan sin barra; con una sola fecha se dibujan de un día.
 */
export function Cronograma({
  proyecto,
  tareas,
  hoy,
}: {
  proyecto: Proyecto;
  tareas: TareaProyecto[];
  hoy: string;
}) {
  const rango = rangoCronograma(proyecto, tareas);

  if (!rango) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Ponle fechas al proyecto o a sus tareas para ver el cronograma.
      </p>
    );
  }

  const posicion = (fecha: string) =>
    Math.min(100, Math.max(0, (diasEntre(rango.inicio, fecha) / rango.dias) * 100));
  const ancho = (desde: string, hasta: string) =>
    Math.max(((diasEntre(desde, hasta) + 1) / rango.dias) * 100, 0.8);

  // Una marca al inicio de cada mes dentro de la ventana.
  const marcas: { fecha: string; etiqueta: string }[] = [];
  let mes = `${rango.inicio.slice(0, 7)}-01`;
  while (mes <= rango.fin) {
    if (mes >= rango.inicio) {
      const [anio, m] = mes.split("-").map(Number);
      marcas.push({
        fecha: mes,
        etiqueta: m === 1 ? `${MESES[0]} ${anio}` : MESES[m - 1],
      });
    }
    // Saltar al primer día del mes siguiente.
    mes = `${sumarDias(mes, 32).slice(0, 7)}-01`;
  }

  const hoyVisible = hoy >= rango.inicio && hoy <= rango.fin;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[40rem]">
        <div className="grid grid-cols-[12rem_1fr] gap-3">
          <div />
          <div className="relative h-5 text-[10px] text-slate-500 dark:text-slate-400">
            {marcas.map((marca) => (
              <span
                key={marca.fecha}
                className="absolute top-0 -translate-x-1/2 whitespace-nowrap"
                style={{ left: `${posicion(marca.fecha)}%` }}
              >
                {marca.etiqueta}
              </span>
            ))}
          </div>
        </div>

        <div className="relative">
          {/* Líneas verticales de los meses y la de hoy, detrás de las filas. */}
          <div className="pointer-events-none absolute inset-0 grid grid-cols-[12rem_1fr] gap-3">
            <div />
            <div className="relative">
              {marcas.map((marca) => (
                <span
                  key={marca.fecha}
                  className="absolute inset-y-0 w-px bg-slate-100 dark:bg-white/5"
                  style={{ left: `${posicion(marca.fecha)}%` }}
                />
              ))}
              {hoyVisible ? (
                <span
                  className="absolute inset-y-0 w-0.5 bg-red-500/70"
                  style={{ left: `${posicion(hoy)}%` }}
                  title={`Hoy, ${formatearFecha(hoy)}`}
                />
              ) : null}
            </div>
          </div>

          {proyecto.fechaInicio || proyecto.fechaFinPlaneada ? (
            <Fila
              titulo="Proyecto"
              detalle={`${formatearFecha(proyecto.fechaInicio)} – ${formatearFecha(proyecto.fechaFinPlaneada)}`}
            >
              <div
                className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-slate-300 dark:bg-slate-600"
                style={{
                  left: `${posicion(proyecto.fechaInicio ?? rango.inicio)}%`,
                  width: `${ancho(
                    proyecto.fechaInicio ?? rango.inicio,
                    proyecto.fechaFinPlaneada ?? rango.fin,
                  )}%`,
                }}
              />
            </Fila>
          ) : null}

          {tareas.map((tarea) => {
            const desde = tarea.fechaInicio ?? tarea.fechaFin;
            const hasta = tarea.fechaFin ?? tarea.fechaInicio;
            const vencida = alertaTarea(tarea, hoy) === "vencida";
            return (
              <Fila
                key={tarea.recordId}
                titulo={tarea.tarea}
                detalle={tarea.responsable ?? "Sin encargado"}
              >
                {desde && hasta ? (
                  <div
                    className={`absolute top-1/2 h-4 -translate-y-1/2 rounded ${
                      COLOR_BARRA[tarea.estado ?? ""] ?? COLOR_BARRA.Pendiente
                    } ${vencida ? "ring-2 ring-red-500" : ""}`}
                    style={{ left: `${posicion(desde)}%`, width: `${ancho(desde, hasta)}%` }}
                    title={`${tarea.tarea} · ${formatearFecha(desde)} – ${formatearFecha(hasta)} · ${tarea.estado ?? "Sin estado"}`}
                  />
                ) : (
                  <span className="absolute top-1/2 -translate-y-1/2 text-xs text-slate-400 dark:text-slate-500">
                    sin fechas
                  </span>
                )}
              </Fila>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
          {Object.entries(COLOR_BARRA).map(([estado, color]) => (
            <span key={estado} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-sm ${color}`} />
              {estado}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm ring-2 ring-red-500" />
            Vencida
          </span>
          {hoyVisible ? (
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-0.5 bg-red-500/70" />
              Hoy
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Fila({
  titulo,
  detalle,
  children,
}: {
  titulo: string;
  detalle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative grid grid-cols-[12rem_1fr] items-center gap-3 border-t border-slate-100 py-2 dark:border-white/5">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium" title={titulo}>
          {titulo}
        </p>
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
          {detalle}
        </p>
      </div>
      <div className="relative h-6">{children}</div>
    </div>
  );
}
