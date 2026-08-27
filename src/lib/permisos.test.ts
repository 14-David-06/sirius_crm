import { describe, expect, it } from "vitest";

import {
  esDeLaSesion,
  esPropio,
  filtrarPorAlcance,
  motivoSinAcceso,
  permisosDe,
  puedeEditar,
} from "@/lib/permisos";

/**
 * Datos inventados a propósito: nunca nombres, cédulas ni IDs de personas
 * reales en el código fuente. Los IDs van en el rango 9000 para que no se
 * confundan con los de Sirius Nomina Core, que van de 0001 en adelante.
 */
const SESION = { idEmpleado: "SIRIUS-PER-9001", nombre: "Ana Ejemplo Uno" };
const OTRA = { idEmpleado: "SIRIUS-PER-9002", nombre: "Beto Ejemplo Dos" };

const registro = (idPersonalCore: string | null, responsable: string | null) => ({
  idPersonalCore,
  responsable,
});

describe("permisosDe", () => {
  it("da alcance de equipo a Super Admin y Admin", () => {
    for (const nivel of ["Super Admin", "Admin"]) {
      const p = permisosDe({ nivelAcceso: nivel });
      expect(p.verTodo, nivel).toBe(true);
      expect(p.actualizarTodo, nivel).toBe(true);
      expect(p.gestionarCatalogo, nivel).toBe(true);
      expect(p.crear, nivel).toBe(true);
    }
  });

  it("solo Super Admin configura y gestiona usuarios", () => {
    expect(permisosDe({ nivelAcceso: "Super Admin" }).gestionUsuarios).toBe(true);
    expect(permisosDe({ nivelAcceso: "Admin" }).gestionUsuarios).toBe(false);
    expect(permisosDe({ nivelAcceso: "Admin" }).configurar).toBe(false);
  });

  it("deja a Usuario crear lo propio pero sin ver al equipo", () => {
    const p = permisosDe({ nivelAcceso: "Usuario" });
    expect(p.crear).toBe(true);
    expect(p.actualizarPropio).toBe(true);
    expect(p.verTodo).toBe(false);
    expect(p.actualizarTodo).toBe(false);
    expect(p.gestionarCatalogo).toBe(false);
  });

  it("deja a Lectura sin escribir nada", () => {
    const p = permisosDe({ nivelAcceso: "Lectura" });
    expect(p.crear).toBe(false);
    expect(p.actualizarPropio).toBe(false);
  });

  it("no deja a Avanzado crear registros operativos", () => {
    // El JSON del nivel en Airtable solo le da solicitudes y reportes.
    expect(permisosDe({ nivelAcceso: "Avanzado" }).crear).toBe(false);
  });

  it("reconoce el nivel con espacios y mayúsculas cambiadas", () => {
    // Airtable entrega el nivel por un lookup: puede llegar con basura.
    expect(permisosDe({ nivelAcceso: "  super admin " }).nivel).toBe(
      "Super Admin",
    );
    expect(permisosDe({ nivelAcceso: "USUARIO" }).nivel).toBe("Usuario");
  });

  /* Estos son los casos que importan: ante la duda, se cierra. */

  it("cae al mínimo sin nivel, con nivel desconocido o sin sesión", () => {
    for (const entrada of [
      null,
      { nivelAcceso: null },
      { nivelAcceso: "" },
      { nivelAcceso: "Gerente" },
      { nivelAcceso: "superadmin" },
    ]) {
      const p = permisosDe(entrada);
      expect(p.nivel, JSON.stringify(entrada)).toBeNull();
      expect(p.verTodo, JSON.stringify(entrada)).toBe(false);
      expect(p.leerPropio, JSON.stringify(entrada)).toBe(false);
      expect(p.crear, JSON.stringify(entrada)).toBe(false);
      expect(p.actualizarPropio, JSON.stringify(entrada)).toBe(false);
      expect(p.gestionarCatalogo, JSON.stringify(entrada)).toBe(false);
      expect(p.gestionUsuarios, JSON.stringify(entrada)).toBe(false);
    }
  });

  it("ordena los niveles de mayor a menor acceso", () => {
    const orden = (n: string) => permisosDe({ nivelAcceso: n }).orden;
    expect(orden("Super Admin")).toBeLessThan(orden("Admin"));
    expect(orden("Admin")).toBeLessThan(orden("Avanzado"));
    expect(orden("Avanzado")).toBeLessThan(orden("Usuario"));
    expect(orden("Usuario")).toBeLessThan(orden("Lectura"));
    expect(orden("Lectura")).toBeLessThan(permisosDe(null).orden);
  });
});

describe("esPropio", () => {
  it("ignora acentos, mayúsculas y espacios de más", () => {
    expect(esPropio("ANA MARÍA  EJEMPLO", "Ana Maria Ejemplo")).toBe(true);
    expect(esPropio("  Ana Ejemplo  ", "Ana Ejemplo")).toBe(true);
  });

  it("no considera propio un vacío", () => {
    expect(esPropio(null, SESION.nombre)).toBe(false);
    expect(esPropio(SESION.nombre, null)).toBe(false);
    expect(esPropio("", "")).toBe(false);
  });

  it("no confunde personas distintas", () => {
    expect(esPropio(OTRA.nombre, SESION.nombre)).toBe(false);
  });
});

describe("esDeLaSesion", () => {
  it("manda el ID sobre el nombre", () => {
    // Mismo nombre, otro ID: no es suyo. Es la defensa contra suplantar por nombre.
    expect(
      esDeLaSesion(registro("SIRIUS-PER-9999", SESION.nombre), SESION),
    ).toBe(false);

    // Otro nombre, mismo ID: sí es suyo. El nombre pudo cambiar en Nómina.
    expect(esDeLaSesion(registro(SESION.idEmpleado, "Otro Nombre"), SESION)).toBe(
      true,
    );
  });

  it("cae al nombre solo si el registro no tiene ID", () => {
    // Los registros anteriores al campo no deben quedar huérfanos de golpe.
    expect(esDeLaSesion(registro(null, SESION.nombre), SESION)).toBe(true);
    expect(esDeLaSesion(registro(null, OTRA.nombre), SESION)).toBe(false);
  });

  it("no es propio un registro sin ID ni responsable", () => {
    expect(esDeLaSesion(registro(null, null), SESION)).toBe(false);
  });

  it("compara por nombre cuando la sesión no tiene ID de empleado", () => {
    const sinId = { idEmpleado: "", nombre: SESION.nombre };
    expect(esDeLaSesion(registro(SESION.idEmpleado, SESION.nombre), sinId)).toBe(
      true,
    );
    expect(esDeLaSesion(registro(SESION.idEmpleado, OTRA.nombre), sinId)).toBe(
      false,
    );
  });
});

describe("filtrarPorAlcance", () => {
  const registros = [
    registro(SESION.idEmpleado, SESION.nombre),
    registro(OTRA.idEmpleado, OTRA.nombre),
    registro(null, SESION.nombre),
    registro(null, null),
  ];

  it("no recorta nada a quien ve todo", () => {
    const p = permisosDe({ nivelAcceso: "Admin" });
    expect(filtrarPorAlcance(registros, p, SESION)).toHaveLength(4);
  });

  it("deja solo lo propio a quien no ve al equipo", () => {
    const p = permisosDe({ nivelAcceso: "Usuario" });
    const vistos = filtrarPorAlcance(registros, p, SESION);
    expect(vistos).toHaveLength(2);
    expect(vistos).not.toContainEqual(registro(OTRA.idEmpleado, OTRA.nombre));
  });

  it("no muestra nada a una sesión sin nivel", () => {
    expect(filtrarPorAlcance(registros, permisosDe(null), SESION)).toEqual([]);
  });
});

describe("puedeEditar", () => {
  const propio = registro(SESION.idEmpleado, SESION.nombre);
  const ajeno = registro(OTRA.idEmpleado, OTRA.nombre);

  it("permite a Admin editar cualquier registro", () => {
    const p = permisosDe({ nivelAcceso: "Admin" });
    expect(puedeEditar(p, propio, SESION)).toBe(true);
    expect(puedeEditar(p, ajeno, SESION)).toBe(true);
  });

  it("permite a Usuario solo lo suyo", () => {
    const p = permisosDe({ nivelAcceso: "Usuario" });
    expect(puedeEditar(p, propio, SESION)).toBe(true);
    expect(puedeEditar(p, ajeno, SESION)).toBe(false);
  });

  it("no permite a Lectura editar ni lo suyo", () => {
    const p = permisosDe({ nivelAcceso: "Lectura" });
    expect(puedeEditar(p, propio, SESION)).toBe(false);
  });

  it("no permite nada sin nivel asignado", () => {
    const p = permisosDe(null);
    expect(puedeEditar(p, propio, SESION)).toBe(false);
    expect(puedeEditar(p, ajeno, SESION)).toBe(false);
  });
});

describe("motivoSinAcceso", () => {
  it("distingue no tener nivel de tener un nivel limitado", () => {
    expect(motivoSinAcceso(permisosDe(null))).toContain("no tiene un nivel");
    expect(motivoSinAcceso(permisosDe({ nivelAcceso: "Usuario" }))).toContain(
      "Usuario",
    );
  });
});
