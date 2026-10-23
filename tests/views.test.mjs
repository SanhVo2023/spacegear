import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const meta = await import("../src/views/metadata.ts");

test("each page gives English the metadata it had, and Vietnamese its own canonical and title", () => {
  const en = meta.aboutMetadata("en");
  assert.equal(en.title.absolute, "About | spacegear.tech");
  assert.equal(en.alternates.canonical, "https://spacegear.tech/about/");
  const vi = meta.aboutMetadata("vi");
  assert.equal(vi.title.absolute, "Giới thiệu | spacegear.tech");
  assert.equal(vi.alternates.canonical, "https://spacegear.tech/vi/about/");
  assert.equal(meta.homeMetadata("en").title.absolute, "spacegear.tech | Digital Transformation & AI Consulting");
  assert.equal(meta.homeMetadata("vi").title.absolute, "spacegear.tech | Tư vấn chuyển đổi số & AI");
  assert.equal(meta.contactMetadata("en").title.absolute, "Discuss a Project | spacegear.tech");
  assert.equal(meta.serviceMetadata("vi", "applied-ai").alternates.canonical, "https://spacegear.tech/vi/services/applied-ai/");
  assert.deepEqual(meta.serviceStaticParams("vi").map((p) => p.slug), meta.serviceStaticParams("en").map((p) => p.slug));
  assert.equal(meta.notFoundMetadata().title.absolute, "Page not found · Không tìm thấy trang | spacegear.tech");
});

test("every route file is a thin wrapper around its view (the Vietnamese twins: tests/routes.test.mjs)", () => {
  for (const [file, view] of [["src/app/(en)/page.tsx", "HomeView"], ["src/app/(en)/about/page.tsx", "AboutView"], ["src/app/(en)/approach/page.tsx", "ApproachView"], ["src/app/(en)/contact/page.tsx", "ContactView"], ["src/app/(en)/privacy/page.tsx", "PrivacyView"], ["src/app/(en)/terms/page.tsx", "TermsView"], ["src/app/(en)/services/page.tsx", "ServicesView"], ["src/app/(en)/services/[slug]/page.tsx", "ServiceView"]]) {
    const source = fs.readFileSync(file, "utf8");
    assert.match(source, new RegExp(`from "@/views/${view}"`), file);
    assert.match(source, /from "@\/views\/metadata"/, file);
    assert.match(source, /locale="en"/, file);
    assert.ok(source.split("\n").length <= 12, `${file} stays a wrapper`);
  }
});
