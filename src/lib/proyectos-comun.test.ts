import { describe, expect, it } from "vitest";

import { permisosDe } from "@/lib/permisos";
import {
  alertaTarea,
  calcularAvance,
  codigoDesdeSerial,
  diasEntre,
  esErrorEntrada,
  leerCierre,
  leerDatosProyecto,
  leerDatosTarea,
  participaEnProyecto,
  proyectoAtrasado,
  puedeAvanzarTarea,
  puedeGestionarProyecto,
  rangoCronograma,
  sumarDias,
} from "@/lib/proyectos-comun";

/** Datos inventados: IDs en el rango 9000, nunca personas reales. */
const LIDER = { idEmpleado: "SIRIUS-PER-9001", nombre: "Ana Ejemplo Uno" };
const ENCARGADO = { idEmpleado: "SIRIUS-PER-9002", nombre: "Beto Ejemplo Dos" };
const AJENO = { idEmpleado: "SIRIUS-PER-9003", nombre: "Caro Ejemplo Tres" };

const autor = (s: { idEmpleado: string; nombre: string }) => ({
  idPersonalCore: s.idEmpleado,
  responsable: s.nombre,
});

const HOY = "2026-10-08";

const tarea = (
  estado: string,
  fechaFin: string | null,
  fechaInicio: string | null = null,
) => ({ estado, fechaInicio, fechaFin });

describe("calcularAvance", () => {
  it("las canceladas no cuentan ni como hechas ni como pendientes", () => {
    const avance = calcularAvance(
      [
        tarea("Completada", "2026-10-01"),
        tarea("Pendiente", "2026-10-20"),
        tarea("Cancelada", "2026-09-01"),
      ],
      HOY,
    );
    expect(avance).toEqual({
      total: 2,
      completadas: 1,
      porcentaje: 50,
      vencidas: 0,
    });
  });

  it("sin tareas no inventa un porcentaje", () => {
    expect(calcularAvance([], HOY).porcentaje).toBeNull();
  });

  it("cuenta las vencidas abiertas", () => {
    const avance = calcularAvance(
      [tarea("En curso", "2026-10-07"), tarea("Completada", "2026-10-01")],
      HOY,
    );
    expect(avance.vencidas).toBe(1);
  });
});

describe("alertaTarea", () => {
  it("distingue vencida, hoy, en plazo, sin fecha y cerrada", () => {
    expect(alertaTarea(tarea("Pendiente", "2026-10-07"), HOY)).toBe("vencida");
    expect(alertaTarea(tarea("Pendiente", HOY), HOY)).toBe("hoy");
    expect(alertaTarea(tarea("Pendiente", "2026-10-09"), HOY)).toBe("en-plazo");
    expect(alertaTarea(tarea("Pendiente", null), HOY)).toBe("sin-fecha");
    expect(alertaTarea(tarea("Completada", "2026-01-01"), HOY)).toBe("cerrada");
  });
});

describe("proyectoAtrasado", () => {
  it("solo un proyecto abierto con fin pasado está atrasado", () => {
    expect(
      proyectoAtrasado({ estado: "En ejecución", fechaFinPlaneada: "2026-10-01" }, HOY),
    ).toBe(true);
    expect(
      proyectoAtrasado({ estado: "Finalizado", fechaFinPlaneada: "2026-10-01" }, HOY),
    ).toBe(false);
    expect(
      proyectoAtrasado({ estado: "En ejecución", fechaFinPlaneada: null }, HOY),
    ).toBe(false);
  });
});

describe("fechas del cronograma", () => {
  it("cuenta días sin correrse por zona horaria", () => {
    expect(diasEntre("2026-10-01", "2026-10-31")).toBe(30);
    expect(diasEntre("2026-12-31", "2027-01-01")).toBe(1);
    expect(sumarDias("2026-10-31", 1)).toBe("2026-11-01");
  });

  it("la ventana va del primer inicio al último fin", () => {
    expect(
      rangoCronograma({ fechaInicio: "2026-10-05", fechaFinPlaneada: "2026-11-30" }, [
        tarea("Pendiente", "2026-12-10", "2026-10-01"),
      ]),
    ).toEqual({ inicio: "2026-10-01", fin: "2026-12-10", dias: 71 });
  });

  it("sin ninguna fecha no hay cronograma", () => {
    expect(
      rangoCronograma({ fechaInicio: null, fechaFinPlaneada: null }, [
        tarea("Pendiente", null),
      ]),
    ).toBeNull();
  });
});

describe("codigoDesdeSerial", () => {
  it("rellena a cuatro dígitos", () => {
    expect(codigoDesdeSerial("PRY", 7)).toBe("PRY-0007");
    expect(codigoDesdeSerial("PRY", null)).toBeNull();
  });
});

describe("permisos del proyecto", () => {
  const usuario = permisosDe({ nivelAcceso: "Usuario" });
  const lectura = permisosDe({ nivelAcceso: "Lectura" });
  const admin = permisosDe({ nivelAcceso: "Admin" });
  const proyecto = autor(LIDER);
  const tareas = [autor(ENCARGADO)];

  it("lo ven el líder, los encargados y el mando; nadie más", () => {
    expect(participaEnProyecto(usuario, proyecto, tareas, LIDER)).toBe(true);
    expect(participaEnProyecto(usuario, proyecto, tareas, ENCARGADO)).toBe(true);
    expect(participaEnProyecto(usuario, proyecto, tareas, AJENO)).toBe(false);
    expect(participaEnProyecto(admin, proyecto, tareas, AJENO)).toBe(true);
  });

  it("solo el líder o el mando lo gestionan", () => {
    expect(puedeGestionarProyecto(usuario, proyecto, LIDER)).toBe(true);
    expect(puedeGestionarProyecto(usuario, proyecto, ENCARGADO)).toBe(false);
    expect(puedeGestionarProyecto(admin, proyecto, AJENO)).toBe(true);
    // "Lectura" no escribe, ni en lo propio.
    expect(puedeGestionarProyecto(lectura, proyecto, LIDER)).toBe(false);
  });

  it("el encargado avanza su tarea, no la de otro", () => {
    const suya = autor(ENCARGADO);
    const ajena = autor(AJENO);
    expect(puedeAvanzarTarea(usuario, proyecto, suya, ENCARGADO)).toBe(true);
    expect(puedeAvanzarTarea(usuario, proyecto, ajena, ENCARGADO)).toBe(false);
    expect(puedeAvanzarTarea(usuario, proyecto, ajena, LIDER)).toBe(true);
    expect(puedeAvanzarTarea(lectura, proyecto, suya, ENCARGADO)).toBe(false);
  });
});

describe("leerDatosProyecto", () => {
  const catalogo = [
    { codigo: "PROD-9001", nombre: "Producto Uno" },
    { codigo: "PROD-9002", nombre: "Producto Dos" },
  ];
  const base = { nombre: "Prueba", objetivo: "Demostrar algo" };

  it("toma los nombres de producto del catálogo, no del navegador", () => {
    const datos = leerDatosProyecto(
      { ...base, productos: ["PROD-9002", "PROD-9001"] },
      catalogo,
    );
    expect(esErrorEntrada(datos)).toBe(false);
    if (esErrorEntrada(datos)) return;
    expect(datos.idProductosCore).toBe("PROD-9001, PROD-9002");
    expect(datos.productos).toBe("Producto Uno, Producto Dos");
  });

  it("rechaza un producto que no existe", () => {
    expect(
      leerDatosProyecto({ ...base, productos: ["PROD-0000"] }, catalogo),
    ).toEqual({ error: "«PROD-0000» no está en el catálogo de productos." });
  });

  it("acepta el nombre exacto sin importar tildes ni mayúsculas", () => {
    const datos = leerDatosProyecto(
      { ...base, productos: ["producto dós", "PROD-9002"] },
      [...catalogo.slice(0, 1), { codigo: "PROD-9002", nombre: "Producto Dos" }],
    );
    expect(esErrorEntrada(datos)).toBe(false);
    if (esErrorEntrada(datos)) return;
    expect(datos.idProductosCore).toBe("PROD-9002");
  });

  it("exige nombre y objetivo, y fechas en orden", () => {
    expect(esErrorEntrada(leerDatosProyecto({ objetivo: "x" }, catalogo))).toBe(true);
    expect(esErrorEntrada(leerDatosProyecto({ nombre: "x" }, catalogo))).toBe(true);
    expect(
      esErrorEntrada(
        leerDatosProyecto(
          { ...base, fechaInicio: "2026-10-10", fechaFinPlaneada: "2026-10-01" },
          catalogo,
        ),
      ),
    ).toBe(true);
  });
});

describe("leerDatosTarea", () => {
  it("exige el título y fechas válidas", () => {
    expect(esErrorEntrada(leerDatosTarea({}))).toBe(true);
    expect(esErrorEntrada(leerDatosTarea({ tarea: "x", fechaFin: "mañana" }))).toBe(true);
    expect(leerDatosTarea({ tarea: " Aplicar ", encargadoId: "SIRIUS-PER-9002" })).toEqual({
      tarea: "Aplicar",
      descripcion: null,
      idEncargado: "SIRIUS-PER-9002",
      fechaInicio: null,
      fechaFin: null,
    });
  });
});

describe("leerCierre", () => {
  const vacio = { resultados: null, veredicto: null };

  it("finalizar exige resultados y veredicto", () => {
    expect(esErrorEntrada(leerCierre({}, "Finalizado", vacio))).toBe(true);
    expect(
      esErrorEntrada(leerCierre({ resultados: "Subió 12 %" }, "Finalizado", vacio)),
    ).toBe(true);
    expect(
      leerCierre({ resultados: "Subió 12 %", veredicto: "Exitosa" }, "Finalizado", vacio),
    ).toEqual({ resultados: "Subió 12 %", veredicto: "Exitosa", conclusion: null });
  });

  it("acepta lo que ya estaba guardado", () => {
    expect(
      esErrorEntrada(
        leerCierre({}, "Finalizado", { resultados: "Algo", veredicto: "Parcial" }),
      ),
    ).toBe(false);
  });

  it("cancelar no exige resultados, pero el veredicto debe ser válido", () => {
    expect(esErrorEntrada(leerCierre({}, "Cancelado", vacio))).toBe(false);
    expect(esErrorEntrada(leerCierre({ veredicto: "Genial" }, "Cancelado", vacio))).toBe(true);
  });
});
