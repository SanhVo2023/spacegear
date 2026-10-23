import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// next.config's `trailingSlash: true`, which `next build` inlines for next/link (outside a build, links lose their slash).
process.env.__NEXT_TRAILING_SLASH = "true";

const { CtaBand, FlameButton } = await import("../src/components/ui.tsx");
const { default: PageIntro } = await import("../src/components/PageIntro.tsx");
const h = React.createElement;

test("CtaBand and FlameButton: English as before; with a locale, the default label and the link follow it", () => {
  const en = renderToStaticMarkup(h(CtaBand, { title: "T", text: "X" }));
  assert.match(en, /href="\/contact\/"/);
  assert.match(en, />Discuss a project</);
  const vi = renderToStaticMarkup(h(CtaBand, { title: "T", text: "X", locale: "vi" }));
  assert.match(vi, /href="\/vi\/contact\/"/);
  assert.match(vi, />Trao đổi về dự án</);
  assert.match(renderToStaticMarkup(h(FlameButton, { href: "/vi/about/" }, "x")), /href="\/vi\/about\/"/, "without a locale the href is used as given");
});

test("PageIntro's back link defaults to the page language's home", () => {
  assert.match(renderToStaticMarkup(h(PageIntro, { eyebrow: "E", title: "T", description: "D" })), /href="\/"[^>]*>← (?:<!-- -->)?Home/);
  assert.match(renderToStaticMarkup(h(PageIntro, { eyebrow: "E", title: "T", description: "D", locale: "vi" })), /href="\/vi\/"[^>]*>← (?:<!-- -->)?Trang chủ/);
});

const { default: ContactDetails } = await import("../src/components/ContactDetails.tsx");

test("the contact details show the owner's address and phone in the page's language, the phone as a tel: link", () => {
  const en = renderToStaticMarkup(h(ContactDetails, {}));
  assert.match(en, /11 B4 Street, Sala Urban Area, An Khanh Ward, Ho Chi Minh City, Vietnam/);
  assert.match(en, /href="tel:\+84386749799"[^>]*>\+84 386 749 799</);
  assert.match(en, /class="sr-only">Address: </, "labels are for screen readers unless asked for");
  const vi = renderToStaticMarkup(h(ContactDetails, { locale: "vi", labels: true }));
  assert.match(vi, /Số 11, đường B4, Khu đô thị Sala, phường An Khánh, TP\. Hồ Chí Minh, Việt Nam/);
  assert.match(vi, /href="tel:\+84386749799"[^>]*>0386 749 799</);
  assert.match(vi, /class="text-mut">Địa chỉ: </);
});
