import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Nav from "@/components/Nav";
import Footer from "@/components/sections/Footer";
import { Container } from "@/components/ui";
import { ARTICLES } from "@/lib/content";

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const a = ARTICLES.find((x) => x.slug === slug);
  return a ? { title: `${a.title} — Platform® Labs` } : {};
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = ARTICLES.find((a) => a.slug === slug);
  if (!article) notFound();
  const more = ARTICLES.filter((a) => a.slug !== slug).slice(0, 3);

  return (
    <main className="relative min-h-screen bg-bg">
      <Nav />
      <article className="pt-32 pb-24">
        <Container>
          <Link
            href="/#labs"
            className="font-mono text-[12px] text-mut-2 transition-colors hover:text-flame"
          >
            ← Platform Labs®
          </Link>

          <div className="mt-6 flex items-center gap-2 font-mono text-[11px] text-mut-3">
            <span>Written by</span>
            <span className="text-mut">{article.author}</span>
            <span>·</span>
            <span>{article.date}</span>
          </div>
          <h1 className="display mt-4 max-w-3xl text-[clamp(32px,5vw,60px)] text-ink">
            {article.title}
          </h1>
          <p className="mt-4 max-w-2xl text-[16px] text-mut-2">{article.sub}</p>

          {/* hero image */}
          <div className="relative mt-10 h-[clamp(220px,40vw,460px)] overflow-hidden rounded-3xl border border-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={article.img}
              alt={article.title}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-bg/40 to-transparent" />
          </div>

          {/* body */}
          <div className="mx-auto mt-12 max-w-2xl space-y-6">
            {article.body.map((p, i) => (
              <p key={i} className="text-[17px] leading-relaxed text-mut">
                {p}
              </p>
            ))}
          </div>
        </Container>
      </article>

      {/* more articles */}
      <section className="border-t border-line-soft py-20">
        <Container>
          <h2 className="display text-2xl text-ink">More from Platform Labs®</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {more.map((a) => (
              <Link
                key={a.slug}
                href={`/labs/${a.slug}`}
                className="group overflow-hidden rounded-2xl border border-line bg-card/50 transition-colors hover:border-flame/40"
              >
                <div className="relative h-36 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.img}
                    alt={a.title}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                </div>
                <div className="p-5">
                  <p className="font-mono text-[10px] text-mut-3">{a.author}</p>
                  <h3 className="mt-2 text-[15px] font-medium leading-snug text-ink">
                    {a.title}
                  </h3>
                </div>
              </Link>
            ))}
          </div>
        </Container>
      </section>

      <Footer />
    </main>
  );
}
