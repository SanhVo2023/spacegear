import { test } from "node:test";
import assert from "node:assert/strict";

const s = await import("../src/lib/content-schema.ts");

const run = (schema, value) => {
  const issues = [];
  const result = schema(value, "", issues);
  return { result, issues };
};

test("text enforces required, max length, surrounding spaces and patterns", () => {
  const field = s.text({ max: 5 });
  assert.deepEqual(run(field, "hello"), { result: "hello", issues: [] });
  assert.match(run(field, "").issues[0], /required/);
  assert.match(run(field, "toolong").issues[0], /7 characters, the limit is 5/);
  assert.match(run(field, " hi").issues[0], /spaces/);
  assert.match(run(field, 42).issues[0], /expected text/);
  assert.deepEqual(run(s.text({ min: 0, max: 5 }), "").issues, [], "optional text may be empty");
  assert.match(run(s.slug(), "Not A Slug").issues[0], /lowercase/);
});

test("links accept site paths and https addresses only", () => {
  for (const ok of ["/", "/contact/", "/#faq", "/services/applied-ai/", "https://example.org/a?b=c"]) assert.deepEqual(run(s.href(), ok).issues, [], ok);
  for (const bad of ["contact", "http://example.org", "javascript:alert(1)", "/a b"]) assert.equal(run(s.href(), bad).issues.length, 1, bad);
});

test("images must live under /images/ or /uploads/ and cannot be a generated variant", () => {
  for (const ok of ["/images/suite/neural-net.webp", "/uploads/team-photo.webp", "/uploads/logo.svg"]) assert.deepEqual(run(s.image(), ok).issues, [], ok);
  for (const bad of ["/uploads/team-photo-640.webp", "/uploads/team-photo-1280.webp", "https://cdn.example.com/a.jpg", "/models/earth.glb"]) assert.equal(run(s.image(), bad).issues.length, 1, bad);
});

test("numbers, booleans, fixed flags and options", () => {
  assert.match(run(s.number({ min: 0, max: 100 }), 101).issues[0], /outside 0 to 100/);
  assert.match(run(s.number({ min: 1, max: 9, integer: true }), 1.5).issues[0], /whole number/);
  assert.match(run(s.number({ min: 0, max: 1 }), "1").issues[0], /expected a number/);
  assert.match(run(s.boolean(), "true").issues[0], /true or false/);
  assert.match(run(s.literal(true), false).issues[0], /must be true/);
  assert.match(run(s.oneOf(["a", "b"]), "c").issues[0], /choose one of a, b/);
});

test("lists check their size and every item, with the item's position in the message", () => {
  const field = s.list(s.text({ max: 3 }), { min: 1, max: 2 });
  assert.match(run(field, []).issues[0], /at least 1 item/);
  assert.match(run(field, ["a", "b", "c"]).issues[0], /3 items, the limit is 2/);
  assert.match(run(field, ["a", "toolong"]).issues[0], /^\[1\]: /);
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
