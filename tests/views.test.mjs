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

const { organizationData, websiteData, webPageData } = await import("../src/lib/seo.ts");

test("every page names both language versions, x-default being English, and its og:locale", () => {
  for (const [locale, own, other] of [["en", "en_US", "vi_VN"], ["vi", "vi_VN", "en_US"]]) {
    const m = meta.aboutMetadata(locale);
    assert.deepEqual(m.alternates.languages, { en: "https://spacegear.tech/about/", vi: "https://spacegear.tech/vi/about/", "x-default": "https://spacegear.tech/about/" });
    assert.equal(m.openGraph.locale, own);
    assert.deepEqual(m.openGraph.alternateLocale, [other]);
  }
  assert.equal(meta.homeMetadata("vi").alternates.languages.vi, "https://spacegear.tech/vi/");
});

test("the Organization is spacegear (alternate name spacegear.tech) with the owner's address and phone; the WebSite names its language", () => {
  const vi = organizationData("vi");
  assert.equal(vi.name, "spacegear");
  assert.equal(vi.alternateName, "spacegear.tech");
  assert.equal(vi.telephone, "+84386749799");
  assert.deepEqual(vi.address, { "@type": "PostalAddress", streetAddress: "Số 11, đường B4, Khu đô thị Sala, phường An Khánh", addressLocality: "Thành phố Hồ Chí Minh", addressCountry: "VN" });
  assert.deepEqual(organizationData("en").address, { "@type": "PostalAddress", streetAddress: "11 B4 Street, Sala Urban Area, An Khanh Ward", addressLocality: "Ho Chi Minh City", addressCountry: "VN" });
  assert.equal(organizationData("en")["@id"], organizationData("vi")["@id"], "one organization");
  assert.deepEqual([websiteData("en").inLanguage, websiteData("vi").inLanguage], ["en", "vi"]);
  assert.equal(websiteData("vi")["@id"], "https://spacegear.tech/vi/#website");
  assert.equal(websiteData("en")["@id"], "https://spacegear.tech/#website");
});

test("each page's WebPage node names its title, canonical and language, inside its language's WebSite", () => {
  const vi = webPageData(meta.aboutMetadata("vi"), "vi");
  assert.deepEqual(vi, {
    "@context": "https://schema.org", "@type": "WebPage", "@id": "https://spacegear.tech/vi/about/#webpage", url: "https://spacegear.tech/vi/about/",
    name: "Giới thiệu | spacegear.tech", description: meta.aboutMetadata("vi").description, inLanguage: "vi",
    isPartOf: { "@id": "https://spacegear.tech/vi/#website" }, publisher: { "@id": "https://spacegear.tech/#organization" },
  });
  const home = webPageData(meta.homeMetadata("en"), "en");
  assert.equal(home.url, "https://spacegear.tech/");
  assert.equal(home.isPartOf["@id"], websiteData("en")["@id"]);
  for (const view of ["HomeView", "AboutView", "ApproachView", "ContactView", "PrivacyView", "TermsView", "ServicesView", "ServiceView"])
    assert.match(fs.readFileSync(`src/views/${view}.tsx`, "utf8"), /webPageData\(/, `${view} renders its WebPage node`);
});

test("the 404 leaves robots to Next's own noindex (one robots tag), and names no language versions", () => {
  const notFound = meta.notFoundMetadata();
  assert.equal(notFound.robots, null);
  assert.equal(notFound.alternates, undefined);
});
