import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// The public content API keeps the names it had before the CMS (tests/fixtures/content-v1.json,
// "exports"), and src/lib/content-contract.ts pins their types at compile time. The values are the
// editors' to change: scripts/check-migration.mjs compares them with the pre-CMS copy, outside npm
// test. The routes stay here, because no CMS edit can change them (service files are named after
// their slugs, and services cannot be added or removed in the CMS).
const fixture = JSON.parse(fs.readFileSync("tests/fixtures/content-v1.json", "utf8"));
const content = await import("../src/lib/content.ts");
const { getPublishedRoutes } = await import("../src/lib/site.ts");

test("content.ts exports exactly the names it exported before the CMS", () => {
  assert.deepEqual(Object.keys(content).sort(), fixture.exports);
});

test("serviceBySlug returns each service and rejects unknown slugs", () => {
  assert.ok(content.SERVICES.length > 0);
  for (const service of content.SERVICES) assert.equal(content.serviceBySlug(service.slug), service);
  assert.throws(() => content.serviceBySlug("no-such-service"), /Unknown service: no-such-service/);
});

test("the published routes are unchanged", () => {
  assert.deepEqual(getPublishedRoutes(), fixture.site.routes);
});
