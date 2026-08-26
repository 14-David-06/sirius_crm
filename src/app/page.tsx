import Link from "next/link";

const features = [
  {
    title: "Contactos",
    description:
      "Centraliza clientes, prospectos y empresas en una sola base de datos ordenada.",
  },
  {
    title: "Oportunidades",
    description:
      "Da seguimiento a cada negocio por etapa y conoce el estado real de tu pipeline.",
  },
  {
    title: "Actividad",
    description:
      "Registra llamadas, correos y notas para que nada del historial se pierda.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-black/10 dark:border-white/15">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold tracking-tight">
            Sirius <span className="text-blue-600 dark:text-blue-400">CRM</span>
          </span>
          <Link
            href="#contacto"
            className="rounded-full border border-black/10 px-4 py-1.5 text-sm transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
          >
            Contacto
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-6 py-24 text-center sm:py-32">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Sirius CRM
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-black/60 dark:text-white/60">
            El CRM simple para organizar tus contactos, dar seguimiento a tus
            oportunidades y cerrar más negocios.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="#contacto"
              className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-85"
            >
              Comenzar
            </Link>
            <Link
              href="#funciones"
              className="rounded-full border border-black/10 px-6 py-3 text-sm font-medium transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
            >
              Ver funciones
            </Link>
          </div>
        </section>

        <section
          id="funciones"
          className="mx-auto max-w-5xl px-6 pb-24 sm:pb-32"
        >
          <div className="grid gap-6 sm:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-black/10 p-6 dark:border-white/15"
              >
                <h2 className="text-base font-semibold">{feature.title}</h2>
                <p className="mt-2 text-sm text-black/60 dark:text-white/60">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer
        id="contacto"
        className="border-t border-black/10 dark:border-white/15"
      >
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-6 py-6 text-sm text-black/60 sm:flex-row dark:text-white/60">
          <span>© {new Date().getFullYear()} Sirius CRM</span>
          <a
            href="mailto:david@siriusregenerative.com"
            className="hover:text-foreground"
          >
            david@siriusregenerative.com
          </a>
        </div>
      </footer>
    </div>
  );
}
