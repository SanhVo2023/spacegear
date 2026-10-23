import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Services, Process, Analytics and Pricing are client components: they read the page's language from
// LocaleProvider (useLocale), so English markup stays the same and /vi/ pages get Vietnamese copy and links.
const { LocaleProvider } = await import("../src/components/LocaleProvider.tsx");
const { default: Services } = await import("../src/components/sections/Services.tsx");
const { default: Process } = await import("../src/components/sections/Process.tsx");
const { default: Analytics } = await import("../src/components/sections/Analytics.tsx");
const { default: Pricing } = await import("../src/components/sections/Pricing.tsx");
const { getContent } = await import("../src/lib/content.ts");
const h = React.createElement;
const render = (Section, locale) => renderToStaticMarkup(locale ? h(LocaleProvider, { locale }, h(Section)) : h(Section));
const SECTIONS = { Services, Process, Analytics, Pricing };
// Outside a Next build, next/link drops the trailing slash (trailingSlash is a build setting), so links match either way.
const link = (path) => new RegExp(`href="${path.replace(/\/$/, "")}/?"`);

test("without a provider and with locale en, each section renders the same English markup", () => {
  for (const [name, Section] of Object.entries(SECTIONS)) assert.equal(render(Section, "en"), render(Section), name);
});

test("Services: Vietnamese copy, /vi/ links and the Vietnamese cursor label", () => {
  const en = render(Services);
  assert.match(en, link("/services/applied-ai/"));
  assert.match(en, /data-cursor="Open"/);
  assert.match(en, link("/services/"));
  const vi = render(Services, "vi");
  const { PILLARS, CORE_PANEL, SECTIONS: copy } = getContent("vi");
  for (const pillar of PILLARS) {
    assert.match(vi, link(`/vi/services/${pillar.slug}/`), pillar.slug);
    assert.ok(vi.includes(pillar.name), pillar.name);
  }
  assert.doesNotMatch(vi, /href="\/services/, "every service link is localized");
  assert.match(vi, /data-cursor="Mở"/);
  assert.doesNotMatch(vi, /data-cursor="Open"/);
  assert.match(vi, link("/vi/services/"), "the core panel's button");
  assert.ok(vi.includes(CORE_PANEL.cta) && vi.includes(copy.services.title));
});

test("Process: Vietnamese steps, output label and CTA link; the count-ups render the same numbers", () => {
  const en = render(Process);
  assert.match(en, /outputs<\/span>/);
  assert.match(en, link("/contact/"));
  const vi = render(Process, "vi");
  const { PROCESS_STEPS, PROCESS_CTA } = getContent("vi");
  for (const step of PROCESS_STEPS) assert.ok(vi.includes(step.name), step.name);
  assert.ok(vi.includes(PROCESS_CTA.title));
  assert.match(vi, link("/vi/contact/"));
  assert.match(vi, /đầu ra<\/span>/);
  assert.doesNotMatch(vi, />outputs?</);
  const counts = (html) => [...html.matchAll(/<span class="tabular-nums">(\d+)<\/span>/g)].map((m) => m[1]);
  assert.deepEqual(counts(vi), counts(en));
  assert.deepEqual(counts(en), ["2", "3", "2", "3"]);
});

test("Analytics: Vietnamese labels and link; the dashboard figures stay those of the English data", () => {
  const en = render(Analytics);
  assert.match(en, /aria-label="Capabilities"/);
  assert.match(en, link("/services/applied-ai/"));
  const vi = render(Analytics, "vi");
  const { MEASURE } = getContent("vi");
  assert.match(vi, /aria-label="Các năng lực"/);
  assert.match(vi, link("/vi/services/applied-ai/"));
  assert.ok(vi.includes(MEASURE.workflow.title) && vi.includes(MEASURE.readiness.title));
  const figures = (html) => [...html.matchAll(/(?:\+?\d+(?:\.\d+)?%|>94\.6<|>82<|>\d+%<)/g)].map((m) => m[0]);
  assert.deepEqual(figures(vi), figures(en));
  for (const figure of ["62%", "94.6", "+68%", ">82<", "99.1%"]) assert.ok(vi.includes(figure), figure);
});

test("Pricing: Vietnamese toggle, cells, badge, buttons and footer link", () => {
  const en = render(Pricing);
  for (const text of [">Deliverables<", ">Outcomes<", "Start here", ">Stage<", ">Engagement<", ">Focus<", "Select", 'aria-label="Discuss a project"', 'aria-label="Show outcomes instead of deliverables (Assess)"']) {
    assert.ok(en.includes(text), text);
  }
  const vi = render(Pricing, "vi");
  const { ENGAGEMENTS } = getContent("vi");
  for (const text of [">Bàn giao<", ">Kết quả<", "Bắt đầu từ đây", ">Giai đoạn<", ">Hình thức hợp tác<", ">Trọng tâm<", ">Sản phẩm bàn giao<", "Chọn", 'aria-label="Trao đổi về dự án"']) {
    assert.ok(vi.includes(text), text);
  }
  assert.ok(vi.includes(`aria-label="Hiện kết quả thay cho sản phẩm bàn giao (${ENGAGEMENTS[0].short})"`));
  assert.match(vi, link("/vi/contact/"));
  assert.doesNotMatch(vi, link("/contact/"));
  for (const text of ["Deliverables", "Outcomes", "Start here", ">Stage<", ">Focus<", ">Select", "Discuss a project", "Show outcomes"]) {
    assert.ok(!vi.includes(text), `no English "${text}" on the Vietnamese page`);
  }
});
