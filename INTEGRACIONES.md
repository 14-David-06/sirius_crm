# Integraciones del módulo de pedidos

Estado: **diseñado, no implementado.** Los puntos de extensión viven en
`src/lib/integraciones.ts`. Este documento explica por qué tienen esa forma y
qué falta saber antes de escribir código.

Nada de lo de aquí se implementa sin conocer las APIs, credenciales y reglas
exactas. Una integración adivinada que escribe en Airtable es peor que no
tenerla: los pedidos son la entrada al despacho físico.

---

## Lo que ya existe y condiciona el diseño

- **`Sirius Pedidos Core` es una base compartida.** La escriben también DataLab
  y PiroliApp. El campo `Origen del Pedido` ya distingue
  `DataLab (Laboratorio)` de `PiroliApp (Pirolisis)`.
- **`crearPedido()` (`src/lib/pedidos.ts`) es el único camino de escritura.**
  Resuelve el serial, crea las líneas y avisa con el serial si un renglón falla
  después de haberse creado el pedido. Toda integración debe pasar por ahí.
- **El cruce entre bases es por serial de texto**, no por vínculos:
  `CL-XXXX`, `SIRIUS-PRODUCT-XXXX`, `SIRIUS-PER-XXXX`, `SIRIUS-PED-XXXX`.
- **La autoría siempre se resuelve en el servidor** (`src/lib/autoria.ts`);
  nunca se acepta un ID de empleado que venga del cliente.

---

## 1. WhatsApp — capturar solicitudes

**Enchufe:** `FuentePedido` en `src/lib/integraciones.ts`.

El flujo previsto es: webhook → `SolicitudExterna` → `interpretar()` →
`EntradaPedido` → `crearPedido()`. La integración **no escribe en Airtable**;
solo traduce.

**Por qué `referenciaExterna` es obligatoria.** Los webhooks reintentan. Sin
una llave de idempotencia, un reintento crea un segundo pedido y el área
despacha dos veces. Es la misma regla que gobierna la conversión de una venta
en pedido.

**Lo que falta decidir antes de implementar:**

| Pregunta | Por qué bloquea |
|---|---|
| ¿Qué proveedor? (WhatsApp Cloud API, Twilio, otro) | Cambia el formato del webhook y la verificación de firma. |
| ¿Cómo se identifica al cliente desde un número de teléfono? | Hoy `Personal Cliente` tiene `Teléfono`, pero no está garantizado que sea único ni que esté completo. |
| ¿Un mensaje libre se interpreta con IA o con un formulario guiado? | Un pedido mal interpretado despacha producto equivocado. |
| ¿Quién queda como responsable de un pedido sin persona detrás? | `ID Usuario Responsable` es la clave de propiedad para los permisos; no puede quedar vacío. |
| ¿Un pedido por WhatsApp nace confirmado o requiere aprobación humana? | Es la diferencia entre una integración y un buzón. |

**Recomendación:** que la primera versión **no cree pedidos**. Que deje la
solicitud en una bandeja para que un comercial la revise y la convierta con un
clic. El día que la interpretación demuestre ser fiable, se automatiza.

## 2. DataLab y otras plataformas internas

**Enchufe:** el mismo `FuentePedido`, con `origen: "datalab"`.

Aquí hay un matiz importante: **DataLab ya escribe directamente en la base de
pedidos.** Así que antes de construir nada hay que decidir en qué dirección va
la integración.

| Pregunta | Por qué bloquea |
|---|---|
| ¿DataLab sigue escribiendo directo, o pasa a hacerlo por el CRM? | Si sigue directo, no hace falta una `FuentePedido`: basta con que el CRM lea. Este documento asume que se mantiene. |
| ¿Quién manda si los dos tocan el mismo pedido? | Hoy no hay control de concurrencia; el último en escribir gana. |
| ¿Los estados de pedido son los mismos para las tres apps? | Es la decisión pendiente sobre renombrar estados: renombrarlos rompería DataLab y PiroliApp. |

## 3. Notificaciones a las áreas responsables

**Enchufe:** `NotificadorArea` y `notificarArea()` en
`src/lib/integraciones.ts`.

**Dónde se llamaría:** en `PATCH /api/pedidos/[id]` y en la conversión de una
venta, **después** de que Airtable confirmó la escritura y justo después de
`invalidar(ETIQUETAS.pedidos)`.

**Dos reglas que ya están codificadas en el enchufe:**

1. **Nunca se avisa antes de guardar.** Un aviso de algo que no se guardó manda
   a alguien a preparar un pedido que no existe.
2. **Un fallo al notificar no tumba la operación.** `notificarArea()` se traga
   los errores y los registra: el pedido ya está creado y el usuario no tiene
   por qué ver un error por un correo que no salió.

| Pregunta | Por qué bloquea |
|---|---|
| ¿Por qué canal? (correo, WhatsApp, Slack) | Determina credenciales y formato. |
| ¿A quién exactamente? ¿A un área o a personas? | `Personal.Areas` en Sirius Nomina Core permite resolver el área, pero no hay una lista de destinatarios definida. |
| ¿Qué sucesos ameritan aviso? | Notificar cada cambio de estado es la forma más rápida de que el equipo empiece a ignorar los avisos. |
| ¿Qué pasa si el destinatario no responde? | Si hay que escalar, eso es una regla de negocio, no de integración. |

---

## Lo que hay que respetar al implementar cualquiera de las tres

- Escribir **solo** a través de `crearPedido()` / `cambiarEstadoPedido()`.
- Toda entrada externa se valida como si fuera hostil: los mismos chequeos que
  hace `POST /api/pedidos` sobre seriales, cantidades y precios.
- Idempotencia por `referenciaExterna` antes de crear nada.
- Registrar el origen en el pedido, para poder responder "¿de dónde salió
  esto?" seis meses después.
- Las credenciales van en variables de entorno declaradas en `src/lib/env.ts`
  y documentadas en `.env.example`, como el resto.
