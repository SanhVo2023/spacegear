import PageIntro from "@/components/PageIntro";
import { ProcessSteps } from "@/components/sections/Process";
import { Container, CtaBand } from "@/components/ui";
import { APPROACH_STEPS } from "@/lib/content";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({ title: "Our Approach", description: "Assess, prioritize, validate, deliver and adopt. A practical approach to digital transformation and AI implementation with clear decisions and handover.", path: "/approach/" });

export default function Approach() {
  return (
    <main id="main" className="relative min-h-screen bg-bg">
      <section className="pt-32 pb-24">
        <Container>
          <PageIntro
            eyebrow="How we work"
            title="A clear path from intention to implementation."
            description="Useful deliverables, visible decisions and a shared understanding of what comes next. The depth of each stage follows the engagement."
          />
          <h2 className="sr-only">How an engagement runs</h2>
          <ProcessSteps steps={APPROACH_STEPS} gridClassName="md:grid-cols-2 xl:grid-cols-5" />
          <CtaBand title="Start with the challenge in front of you." text="Tell us where you are and we’ll suggest a sensible starting point." />
        </Container>
      </section>
    </main>
  );
}
