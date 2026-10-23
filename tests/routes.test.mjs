import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const { getPublishedRoutes } = await import("../src/lib/site.ts");

test("every page exists in both languages under the same slug, and names both versions", () => {
  const routes = getPublishedRoutes();
  assert.equal(routes.length, 24);
  const en = routes.filter((route) => route.locale === "en");
  const vi = routes.filter((route) => route.locale === "vi");
  assert.deepEqual(vi.map((route) => route.path), en.map((route) => (route.path === "/" ? "/vi/" : `/vi${route.path}`)));
  for (const [index, route] of en.entries()) {
    assert.deepEqual(route.alternates, { en: route.path, vi: vi[index].path });
    assert.deepEqual(vi[index].alternates, route.alternates);
  }
});

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name).replaceAll("\\", "/")]));

test("each language has its own root layout and <html lang>; every English page has its Vietnamese twin", () => {
  assert.ok(!fs.existsSync("src/app/layout.tsx"), "no top-level root layout");
  assert.match(fs.readFileSync("src/app/(en)/layout.tsx", "utf8"), /<SiteShell locale="en">/);
  assert.match(fs.readFileSync("src/app/(vi)/layout.tsx", "utf8"), /<SiteShell locale="vi">/);
  const english = walk("src/app/(en)").filter((file) => file.endsWith("/page.tsx")).map((file) => file.replace("src/app/(en)/", ""));
  assert.equal(english.length, 8);
  for (const page of english) {
    const twin = `src/app/(vi)/vi/${page}`;
    assert.ok(fs.existsSync(twin), twin);
    assert.equal(fs.readFileSync(twin, "utf8"), fs.readFileSync(`src/app/(en)/${page}`, "utf8").replaceAll('"en"', '"vi"'), `${twin} is the English wrapper with "vi"`);
  }
  assert.match(fs.readFileSync("next.config.ts", "utf8"), /globalNotFound: true/);
  assert.match(fs.readFileSync("src/app/global-not-found.tsx", "utf8"), /<SiteShell locale="en" notFound>/);
});
