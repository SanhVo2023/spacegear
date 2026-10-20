import { Container, FlameButton, GhostButton } from "@/components/ui";

export default function NotFound() {
  return (
    <main id="main" className="relative min-h-screen bg-bg">
      <section className="pt-40 pb-24">
        <Container>
          <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-mut-2">
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-flame" />
            Page not found
          </span>
          <h1 className="display mt-6 text-[clamp(40px,8vw,96px)] text-ink">
            A different <span className="text-flame">direction</span>.
          </h1>
          <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-mut-2">This page is unavailable. Explore our services or tell us what you would like to improve.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <FlameButton href="/services/">Explore services</FlameButton>
            <GhostButton href="/">Back to home</GhostButton>
          </div>
        </Container>
      </section>
    </main>
  );
}
