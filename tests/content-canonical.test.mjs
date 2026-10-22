// Every content file is kept in the form Sveltia CMS writes (tests/helpers/canonical.mjs), so a CMS
// save changes only the lines an editor changed, never the key order or the layout.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { COLLECTIONS, listEntries } from "../scripts/build-content-index.mjs";
import { canonicalJson } from "./helpers/canonical.mjs";

const { contentSchemas, SINGLETON_FILES } = await import("../src/lib/content-model.ts");
const { SERVICES } = await import("../src/lib/content.ts");
const schemas = contentSchemas(SERVICES.map((service) => service.slug));
const text = (file) => fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");

test("folder-collection entries are in the CMS's form: order first, then the fields in order", () => {
  for (const collection of COLLECTIONS) {
    for (const name of listEntries(".", collection)) {
      const file = `content/${collection}/${name}`;
      assert.equal(text(file), canonicalJson(schemas.collections[collection], JSON.parse(text(file)), { orderFirst: true }), file);
      assert.match(text(file), /^\{\n {2}"order": \d+,\n/, `${file}: order is the first key`);
    }
  }
  // Editors add and delete questions, disciplines, testimonials and articles; services and
  // engagements are fixed (the CMS cannot create or delete them).
  assert.equal(listEntries(".", "services").length, 5, "5 services");
  assert.equal(listEntries(".", "engagements").length, 3, "3 engagements");
});

test("singletons are in the CMS's form: the fields in order", () => {
  const files = [["content/site.json", schemas.site], ...Object.entries(SINGLETON_FILES).map(([name, file]) => [file, schemas.singletons[name]])];
  for (const [file, schema] of files) assert.equal(text(file), canonicalJson(schema, JSON.parse(text(file))), file);
});

test("the canonical form moves keys, never values", () => {
  const schema = schemas.collections.faqs;
  const scrambled = { answer: "A.", order: 4, question: "Q?" };
  assert.equal(canonicalJson(schema, scrambled, { orderFirst: true }), '{\n  "order": 4,\n  "question": "Q?",\n  "answer": "A."\n}\n');
  assert.deepEqual(JSON.parse(canonicalJson(schemas.singletons.measure, JSON.parse(text("content/measure.json")))), JSON.parse(text("content/measure.json")));
});
