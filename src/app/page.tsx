import Image from "next/image";
import Link from "next/link";

import fondoNoche from "../../public/fondo-noche.png";
import { LogoSirius } from "./logo";

const features = [
  {
    title: "Contactos",
    description:
      "Centraliza clientes, prospectos y empresas en una sola base de datos ordenada.",
    icon: (
      <>
        <path d="M16 19a4 4 0 0 0-8 0" />
        <circle cx="12" cy="10" r="3" />
        <circle cx="12" cy="12" r="9" />
      </>
    ),
  },
  {
    title: "Oportunidades",
    description:
      "Da seguimiento a cada negocio por etapa y conoce el estado real de tu pipeline.",
    icon: (
      <>
        <path d="M4 19V6" />
        <path d="M4 19h16" />
        <path d="M8 19v-6" />
        <path d="M13 19V9" />
        <path d="M18 19v-9.5" />
      </>
    ),
  },
  {
    title: "Actividad",
    description:
      "Registra llamadas, correos y notas para que nada del historial se pierda.",
    icon: (
      <>
        <path d="M12 7v5l3 2" />
        <circle cx="12" cy="12" r="9" />
      </>
    ),
  },
];

const stats = [
  { value: "1", label: "Una sola fuente de verdad" },
  { value: "3 min", label: "Registrar una visita" },
  { value: "24/7", label: "Disponible desde el campo" },
];

export default function Home() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-[#0b0a0d] text-white">
      {/* Fondo: la foto ancla el hero y se disuelve en el fondo de la página */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[130vh] min-h-[900px] overflow-hidden">
        <Image
          src={fondoNoche}
          alt=""
          fill
          priority
          placeholder="blur"
          sizes="100vw"
          className="scale-105 object-cover object-center contrast-110 saturate-125"
        />
        {/* Tinte base */}
        <div className="absolute inset-0 bg-[#0b0a0d]/45" />
        {/* Difuminado hacia el fondo de la página */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b0a0d]/85 via-[#0b0a0d]/40 to-[#0b0a0d]" />
        {/* Viñeta lateral */}
        <div className="absolute inset-0 bg-[radial-gradient(115%_70%_at_50%_35%,transparent_35%,rgba(11,10,13,0.8)_100%)]" />
        {/* Sombra suave detrás del texto del hero */}
        <div className="absolute inset-0 bg-[radial-gradient(55%_45%_at_50%_42%,rgba(11,10,13,0.65),transparent_75%)]" />
      </div>

      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0b0a0d]/50 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="flex items-center">
            <LogoSirius variante="claro" />
          </span>
          <div className="flex items-center gap-1 sm:gap-2">
            <Link
              href="#funciones"
              className="hidden rounded-full px-4 py-1.5 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white sm:block"
            >
              Funciones
            </Link>
            <Link
              href="#contacto"
              className="rounded-full px-4 py-1.5 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              Contacto
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-white/20 bg-white/5 px-4 py-1.5 text-sm font-medium transition-colors hover:border-white/40 hover:bg-white/15"
            >
              Iniciar sesión
            </Link>
          </div>
        </nav>
      </header>

      <main className="relative z-10 flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-4xl px-6 pt-24 pb-28 text-center sm:pt-36 sm:pb-40">
          <span className="animate-aparecer inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs tracking-wide text-white/70 uppercase backdrop-blur-md">
            Sirius Regenerative
          </span>

          <h1 className="animate-aparecer animate-retraso-1 mt-8 text-5xl font-bold tracking-tight text-balance sm:text-7xl">
            El CRM que crece
            <span className="block bg-gradient-to-r from-amber-200 via-amber-100 to-white/70 bg-clip-text text-transparent">
              con tu campo
            </span>
          </h1>

          <p className="animate-aparecer animate-retraso-2 mx-auto mt-7 max-w-2xl text-lg text-pretty text-white/65 sm:text-xl">
            Organiza tus contactos, da seguimiento a tus oportunidades y
            registra cada visita desde donde estés. Simple, rápido y sin
            fricción.
          </p>

          <div className="animate-aparecer animate-retraso-3 mt-11 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/login"
              className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-[#0b0a0d] shadow-[0_8px_40px_-8px_rgba(255,255,255,0.5)] transition-transform hover:-translate-y-0.5 sm:w-auto"
            >
              Comenzar
              <span
                aria-hidden
                className="transition-transform group-hover:translate-x-0.5"
              >
                →
              </span>
            </Link>
            <Link
              href="#funciones"
              className="inline-flex w-full items-center justify-center rounded-full border border-white/20 bg-white/5 px-7 py-3.5 text-sm font-medium backdrop-blur-md transition-colors hover:border-white/40 hover:bg-white/15 sm:w-auto"
            >
              Ver funciones
            </Link>
          </div>

          <dl className="animate-aparecer animate-retraso-4 mx-auto mt-20 grid max-w-2xl grid-cols-3 gap-4 border-t border-white/10 pt-8">
            {stats.map((stat) => (
              <div key={stat.label}>
                <dt className="text-2xl font-semibold text-amber-200 sm:text-3xl">
                  {stat.value}
                </dt>
                <dd className="mt-1 text-xs text-white/50 sm:text-sm">
                  {stat.label}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Funciones */}
        <section
          id="funciones"
          className="mx-auto max-w-6xl scroll-mt-20 px-6 pb-28 sm:pb-36"
        >
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Todo lo esencial, nada de más
            </h2>
            <p className="mt-4 text-white/60">
              Tres módulos que cubren el ciclo completo de una relación
              comercial.
            </p>
          </div>

          <div className="mt-14 grid gap-5 sm:grid-cols-3">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="tarjeta3d group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-7 backdrop-blur-xl transition-colors hover:border-white/25 hover:bg-white/[0.07]"
              >
                <span className="absolute top-6 right-7 font-mono text-xs text-white/25">
                  0{index + 1}
                </span>
                <span className="flex size-11 items-center justify-center rounded-xl border border-amber-200/25 bg-amber-200/10 text-amber-200">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-5"
                    aria-hidden
                  >
                    {feature.icon}
                  </svg>
                </span>
                <h3 className="mt-5 text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-white/60">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-6 pb-28 sm:pb-36">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] px-8 py-14 text-center backdrop-blur-xl sm:px-16">
            <div className="pointer-events-none absolute inset-x-0 -top-24 h-48 bg-[radial-gradient(50%_100%_at_50%_100%,rgba(252,211,77,0.18),transparent)]" />
            <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Empieza a registrar tu próxima visita hoy
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-white/60">
              Entra con tu cédula y ten a tu equipo trabajando en minutos.
            </p>
            <Link
              href="/login"
              className="mt-9 inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-[#0b0a0d] transition-transform hover:-translate-y-0.5"
            >
              Iniciar sesión
              <span aria-hidden>→</span>
            </Link>
          </div>
        </section>
      </main>

      <footer
        id="contacto"
        className="relative z-10 scroll-mt-20 border-t border-white/10 bg-[#0b0a0d]/50 backdrop-blur-xl"
      >
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-white/50 sm:flex-row">
          <span>© {new Date().getFullYear()} Sirius CRM</span>
          <a
            href="mailto:david@siriusregenerative.com"
            className="transition-colors hover:text-white"
          >
            david@siriusregenerative.com
          </a>
        </div>
      </footer>
    </div>
  );
}
