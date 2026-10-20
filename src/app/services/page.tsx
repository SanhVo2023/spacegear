import Link from "next/link";
import type { Metadata } from "next";
import Nav from "@/components/Nav";
import Footer from "@/components/sections/Footer";
import { Container, FlameButton } from "@/components/ui";
import { SERVICES } from "@/lib/content";

export const metadata: Metadata = {
  title: "Services — Platform®",
};

export default function ServicesPage() {
  return (
    <main className="relative min-h-screen bg-bg">
      <Nav />
      <section className="pt-32 pb-20">
        <Container>
          <Link
            href="/#services"
            className="font-mono text-[12px] text-mut-2 transition-colors hover:text-flame"
          >
            ← Home
          </Link>
          <h1 className="display mt-6 max-w-3xl text-[clamp(36px,6vw,72px)] text-ink">
            Flexible solutions for building modern digital infrastructure.
          </h1>
          <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-mut-2">
            Four capabilities — design, optimize, scale, and secure — that work
            together as one self-evolving system.
          </p>

          <div className="mt-12 space-y-4">
            {SERVICES.map((s) => (
              <div
                key={s.slug}
                className="grid gap-6 overflow-hidden rounded-3xl border border-line bg-card/50 p-8 lg:grid-cols-[80px_1fr_320px] lg:items-center"
              >
                <div className="flex items-center gap-3 lg:flex-col lg:items-start">
                  <span className="display text-3xl text-flame">{s.no}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-mut-3">
                    {s.tag}
                  </span>
                </div>
                <div>
                  <h2 className="display text-2xl text-ink">{s.name}</h2>
                  <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-mut-2">
                    {s.long}
                  </p>
                  <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
                    {s.bullets.map((b) => (
                      <li
                        key={b}
                        className="flex items-center gap-2 text-[13px] text-mut"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-flame" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="relative h-44 overflow-hidden rounded-2xl border border-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.img}
                    alt={s.name}
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-col items-center gap-4 rounded-3xl border border-line bg-card/40 p-10 text-center">
            <h2 className="display text-3xl text-ink">
              Design, optimize, scale, and secure.
            </h2>
            <p className="max-w-md text-[14px] text-mut-2">
              See how the full suite works together for your stack.
            </p>
            <FlameButton href="/#contact">Book a Demo</FlameButton>
          </div>
        </Container>
      </section>
      <Footer />
    </main>
  );
}
