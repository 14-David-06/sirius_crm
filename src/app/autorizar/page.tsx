import Link from "next/link";

import { leerCliente, SCOPE_ESCRIBIR } from "@/lib/mcp/oauth";
import { LogoSirius } from "../logo";
import { FormularioAutorizar, type Solicitud } from "./formulario";

export const dynamic = "force-dynamic";

/** Los parámetros que `/api/oauth/authorize` pasa a esta pantalla. */
const PARAMETROS = [
  "client_id",
  "redirect_uri",
  "code_challenge",
  "code_challenge_method",
  "response_type",
  "state",
  "scope",
  "resource",
] as const;

/**
 * La pantalla donde una persona autoriza —o no— que Claude entre al CRM a su
 * nombre.
 *
 * No valida nada por su cuenta: a esta URL solo se llega desde
 * `/api/oauth/authorize`, que ya comprobó el cliente y el `redirect_uri`, y el
 * `POST` al que este formulario envía lo vuelve a comprobar todo. Aquí lo único
 * que se hace es leer el nombre del cliente para poder decir de quién se está
 * hablando, y pedir la contraseña.
 */
export default async function AutorizarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const solicitud = {} as Solicitud;
  for (const clave of PARAMETROS) {
    const valor = params[clave];
    if (typeof valor === "string") solicitud[clave] = valor;
  }

  if (!solicitud.client_id || !solicitud.redirect_uri) {
    return (
      <Marco>
        <h1 className="text-2xl font-semibold tracking-tight">
          Solicitud incompleta
        </h1>
        <p className="mt-2 text-sm text-black/60 dark:text-white/60">
          A esta pantalla se llega desde la aplicación que quiere conectarse. Si
          llegaste aquí de otra forma, vuelve a intentar la conexión desde
          Claude.
        </p>
      </Marco>
    );
  }

  const cliente = await leerCliente(solicitud.client_id);
  const nombreCliente = cliente?.nombre?.trim() || "Una aplicación";

  // Solo se ofrece conceder escritura si el cliente la pidió.
  const pedidos = (solicitud.scope ?? "").split(/\s+/).filter(Boolean);
  const ofrecerEscritura =
    pedidos.length === 0 || pedidos.includes(SCOPE_ESCRIBIR);

  let destino: string;
  try {
    destino = new URL(solicitud.redirect_uri).host;
  } catch {
    destino = solicitud.redirect_uri;
  }

  return (
    <Marco>
      <h1 className="text-2xl font-semibold tracking-tight">
        Conectar {nombreCliente} al CRM
      </h1>
      <p className="mt-2 text-sm text-black/60 dark:text-white/60">
        Entra con tu cédula y contraseña. El conector queda con{" "}
        <strong className="font-medium">tu</strong> nivel de acceso: verá y hará
        exactamente lo que tú puedes hacer en el CRM, ni más ni menos.
      </p>

      <FormularioAutorizar
        solicitud={solicitud}
        nombreCliente={nombreCliente}
        destino={destino}
        ofrecerEscritura={ofrecerEscritura}
      />
    </Marco>
  );
}

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-black/10 dark:border-white/15">
        <nav className="mx-auto flex max-w-5xl items-center px-6 py-4">
          <Link
            href="/"
            className="flex items-center rounded-md focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none"
          >
            <LogoSirius />
          </Link>
        </nav>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
