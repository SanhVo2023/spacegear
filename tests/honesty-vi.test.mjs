import { test } from "node:test";
import assert from "node:assert/strict";
import { findForbidden, scanContentTree, scanFile } from "../scripts/lib/honesty.mjs";

const FAQ = "content/vi/faqs/x.json";
const refused = (text, where = FAQ) => findForbidden(text, where);

// One planted claim per family of the spec ("Honesty scan in Vietnamese"), each with the problem it must raise.
const PLANTS = {
  "a price": ["Gói dịch vụ chỉ 5.000.000 đồng.", "Chỉ 200.000đ mỗi giờ.", "Giá từ 15 triệu.", "Phí 2 tỷ cho cả dự án.", "10 triệu/tháng", "500 nghìn một tháng", "Chi phí chỉ từ 9 triệu", "Chỉ 50 VNĐ"],
  "a client or scale claim": ["Hơn 100 khách hàng tin dùng.", "Đã hoàn thành 250 dự án.", "50+ doanh nghiệp", "Đội ngũ 30 chuyên gia.", "hàng trăm doanh nghiệp", "hơn năm mươi khách hàng", "12 nhân sự", "3 đồng sáng lập", "5 đồng nghiệp", "Đội ngũ 8 thành viên"],
  "an experience claim": ["10 năm kinh nghiệm", "mười năm kinh nghiệm", "Thành lập năm 2015.", "Từ năm 2012, chúng tôi đồng hành cùng bạn.", "hàng thập kỷ", "5 năm hoạt động"],
  "an unverified partnership claim": ["Đối tác chính thức của Google.", "đối tác vàng", "là đối tác của Microsoft"],
  "an unverified rating or award": ["Đạt giải thưởng Sao Khuê.", "Top 10 công ty AI", "đơn vị số 1", "hàng đầu Việt Nam", "được đánh giá 4.9", "5 sao"],
  "an unverified certification": ["Chứng nhận ISO 27001.", "Chúng tôi được chứng nhận."],
  "an unverified press claim": ["Được báo chí đưa tin.", "xuất hiện trên VnExpress"],
  "an office location": ["Văn phòng tại Hà Nội.", "chi nhánh ở Đà Nẵng", "3 văn phòng", "Trụ sở chính tại TP. Hồ Chí Minh", "Chúng tôi có văn phòng riêng."],
  "a delivery timeline": ["Bàn giao trong 14 ngày.", "Triển khai chỉ trong hai tuần.", "trong vòng 30 ngày", "4-6 tuần", "dưới 3 tháng"],
  "a result figure": ["Tăng 30% doanh thu.", "giảm chi phí đến 45%", "gấp 3 lần", "nhanh hơn 5 lần", "10 lần nhanh hơn"],
};
const NEUTRAL = [
  "hợp đồng", "đồng ý", "đồng thời", "đồng hành cùng bạn", "Vui lòng nhập từ 2 đến 100 ký tự.", "Vui lòng nhập không quá 200 ký tự.",
  "Vui lòng nhập từ 20 đến 3.000 ký tự.", "Năm năng lực — hoạch định, xây dựng, kết nối và cải tiến", "một dự án hợp tác", "các dự án",
  "mỗi dự án", "Bước 1", "Vai trò 1 trên 5", "© 2026 spacegear.tech", "không hàm ý quan hệ đối tác", "Chúng tôi chọn công cụ của đối tác phù hợp.",
  "tiêu chí nghiệm thu", "trong từng giai đoạn", "trong năm nay", "82 Mức độ sẵn sàng", "62 Xử lý tự động", "12 phút → 2 phút",
  "Đây là ví dụ minh họa", "triển khai AI vào quy trình", "tăng tốc quy trình", "giảm thao tác thủ công",
  "đồng sáng lập", "các đồng nghiệp của bạn", "thành viên trong nhóm",
  // English copy the Vietnamese rules must not catch.
  "Top 10 risks", "Step 1", "Phase 2 of 3", "24/7 support", "Our #1 rule", "Plan for 2027", "under 16", "Version 2.0",
];

test("every Vietnamese claim family is refused, with its own problem", () => {
  for (const [what, texts] of Object.entries(PLANTS)) {
    for (const text of texts) assert.ok(refused(text).some((problem) => problem.startsWith(what)), `${text} → ${what} (got ${JSON.stringify(refused(text))})`);
  }
});

test("a count of co-founders or colleagues is a scale claim, not a price in đồng", () => {
  for (const text of ["3 đồng sáng lập", "5 đồng nghiệp", "Chúng tôi có 2 đồng  sáng lập."]) {
    const problems = refused(text);
    assert.ok(problems.some((problem) => problem.startsWith("a client or scale claim")), `${text} (got ${JSON.stringify(problems)})`);
    assert.ok(!problems.some((problem) => problem.startsWith("a price")), `${text} is not a price (got ${JSON.stringify(problems)})`);
  }
});

test("ordinary Vietnamese and English copy passes", () => {
  for (const text of NEUTRAL) assert.deepEqual(refused(text), [], text);
});

test("a Vietnamese date (the glossary's format) is not a period of experience", () => {
  for (const text of ["Cập nhật ngày 23 tháng 10 năm 2026.", "tháng 10 năm 2026", "Tháng 1 năm 2025, chúng tôi viết bài này.", "ngày 1 tháng 12 năm 2026", "tháng 09 năm 2026", "23/10/2026", "Bài viết ngày 5  tháng 3  năm 2026 kể lại cách làm."]) {
    assert.deepEqual(refused(text), [], text);
  }
  // Only a real month before a four-digit year makes a date; claims around a date are still refused.
  for (const text of ["10 năm hoạt động", "hơn 10 năm", "Hơn 10 năm đồng hành cùng doanh nghiệp.", "tháng 13 năm 2026", "tháng 10 năm hoạt động", "10 năm 2026", "Tháng 10 năm 2026 đánh dấu 10 năm hoạt động.", "15 năm"]) {
    assert.ok(refused(text).some((problem) => problem.startsWith("an experience claim")), `${text} (got ${JSON.stringify(refused(text))})`);
  }
  assert.ok(refused("tháng 10 năm 2026, 10 năm kinh nghiệm").some((problem) => problem.startsWith("an experience claim")));
});

test("the legal pages may state periods in Vietnamese too, but never a delivery promise", () => {
  assert.deepEqual(refused("Các yêu cầu đã đóng được lưu giữ tối đa 90 ngày.", "content/vi/legal/privacy.md"), []);
  assert.deepEqual(refused("Website này không hàm ý quan hệ đối tác.", "content/vi/legal/terms.md"), []);
  assert.ok(refused("Bàn giao trong 14 ngày.", "content/vi/legal/terms.md").some((problem) => problem.startsWith("a delivery timeline")));
  assert.ok(refused("Các yêu cầu được lưu giữ tối đa 90 ngày.").some((problem) => problem.startsWith("a delivery timeline")), "outside the legal pages a period is refused");
});

test("the owner's contact details may appear only in Site identity", () => {
  const site = JSON.stringify({ name: "spacegear.tech", description: "x", socialProfiles: [], address: { full: "11 B4 Street, Sala Urban Area, An Khanh Ward, Ho Chi Minh City, Vietnam", street: "11 B4 Street, Sala Urban Area, An Khanh Ward", locality: "Ho Chi Minh City" }, telephone: "+84386749799" });
  assert.deepEqual(scanFile("content/site.json", site), []);
  const viSite = JSON.stringify({ name: "spacegear.tech", description: "x", socialProfiles: [], address: { full: "Số 11, đường B4, Khu đô thị Sala, phường An Khánh, TP. Hồ Chí Minh, Việt Nam", street: "Số 11, đường B4, Khu đô thị Sala, phường An Khánh", locality: "Thành phố Hồ Chí Minh" }, telephone: "+84386749799" });
  assert.deepEqual(scanFile("content/vi/site.json", viSite), []);
  for (const text of ["Gọi 0386 749 799 để được tư vấn.", "Call +84 386 749 799", "Visit us at 11 B4 Street", "Ghé thăm chúng tôi tại đường B4, Khu đô thị Sala."]) {
    assert.ok(refused(text).some((problem) => problem.startsWith("the owner's contact details")), text);
  }
  assert.ok(scanFile("content/site.json", JSON.stringify({ description: "Call 0386 749 799" })).some((problem) => problem.startsWith("description: the owner's contact details")), "Site identity's other fields may not hold them either");
});

test("the Vietnamese patterns stay linear on long pathological input", () => {
  const n = 200_000;
  const inputs = ["1 ".repeat(n / 2), "năm ".repeat(n / 4), `${"1".repeat(n)}x`, "giá ".repeat(n / 4), `${"tăng ".repeat(n / 5)}5%`, `bàn giao ${"a ".repeat(n / 2)}`, "đối tác ".repeat(n / 8), "1 đồng ".repeat(n / 7), "tháng 1 năm ".repeat(n / 12)];
  const start = performance.now();
  for (const text of inputs) refused(text);
  assert.ok(performance.now() - start < 3000);
});

test("the committed content still passes", () => {
  assert.deepEqual(scanContentTree("."), []);
});
