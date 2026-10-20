// Development-only preview data for the Testimonials and Labs layouts.
// These are NOT real clients or articles. Sections read them only when
// `next dev` runs with NEXT_PUBLIC_SHOW_SAMPLES=true. Production builds cannot
// render them: NODE_ENV is "production", check-content refuses the flag, and
// check-export fails if SAMPLE_MARKER appears in exported HTML.
import type { Article, Testimonial } from "./content";

export const SAMPLE_MARKER = "spacegear-sample-content";
export const SHOW_SAMPLES = process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_SHOW_SAMPLES === "true";

export const SAMPLE_TESTIMONIALS: Testimonial[] = [
  { img: "/images/reviews/r1.webp", name: "Sample Person A", role: "Sample role", company: "Sample Co.", quote: "Sample quote. Replace with a real, permission-confirmed testimonial before launch.", permissionConfirmed: true },
  { img: "/images/reviews/r2.webp", name: "Sample Person B", role: "Sample role", company: "Sample Co.", quote: "Sample quote. Shows how a longer testimonial wraps inside the original quote card layout.", permissionConfirmed: true },
  { img: "/images/reviews/r3.webp", name: "Sample Person C", role: "Sample role", company: "Sample Co.", quote: "Sample quote. Thumbnails below switch between entries, as in the original.", permissionConfirmed: true },
];

export const SAMPLE_ARTICLES: Article[] = [
  { slug: "sample-a", author: "Sample author", title: "Sample article title", sub: "Sample summary. Replace with a published article.", img: "/images/labs/ethical-ai.webp", href: "/" },
  { slug: "sample-b", author: "Sample author", title: "Sample article title", sub: "Sample summary. Replace with a published article.", img: "/images/labs/zero-latency.webp", href: "/" },
  { slug: "sample-c", author: "Sample author", title: "Sample article title", sub: "Sample summary. Replace with a published article.", img: "/images/labs/observability.webp", href: "/" },
  { slug: "sample-d", author: "Sample author", title: "Sample article title", sub: "Sample summary. Replace with a published article.", img: "/images/labs/process-automation.webp", href: "/" },
];
