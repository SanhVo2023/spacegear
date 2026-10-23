import { Container, SectionHeader } from "@/components/ui";
import { getContent } from "@/lib/content";
import { dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locales";
import { SAMPLE_MARKER, SAMPLE_TESTIMONIALS, SHOW_SAMPLES } from "@/lib/samples";
import TestimonialsCarousel from "./TestimonialsCarousel";

/** The entries the section shows in `locale`: real, permission-confirmed quotes, or the dev samples. */
function reviewsFor(locale: Locale) {
  const { TESTIMONIALS } = getContent(locale);
  const usingSamples = TESTIMONIALS.length === 0 && SHOW_SAMPLES;
  return { usingSamples, reviews: TESTIMONIALS.length ? TESTIMONIALS : usingSamples ? SAMPLE_TESTIMONIALS : [] };
}
/** Whether the section renders in `locale` (the home progress rail lists it only then). */
export const hasTestimonials = (locale: Locale) => reviewsFor(locale).reviews.length > 0;
export const HAS_TESTIMONIALS = hasTestimonials("en");

export default function Testimonials({ locale = "en" }: { locale?: Locale }) {
  // Renders only real, permission-confirmed quotes (or dev samples).
  const { usingSamples, reviews } = reviewsFor(locale);
  if (reviews.length === 0) return null;
  return (
    <section id="testimonials" data-sample={usingSamples ? SAMPLE_MARKER : undefined} className="relative scroll-mt-2 py-24">
      <Container>
        {usingSamples && <p className="mb-6 font-mono text-[11px] uppercase tracking-[0.16em] text-flame">{dictionary(locale).testimonials.sample}</p>}
        <SectionHeader {...getContent(locale).SECTIONS.testimonials} />
        <TestimonialsCarousel reviews={reviews} />
      </Container>
    </section>
  );
}
