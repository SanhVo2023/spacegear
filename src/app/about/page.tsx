import PageIntro from "@/components/PageIntro";
import DotField from "@/components/DotField";
import Team from "@/components/sections/Team";
import { Container, CtaBand } from "@/components/ui";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({ title: "About", description: "spacegear.tech connects digital transformation and AI strategy with hands-on delivery, practical implementation and adoption.", path: "/about/" });

const PRINCIPLES = ["Understand before recommending", "Make assumptions visible and testable", "Design for the whole workflow", "Keep human judgment where it matters", "Make handover part of delivery"];

export default function About() {
  return (
    <main id="main" className="relative min-h-screen bg-bg">
      <section className="pt-32 pb-12">
        <Container>
          <PageIntro
            eyebrow="About spacegear.tech"
            title="Good thinking should become useful work."
            description="We connect business strategy, technology and delivery to help you make a meaningful change in the way work gets done."
          />
          <div className="mt-12 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-3xl border border-line bg-card/50 p-8">
              <h2 className="display text-[clamp(26px,3vw,40px)] text-ink">Business context first. Technology with a purpose.</h2>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-mut-2">Digital transformation starts with a real challenge. We look at the work, the people using the systems and the constraints around them, then choose an approach that makes sense.</p>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-mut-2">AI and deep learning are part of the toolkit. So are process design, integration and thoughtful software engineering. The goal is a solution you can operate, understand and improve.</p>
            </div>
            <div className="flex flex-col gap-5 rounded-2xl border border-line bg-card/50 p-6">
              <div className="flex items-center justify-between border-b border-line-soft pb-4">
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-mut-2">Working principles</span>
                <span className="font-mono text-[12px] tracking-[0.2em] text-flame">0{PRINCIPLES.length}</span>
              </div>
              <ul className="space-y-3">
                {PRINCIPLES.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-[13.5px] text-mut">
                    <span aria-hidden className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-flame/15 text-[8px] text-flame">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              <DotField cols={5} rows={3} className="mt-auto gap-y-4 px-1" />
            </div>
          </div>
        </Container>
      </section>
      <Team />
      <section className="pb-24">
        <Container>
          <CtaBand title="From the first decision to what happens next." text="We bring strategy and implementation into the same conversation." cta="See how we work" href="/approach/" />
        </Container>
      </section>
    </main>
  );
}
