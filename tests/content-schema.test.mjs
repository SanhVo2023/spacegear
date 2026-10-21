import { test } from "node:test";
import assert from "node:assert/strict";

const s = await import("../src/lib/content-schema.ts");

const run = (schema, value) => {
  const issues = [];
  const result = schema(value, "", issues);
  return { result, issues };
};

/** An object `levels` groups deep: 0 is `{}`, 1 is `{ a: {} }`, and so on. */
const nested = (levels) => {
  const root = {};
  let current = root;
  for (let level = 0; level < levels; level++) current = current.a = {};
  return root;
};

test("text enforces required, max length, surrounding spaces and patterns", () => {
  const field = s.text({ max: 5 });
  assert.deepEqual(run(field, "hello"), { result: "hello", issues: [] });
  assert.match(run(field, "").issues[0], /required/);
  assert.deepEqual(run(field, "   ").issues, ["(file): required"], "spaces alone do not fill a required field");
  assert.match(run(field, "toolong").issues[0], /7 characters, the limit is 5/);
  assert.match(run(field, " hi").issues[0], /spaces/);
  assert.match(run(field, 42).issues[0], /expected text/);
  assert.deepEqual(run(s.text({ min: 0, max: 5 }), "").issues, [], "optional text may be empty");
  assert.match(run(s.text({ min: 0, max: 5 }), "  ").issues[0], /spaces/, "optional text may not be spaces alone");
  assert.match(run(s.slug(), "Not A Slug").issues[0], /lowercase/);
});

test("text length counts characters (code points), not UTF-16 units", () => {
  assert.deepEqual(run(s.text({ max: 3 }), "😀😀😀").issues, [], "three emoji are three characters");
  assert.deepEqual(run(s.text({ max: 2 }), "😀😀😀").issues, ["(file): 3 characters, the limit is 2"]);
  assert.deepEqual(run(s.text({ min: 0, max: 0 }), "😀").issues, ["(file): 1 character, the limit is 0"]);
});

test("links accept site paths and https addresses only", () => {
  for (const ok of ["/", "/contact/", "/#faq", "/services/applied-ai/", "https://example.org/a?b=c"]) assert.deepEqual(run(s.href(), ok).issues, [], ok);
  for (const bad of ["contact", "http://example.org", "javascript:alert(1)", "/a b", "//evil.example"]) assert.equal(run(s.href(), bad).issues.length, 1, bad);
});

test("images must live under /images/ or /uploads/ with a lowercase name, and cannot be a generated variant or a Windows device name", () => {
  for (const ok of ["/images/suite/neural-net.webp", "/uploads/team-photo.webp", "/uploads/scan_2.jpeg", "/images/brand/logo.svg", "/uploads/team-photo-1280.webp", "/uploads/icon.webp", "/uploads/con-1.webp", "/uploads/console/a.png", "/uploads/com10.jpg"]) assert.deepEqual(run(s.image(), ok).issues, [], ok);
  for (const bad of ["/uploads/team-photo.jpg.w640.webp", "/uploads/team-photo.webp.w1280.webp", "https://cdn.example.com/a.jpg", "/models/earth.glb", "/uploads/Team-Photo.webp", "/uploads/photo.WEBP", "/uploads/.hidden.webp", "/uploads/con.webp", "/uploads/team/nul.png", "/images/aux.svg", "/uploads/com1.jpg", "/uploads/lpt9.gif", "/uploads/prn/a.webp", "/images/com0/a.webp"]) assert.equal(run(s.image(), bad).issues.length, 1, bad);
  assert.deepEqual(run(s.image(), "/uploads/photo.bmp").issues, [
    "(file): use a lowercase file name (letters, digits, - or _) ending in .webp, .png, .jpg, .jpeg, .avif or .gif under /images/ or /uploads/ (.svg only under /images/), not a Windows device name such as con or nul",
  ]);
});

test("SVG images are allowed under /images/ only, because an uploaded SVG is an active same-origin document", () => {
  assert.deepEqual(run(s.image(), "/images/x.svg").issues, []);
  assert.equal(run(s.image(), "/uploads/logo.svg").issues.length, 1);
  assert.equal(run(s.image(), "/uploads/brand/logo.svg").issues.length, 1);
});

test("values that could leave the site, run script or pollute objects are refused", () => {
  // mailto: is refused on purpose: the only contact address is SITE.contactEmail, which is env-gated.
  for (const bad of ["//evil.example/path", "data:text/html,<script>alert(1)</script>", "JAVASCRIPT:alert(1)", "mailto:x@y"]) assert.equal(run(s.href(), bad).issues.length, 1, bad);
  for (const bad of ["/uploads/../x.webp", "data:image/svg+xml,<svg onload=alert(1)>"]) assert.equal(run(s.image(), bad).issues.length, 1, bad);
  assert.match(run(s.number({ min: 0, max: 100 }), JSON.parse("1e999")).issues[0], /expected a number/, "Infinity is not a number");

  const { result, issues } = run(s.object({ first: s.text({ max: 9 }) }), JSON.parse('{"__proto__":{"x":1}}'));
  assert.match(issues[0], /^__proto__: unknown field/);
  assert.equal(Object.getPrototypeOf(result), Object.prototype, "the output keeps a plain prototype");
  assert.equal(result.x, undefined, "the output did not inherit the file's __proto__");
  assert.equal({}.x, undefined, "Object.prototype is untouched");
});

test("numbers, booleans, fixed flags and options", () => {
  assert.match(run(s.number({ min: 0, max: 100 }), 101).issues[0], /outside 0 to 100/);
  assert.match(run(s.number({ min: 1, max: 9, integer: true }), 1.5).issues[0], /whole number/);
  assert.match(run(s.number({ min: 0, max: 1 }), "1").issues[0], /expected a number/);
  assert.match(run(s.boolean(), "true").issues[0], /true or false/);
  assert.match(run(s.literal(true), false).issues[0], /must be true/);
  assert.deepEqual(run(s.oneOf(["a", "b"]), "c").issues, ['(file): "c" is not one of: a, b']);
  assert.deepEqual(run(s.oneOf(["a", "b"]), 3).issues, ["(file): 3 is not one of: a, b"]);
});

test("lists check their size and every item, with the item's position in the message", () => {
  const field = s.list(s.text({ max: 3 }), { min: 1, max: 2 });
  assert.match(run(field, []).issues[0], /needs at least 1 item$/);
  assert.match(run(field, ["a", "b", "c"]).issues[0], /3 items, the limit is 2/);
  assert.match(run(field, ["a", "toolong"]).issues[0], /^\[1\]: /);
  assert.deepEqual(run(s.list(s.text({ max: 3 }), { max: 0 }), ["a"]).issues, ["(file): 1 item, the limit is 0"]);
  assert.deepEqual(run(s.list(s.boolean(), { min: 2, max: 3 }), [true]).issues, ["(file): needs at least 2 items"]);
});

test("objects return keys in schema order, refuse unknown keys and report missing ones", () => {
  const field = s.object({ first: s.text({ max: 9 }), second: s.number({ min: 0, max: 9 }) });
  const { result, issues } = run(field, { second: 2, first: "one" });
  assert.deepEqual(issues, []);
  assert.deepEqual(Object.keys(result), ["first", "second"], "key order follows the schema, not the file");
  assert.match(run(field, { first: "one", second: 2, extra: true }).issues[0], /^extra: unknown field/);
  assert.match(run(field, { first: "one" }).issues[0], /^second: missing/);
});

test("an optional group is null when absent, null or left empty", () => {
  const field = s.object({ founder: s.nullable(s.object({ name: s.text({ max: 9 }), links: s.list(s.text({ max: 9 }), { max: 2 }) })) });
  for (const value of [{}, { founder: null }, { founder: { name: "", links: [] } }]) assert.deepEqual(run(field, value), { result: { founder: null }, issues: [] }, JSON.stringify(value));
  assert.deepEqual(run(field, { founder: { name: "Ada", links: [] } }).result, { founder: { name: "Ada", links: [] } });
});

test("false and 0 count as content, so a group with a boolean or number field is never 'not added'", () => {
  const field = s.object({ group: s.nullable(s.object({ name: s.text({ max: 9 }), on: s.boolean(), count: s.number({ min: 0, max: 9 }) })) });
  const { result, issues } = run(field, { group: { name: "", on: false, count: 0 } });
  assert.deepEqual(result, { group: { name: "", on: false, count: 0 } });
  assert.deepEqual(issues, ["group.name: required"]);
});

test("absurdly deep nesting in an optional group is a ContentError, not a stack overflow", () => {
  const field = s.object({ group: s.nullable(s.object({ a: s.text({ min: 0, max: 1 }) })) });
  assert.deepEqual(run(field, { group: nested(64) }), { result: { group: null }, issues: [] }, "64 empty levels still count as empty");
  for (const levels of [65, 20000]) {
    assert.throws(() => s.parseContent(field, { group: nested(levels) }, "content/x.json"), (error) => {
      assert.ok(error instanceof s.ContentError, `${levels} levels: ${error.name}: ${error.message}`);
      assert.deepEqual(error.issues, ["content/x.json: group: nested more than 64 levels deep"]);
      return true;
    });
  }
  const issues = ["content/a.json: title: required"];
  assert.throws(() => s.check(field, { group: nested(65) }, "content/b.json", issues), (error) => {
    assert.deepEqual(error.issues, ["content/a.json: title: required", "content/b.json: group: nested more than 64 levels deep"], "earlier problems are kept");
    return true;
  });
});

test("parseContent names the file and lists every problem at once", () => {
  const field = s.object({ a: s.text({ max: 1 }), b: s.text({ max: 1 }) });
  assert.throws(() => s.parseContent(field, { a: "", b: "xx" }, "content/x.json"), (error) => {
    assert.ok(error instanceof s.ContentError);
    assert.deepEqual(error.issues, ["content/x.json: a: required", "content/x.json: b: 2 characters, the limit is 1"]);
    return true;
  });
});

test("every schema exposes its rules as meta for the CMS mirror test", () => {
  assert.deepEqual(s.text({ min: 0, max: 4 }).meta, { kind: "text", format: "plain", min: 0, max: 4, pattern: undefined });
  assert.equal(s.list(s.boolean(), { max: 3 }).meta.item.meta.kind, "boolean");
  assert.deepEqual(Object.keys(s.object({ x: s.boolean() }).meta.shape), ["x"]);
});
