import { test } from "node:test";
import assert from "node:assert/strict";

const { formatPhone, telHref } = await import("../src/lib/phone.ts");
const { SITE, BRAND_NAME, siteFor } = await import("../src/lib/site.ts");
const { addressProblems } = await import("../scripts/lib/content-rules.mjs");

test("the owner's number reads nationally in Vietnamese and internationally in English", () => {
  assert.equal(formatPhone("+84386749799", "vi"), "0386 749 799");
  assert.equal(formatPhone("+84386749799", "en"), "+84 386 749 799");
  assert.equal(telHref("+84386749799"), "tel:+84386749799");
  assert.equal(formatPhone("+1 555", "en"), "+1 555", "an unexpected format is shown as written");
});

test("Site identity holds the owner's contact details (bilingual spec, decision 4) in both languages", () => {
  assert.equal(BRAND_NAME, "spacegear");
  assert.equal(SITE.telephone, "+84386749799");
  assert.deepEqual(siteFor("en").address, { full: "11 B4 Street, Sala Urban Area, An Khanh Ward, Ho Chi Minh City, Vietnam", street: "11 B4 Street, Sala Urban Area, An Khanh Ward", locality: "Ho Chi Minh City" });
  assert.deepEqual(siteFor("vi").address, { full: "Số 11, đường B4, Khu đô thị Sala, phường An Khánh, TP. Hồ Chí Minh, Việt Nam", street: "Số 11, đường B4, Khu đô thị Sala, phường An Khánh", locality: "Thành phố Hồ Chí Minh" });
  assert.equal(siteFor("vi").telephone, SITE.telephone);
  assert.equal(siteFor("vi").origin, SITE.origin);
  assert.notEqual(siteFor("vi").description, SITE.description);
});

test("the full address starts with the street line", () => {
  assert.deepEqual(addressProblems(siteFor("vi"), "content/vi/site.json"), []);
  assert.deepEqual(addressProblems({ address: { full: "Hồ Chí Minh", street: "Số 11", locality: "x" } }, "content/vi/site.json"), ["content/vi/site.json: address.full must begin with address.street (\"Số 11\"), the street line that the structured data and Google Business Profile use"]);
});
