import { test } from "node:test";
import assert from "node:assert/strict";
import { findForbidden, scanContentTree, scanFile } from "../scripts/lib/honesty.mjs";

const FAQ = "content/faqs/x.json";

test("content/vi/measure.json may show the dashboard figures, in its figure fields only", () => {
  assert.deepEqual(scanFile("content/vi/measure.json", JSON.stringify({ workflow: { center: "62%" }, accuracy: { value: "94.6", unit: "%" }, coverage: { value: "99.1%" } })), []);
  assert.ok(scanFile("content/vi/measure.json", JSON.stringify({ ticker: ["Tăng 62%"] })).some((problem) => problem.startsWith("ticker[0]: a result figure")));
  assert.ok(scanFile("content/vi/faqs/x.json", JSON.stringify({ answer: "Tỷ lệ 62%" })).some((problem) => problem.startsWith("answer: a result figure")));
});

test("content/vi/legal/ may state periods, exactly as content/legal/ may", () => {
  const period = "## Retention\n\nRecords are kept for 2 years.";
  assert.deepEqual(scanFile("content/vi/legal/privacy.md", period), []);
  assert.ok(scanFile("content/vi/faqs/x.md", period).some((problem) => problem.startsWith("an experience claim")));
});

test("a letter after a number is read in any script: ký tự, Mức and Xử are words, not k, M or x", () => {
  for (const text of ["Vui lòng nhập từ 2 đến 100 ký tự.", "Vui lòng nhập không quá 200 ký tự.", "Vui lòng nhập từ 20 đến 3.000 ký tự.", "82 Mức độ sẵn sàng", "62 Xử lý tự động"]) {
    assert.deepEqual(findForbidden(text, FAQ), [], text);
  }
  for (const [text, what] of [["5M users", "a price or scale figure"], ["Over 10k installs", "a price or scale figure"], ["10 k downloads", "a price or scale figure"], ["3x faster delivery", "a multiplier claim"], ["2.5× the output", "a multiplier claim"]]) {
    assert.ok(findForbidden(text, FAQ).some((problem) => problem.startsWith(what)), text);
  }
});

test("đồng is a price only after a number", () => {
  for (const text of ["Hai bên ký hợp đồng.", "Bạn đồng ý với điều khoản.", "đồng thời", "đồng hành cùng đội ngũ của bạn"]) {
    assert.deepEqual(findForbidden(text, FAQ), [], text);
  }
  for (const text of ["Gói chỉ 5.000.000 đồng.", "200.000đ một giờ", "Chỉ 50 VNĐ", "₫20,000,000"]) {
    assert.ok(findForbidden(text, FAQ).some((problem) => problem.startsWith("a price")), text);
  }
});

test("the committed content passes in both languages", () => {
  assert.deepEqual(scanContentTree("."), []);
});
