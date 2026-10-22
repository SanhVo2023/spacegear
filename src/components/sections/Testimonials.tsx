import { Container, SectionHeader } from "@/components/ui";
import { SECTIONS, TESTIMONIALS } from "@/lib/content";
import { SAMPLE_MARKER, SAMPLE_TESTIMONIALS, SHOW_SAMPLES } from "@/lib/samples";
import TestimonialsCarousel from "./TestimonialsCarousel";

const USING_SAMPLES = TESTIMONIALS.length === 0 && SHOW_SAMPLES;
const REVIEWS = TESTIMONIALS.length ? TESTIMONIALS : USING_SAMPLES ? SAMPLE_TESTIMONIALS : [];
/** Whether the section renders (the home progress rail lists it only then). */
export const HAS_TESTIMONIALS = REVIEWS.length > 0;

export default function Testimonials() {
  // Renders only real, permission-confirmed quotes (or dev samples).
  if (!HAS_TESTIMONIALS) return null;
  return (
    <section id="testimonials" data-sample={USING_SAMPLES ? SAMPLE_MARKER : undefined} className="relative scroll-mt-2 py-24">
      <Container>
        {USING_SAMPLES && <p className="mb-6 font-mono text-[11px] uppercase tracking-[0.16em] text-flame">Sample content — not a real client</p>}
        <SectionHeader {...SECTIONS.testimonials} />
        <TestimonialsCarousel reviews={REVIEWS} />
      </Container>
    </section>
  );
}
