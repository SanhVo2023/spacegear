import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// Frozen snapshot of src/lib/content.ts and src/lib/site.ts taken before the CMS migration.
// Never regenerate it from the new loader; change it only together with a deliberate copy change.
const fixture = JSON.parse(fs.readFileSync("tests/fixtures/content-v1.json", "utf8"));
const content = await import("../src/lib/content.ts");
const { SITE, getPublishedRoutes } = await import("../src/lib/site.ts");

test("content.ts exports exactly the names it exported before the CMS", () => {
  assert.deepEqual(Object.keys(content).sort(), fixture.exports);
});

for (const name of Object.keys(fixture.values)) {
  test(`${name} is unchanged, key order included`, () => {
    assert.equal(JSON.stringify(content[name]), JSON.stringify(fixture.values[name]));
  });
}

test("serviceBySlug returns each service and rejects unknown slugs", () => {
  for (const service of fixture.values.SERVICES) assert.equal(JSON.stringify(content.serviceBySlug(service.slug)), JSON.stringify(service));
  assert.throws(() => content.serviceBySlug("no-such-service"), /Unknown service: no-such-service/);
});

test("the site identity and the published routes are unchanged", () => {
  assert.deepEqual({ name: SITE.name, description: SITE.description, socialProfiles: SITE.socialProfiles, routes: getPublishedRoutes() }, fixture.site);
});
