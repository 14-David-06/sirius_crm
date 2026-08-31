"use client";

import { useEffect } from "react";

/**
 * Efecto 3D de las tarjetas: siguen el mouse inclinándose y muestran un
 * brillo bajo el cursor.
 *
 * Se monta una sola vez en el layout y escucha el puntero en todo el
 * documento, en vez de poner un listener por tarjeta. Así cualquier tarjeta
 * del proyecto se apunta solo con la clase `tarjeta3d`, sin volverla cliente
 * ni tocar su marcado.
 *
 * El listener no calcula nada en cada evento: guarda la posición y trabaja
 * una vez por frame, que es lo máximo que la pantalla puede mostrar.
 */
export function Efecto3D() {
  useEffect(() => {
    // En pantallas táctiles no hay puntero que seguir y en "reducir
    // movimiento" el usuario pidió que las cosas no se muevan.
    const finoYConMovimiento = window.matchMedia(
      "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
    );
    if (!finoYConMovimiento.matches) return;

    let tarjeta: HTMLElement | null = null;
    let clientX = 0;
    let clientY = 0;
    let frame = 0;

    function pintar() {
      frame = 0;
      if (!tarjeta) return;

      const rect = tarjeta.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const x = clientX - rect.left;
      const y = clientY - rect.top;

      // Un panel ancho con los mismos grados que una tarjeta pequeña se ve
      // exagerado, así que el giro se afloja a medida que crece la tarjeta.
      const maximo =
        Number(tarjeta.dataset.tilt) ||
        Math.min(5, Math.max(1.5, (5 * 320) / Math.max(rect.width, 320)));

      const rotY = ((x - rect.width / 2) / (rect.width / 2)) * maximo;
      const rotX = ((rect.height / 2 - y) / (rect.height / 2)) * maximo;

      tarjeta.style.setProperty("--giro-x", `${rotX.toFixed(2)}deg`);
      tarjeta.style.setProperty("--giro-y", `${rotY.toFixed(2)}deg`);
      tarjeta.style.setProperty("--brillo-x", `${((x / rect.width) * 100).toFixed(1)}%`);
      tarjeta.style.setProperty("--brillo-y", `${((y / rect.height) * 100).toFixed(1)}%`);
      tarjeta.style.setProperty("--brillo-opacidad", "1");
      tarjeta.style.setProperty("--giro-duracion", "0.12s");
    }

    function soltar(anterior: HTMLElement) {
      // Vuelve suavemente a su posición original.
      anterior.style.setProperty("--giro-x", "0deg");
      anterior.style.setProperty("--giro-y", "0deg");
      anterior.style.setProperty("--brillo-opacidad", "0");
      anterior.style.setProperty("--giro-duracion", "0.5s");
    }

    function alMover(evento: PointerEvent) {
      if (evento.pointerType !== "mouse") return;

      const destino = evento.target;
      const actual =
        destino instanceof Element
          ? destino.closest<HTMLElement>(".tarjeta3d")
          : null;

      if (actual !== tarjeta) {
        if (tarjeta) soltar(tarjeta);
        tarjeta = actual;
      }
      if (!tarjeta) return;

      clientX = evento.clientX;
      clientY = evento.clientY;
      frame ||= requestAnimationFrame(pintar);
    }

    function alSalir() {
      if (!tarjeta) return;
      soltar(tarjeta);
      tarjeta = null;
    }

    document.addEventListener("pointermove", alMover, { passive: true });
    document.addEventListener("pointerleave", alSalir);
    // Al hacer scroll la tarjeta se mueve bajo un mouse quieto: se suelta
    // para no dejarla torcida.
    window.addEventListener("scroll", alSalir, { passive: true });

    return () => {
      if (frame) cancelAnimationFrame(frame);
      if (tarjeta) soltar(tarjeta);
      document.removeEventListener("pointermove", alMover);
      document.removeEventListener("pointerleave", alSalir);
      window.removeEventListener("scroll", alSalir);
    };
  }, []);

  return null;
}
