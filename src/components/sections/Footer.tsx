"use client";

import { motion } from "motion/react";
import { Container } from "@/components/ui";

const COL_A = [
  "Home",
  "Work",
  "Services",
  "Process",
  "Smart Analytics",
  "Pricing",
  "FAQ",
  "Testimonials",
];
const COL_B = [
  "The Team",
  "Platform Labs®",
  "Contact",
  "Terms of Service",
  "Privacy Policy",
  "GDPR Compliance",
  "Data Protection",
  "404",
];
const SOCIALS = ["in", "𝕏", "◎", "▶", "✆"];

/** Rotating circular wordmark badge with an orange core. */
function CircleBadge() {
  return (
    <div className="relative h-24 w-24">
      <motion.svg
        viewBox="0 0 100 100"
        className="h-full w-full"
        animate={{ rotate: 360 }}
        transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
      >
        <defs>
          <path
            id="circlePath"
            d="M50,50 m-37,0 a37,37 0 1,1 74,0 a37,37 0 1,1 -74,0"
          />
        </defs>
        <text className="fill-mut-2 font-mono text-[8.5px] uppercase tracking-[0.18em]">
          <textPath href="#circlePath" startOffset="0%">
            we run infrastructure · you lead innovation ·
          </textPath>
        </text>
      </motion.svg>
      <span className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-flame shadow-[0_0_24px_rgba(250,110,67,0.6)]" />
    </div>
  );
}

function DotHeader() {
  return (
    <div className="mb-6 flex gap-1.5">
      <span className="h-1.5 w-5 rounded-full bg-flame" />
      <span className="h-1.5 w-1.5 rounded-full bg-mut-3/60" />
    </div>
  );
}

export default function Footer() {
  return (
    <footer
      id="contact"
      className="relative overflow-hidden border-t border-line bg-[#0c0d0f]"
    >
      <Container className="py-12">
        {/* top bento */}
        <div className="grid overflow-hidden rounded-3xl border border-line bg-card/30 lg:grid-cols-[0.85fr_1.15fr]">
          {/* left: badge + tagline */}
          <div className="flex flex-col items-center gap-6 border-b border-line-soft p-6 text-center sm:p-8 lg:items-start lg:justify-between lg:gap-10 lg:border-b-0 lg:border-r lg:text-left">
            <CircleBadge />
            <p className="max-w-xs text-[15px] leading-snug text-mut lg:border-l lg:border-line lg:pl-4">
              The smarter way to build, run and scale your business.
            </p>
          </div>

          {/* right: wordmark + email + address */}
          <div className="relative overflow-hidden p-6 text-center sm:p-8 lg:text-left">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_120%_at_70%_40%,rgba(250,110,67,0.08),transparent_60%)]" />
            <a
              href="mailto:hello@platform.nl"
              className="relative inline-block text-[13px] text-mut-2 transition-colors hover:text-flame lg:float-right"
            >
              hello@platform.nl
            </a>
            <div className="relative mt-4 lg:mt-8">
              <h2 className="display text-[clamp(52px,12vw,128px)] leading-[0.85] text-flame">
                plat<span className="text-ink">—</span>form
                <sup className="ml-1 align-top text-base text-mut-3">™</sup>
              </h2>
              <div className="mt-5 text-[13px] leading-relaxed text-mut-2 lg:mt-6">
                <p>Keizersgracht 500</p>
                <p>1017 EG — Amsterdam</p>
                <p className="font-medium text-ink">Netherlands, EU</p>
              </div>
            </div>
          </div>
        </div>

        {/* middle bento */}
        <div className="mt-4 overflow-hidden rounded-3xl border border-line bg-card/30 lg:grid lg:grid-cols-[0.6fr_0.6fr_1.1fr]">
          {/* links — 2 columns on mobile, individual cells on desktop */}
          <div className="grid grid-cols-2 border-b border-line-soft lg:contents lg:border-b-0">
            {[COL_A, COL_B].map((col, ci) => (
              <div
                key={ci}
                className={`p-6 sm:p-8 lg:border-r lg:border-line-soft ${
                  ci === 0 ? "border-r border-line-soft lg:border-r" : ""
                }`}
              >
                <DotHeader />
                <ul className="space-y-3">
                  {col.map((it) => (
                    <li key={it}>
                      <a
                        href="#"
                        className="text-[14px] text-mut-2 transition-colors hover:text-ink"
                      >
                        {it}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* newsletter */}
          <div className="p-6 sm:p-8">
            <h3 className="display text-2xl text-ink-strong">
              Keep up with our journey and updates
            </h3>
            <p className="mt-2 text-[13px] text-mut-2">
              Get the latest news, insights directly to your inbox.{" "}
              <span className="text-flame">*</span>
            </p>
            <form
              className="mt-6 space-y-3"
              onSubmit={(e) => e.preventDefault()}
            >
              <input
                type="text"
                placeholder="Your Name"
                className="w-full rounded-xl border border-line bg-card-2/60 px-4 py-3.5 text-[14px] text-ink placeholder:text-mut-3 focus:border-flame focus:outline-none"
              />
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="Your Email"
                  className="w-full rounded-xl border border-line bg-card-2/60 px-4 py-3.5 text-[14px] text-ink placeholder:text-mut-3 focus:border-flame focus:outline-none"
                />
                <button
                  type="submit"
                  aria-label="Subscribe"
                  className="grid aspect-square h-[50px] place-items-center rounded-xl bg-flame text-[#161719] transition-transform hover:translate-x-0.5"
                >
                  →
                </button>
              </div>
            </form>
            <p className="mt-4 text-[12px] text-mut-2">
              By submitting, you agree to our{" "}
              <a href="#" className="text-flame hover:underline">
                Terms &amp; Service.
              </a>
            </p>
            <p className="mt-2 text-[12px] text-flame">
              * No spam, just awesome updates.
            </p>
          </div>
        </div>

        {/* bottom bar */}
        <div className="mt-4 grid overflow-hidden rounded-3xl border border-line bg-card/30 text-[12px] lg:grid-cols-[1fr_1.2fr_auto_auto]">
          <div className="border-b border-line-soft p-6 text-mut-2 lg:border-b-0 lg:border-r">
            <p>2021–2026 © Platform B.V. All rights reserved.</p>
            <p className="mt-2 text-mut-3">Recreated as a Next.js study build.</p>
          </div>
          <div className="border-b border-line-soft p-6 text-mut-2 lg:border-b-0 lg:border-r">
            <span className="font-medium text-ink">Platform B.V.</span>, registered
            in the Netherlands, specializes in AI and infrastructure services with
            a focus on automation.
          </div>
          <div className="flex items-center gap-3 border-b border-line-soft p-6 lg:border-b-0 lg:border-r">
            {SOCIALS.map((s, i) => (
              <a
                key={i}
                href="#"
                className="grid h-9 w-9 place-items-center rounded-lg border border-line text-mut-2 transition-colors hover:border-flame hover:text-flame"
              >
                {s}
              </a>
            ))}
          </div>
          <a
            href="#home"
            aria-label="Back to top"
            className="grid place-items-center p-6 text-flame transition-colors hover:bg-card-2"
          >
            <span className="text-xl">↑</span>
          </a>
        </div>
      </Container>
    </footer>
  );
}
