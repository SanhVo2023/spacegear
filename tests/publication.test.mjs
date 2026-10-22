import { test } from "node:test";
import assert from "node:assert/strict";

const subject = await import("../src/lib/publication.ts").catch(() => ({}));
test("production publication rejects an unconfirmed origin and missing contact/policy facts", () => {
  assert.equal(typeof subject.validatePublication, "function", "publication validation must exist");
  const errors = subject.validatePublication({ mode: "production", origin: "https://example.com", contactEmail: "", policiesApproved: false }, []);
  assert.ok(errors.some((error) => error.includes("origin")));
  assert.ok(errors.some((error) => error.includes("contact")));
  assert.ok(errors.some((error) => error.includes("policies")));
});
test("preview accepts unset company facts but refuses duplicate routes", () => {
  assert.equal(typeof subject.validatePublication, "function");
  assert.deepEqual(subject.validatePublication({ mode: "preview", origin: "http://localhost:8787" }, ["/", "/services/"]), []);
  assert.ok(subject.validatePublication({ mode: "preview", origin: "http://localhost:8787" }, ["/", "/"]).some((error) => error.includes("duplicate")));
});
test("production only accepts a clean HTTPS origin and a real contact address", () => {
  assert.equal(typeof subject.validatePublication, "function");
  const good = { mode: "production", origin: "https://consulting.test-company.org", contactEmail: "hello@test-company.org", policiesApproved: true };
  assert.deepEqual(subject.validatePublication(good, ["/", "/contact/"]), []);
  for (const origin of ["http://consulting.test-company.org", "https://localhost", "https://spacegear.example", "https://consulting.test-company.org/path", "https://user:pass@test-company.org", "https://platform-clone-gilt.vercel.app"]) {
    assert.ok(subject.validatePublication({ ...good, origin }, ["/"]).length > 0, origin);
  }
});
