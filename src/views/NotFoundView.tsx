import { Container, FlameButton, GhostButton } from "@/components/ui";
import { dictionary } from "@/lib/i18n/dictionary";

/** The one 404 page (every unknown URL in either language): it says everything in English and in Vietnamese. */
export default function NotFoundView() {
  const [en, vi] = [dictionary("en").notFound, dictionary("vi").notFound];
  return (
    <main id="main" className="relative min-h-screen bg-bg">
      <section className="pt-40 pb-24">
        <Container>
          <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-mut-2">
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-flame" />
            {en.eyebrow}
          </span>
          <h1 className="display mt-6 text-[clamp(40px,8vw,96px)] text-ink">
            {en.headingBefore}<span className="text-flame">{en.headingAccent}</span>{en.headingAfter}
          </h1>
          <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-mut-2">{en.text}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <FlameButton href="/services/">{en.explore}</FlameButton>
            <GhostButton href="/">{en.home}</GhostButton>
          </div>
          <div lang="vi" className="mt-16 border-t border-line-soft pt-10">
            <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-mut-2">
              <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-flame" />
              {vi.eyebrow}
            </span>
            <h2 className="display mt-6 text-[clamp(32px,6vw,72px)] text-ink">
              {vi.headingBefore}<span className="text-flame">{vi.headingAccent}</span>{vi.headingAfter}
            </h2>
            <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-mut-2">{vi.text}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <FlameButton href="/vi/services/">{vi.explore}</FlameButton>
              <GhostButton href="/vi/">{vi.home}</GhostButton>
            </div>
          </div>
        </Container>
      </section>
    </main>
  );
}
