import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Nav from "@/components/Nav";
import Footer from "@/components/sections/Footer";
import { Container, FlameButton } from "@/components/ui";
import { PRODUCTS } from "@/lib/content";

export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = PRODUCTS.find((x) => x.slug === slug);
  return p ? { title: `${p.name} — Platform®` } : {};
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = PRODUCTS.find((p) => p.slug === slug);
  if (!product) notFound();

  return (
    <main className="relative min-h-screen bg-bg">
      <Nav />
      <section className="pt-32 pb-20">
        <Container>
          <Link
            href="/#work"
            className="font-mono text-[12px] text-mut-2 transition-colors hover:text-flame"
          >
            ← Our Work
          </Link>

          <div className="mt-8 grid items-center gap-10 lg:grid-cols-2">
            <div>
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-flame">
                Featured Product
              </span>
              <h1 className="display mt-3 text-[clamp(40px,6vw,72px)] text-ink">
                {product.name}
              </h1>
              <p className="mt-5 max-w-md text-[16px] leading-relaxed text-mut-2">
                {product.tagline}
              </p>
              <div className="mt-8 flex gap-3">
                <FlameButton href="/#contact">Book a Demo</FlameButton>
              </div>
            </div>
            <div className="relative h-[clamp(260px,40vw,420px)] overflow-hidden rounded-3xl border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={product.img}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            </div>
          </div>

          {/* specs */}
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {product.specs.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-line bg-card/50 p-5"
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-mut-3">
                  {s.label}
                </p>
                <p className="display mt-2 text-2xl text-ink-strong">{s.value}</p>
              </div>
            ))}
          </div>

          {/* features + gallery */}
          <div className="mt-10 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
            <div className="rounded-3xl border border-line bg-card/50 p-8">
              <h2 className="display text-2xl text-ink">Capabilities</h2>
              <ul className="mt-6 space-y-4">
                {product.features.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-[15px] text-mut">
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-flame/15 text-[10px] text-flame">
                      ✓
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {product.gallery.map((g, i) => (
                <div
                  key={i}
                  className="relative h-48 overflow-hidden rounded-2xl border border-line"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={g} alt="" className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>
      <Footer />
    </main>
  );
}
