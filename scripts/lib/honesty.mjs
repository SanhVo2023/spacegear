// Claims public copy must never make: invented prices, the original site's metrics, press or
// partnerships, clients and scale, results, offices, experience, ratings, awards and
// certifications, delivery timelines, and the old identity. Shared by tests/content.test.mjs and
// scripts/check-content.mjs, which run it on each loaded export and on every file under content/
// (JSON and Markdown alike), so a CMS edit cannot slip one in, even in a field the site does not
// render.
//
// What is scanned:
//   - A Markdown file as written. A JSON file as its decoded string values, one field at a time,
//     so neither an escaped "$" (JSON's backslash, "u", then the four hex digits 0024) nor an
//     escaped line break (\n, \t) hides a claim. Object keys are not scanned: every content
//     schema has fixed field names and refuses unknown ones.
//   - Groups as they read on the page: for every object with a value, unit, label or score, or with
//     a title and a sub or text, "<value><unit> <score> <title> <label> <scoreLabel> <sub> <text>
//     <note> <tag>", so a figure or a phrase split over fields ({ value: "98", unit: "%", label:
//     "Client satisfaction" }, { title: "Trusted by 200", sub: "companies" }) is still one claim.
//   - Text is folded first: NFKC (a fullwidth ＄４９９ becomes $499), then every format character
//     (\p{Cf}: zero-width, bidi, soft hyphen) and the combining grapheme joiner are removed.
// Scopes (`where` is a content file or an export name, `field` the path inside it):
//   - the sample dashboard (content/measure.json and content/vi/measure.json, MEASURE) may show
//     percentages and k/M figures, in its figure fields only (FIGURE_FIELD); its ticker, labels and
//     calls to action may not;
//   - the legal pages (content/legal/ and content/vi/legal/) may state periods ("for 2 years",
//     "within 90 days", "tối đa 90 ngày") and name their processors (AWS); founding years, decades,
//     delivery promises and partner tiers stay refused;
//   - the owner's contact details (phone, street address) only in Site identity's `address` and
//     `telephone` fields (content/site.json, content/vi/site.json).
// Vietnamese copy has its own patterns for every family above (prices in đồng, triệu or tỷ, counts of
// khách hàng, dự án or đồng sáng lập, năm kinh nghiệm, đối tác, giải thưởng, văn phòng, bàn giao
// trong N ngày, tăng N%), bounded by Unicode word edges.
// Every pattern is linear: no unbounded quantifier can restart inside a run it already scanned
// (tests/content.test.mjs times them on long pathological input).
// Known gaps: look-alike letters (Cyrillic "Ѕ") and non-ASCII digits (Arabic-Indic "٤٩٩"), HTML
// entities such as &#36; (React prints them as text), and a literal backslash-u sequence written as text.
import fs from "node:fs";
import path from "node:path";

// content/vi/ mirrors content/ file for file, so a Vietnamese file has the scopes of its English twin.
const englishTwin = (where) => where.replace(/^content\/vi\//, "content/");
const LEGAL = (where) => englishTwin(where).startsWith("content/legal/");
// The figure fields of the illustrative dashboard (content/measure.json and its Vietnamese twin), and the figure groups built from them.
const FIGURE_FIELD = /^(?:workflow\.center|workflow\.segments\[\d+\](?:\.value)?|stages\[\d+\]\.detail|accuracy(?:\.value|\.unit)?|throughput\.legend\[\d+\](?:\.value)?|readiness(?:\.score|\.bars\[\d+\](?:\.v)?)?|coverage(?:\.value|\.progress)?)$/;
const MEASURE_FIGURE = (where, field) => (englishTwin(where) === "content/measure.json" || where === "MEASURE") && FIGURE_FIELD.test(field);
const SPELLED = "two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand";
const MODEL = "Llama|Mistral|Mixtral|Qwen|Gemma|Falcon|Phi|DeepSeek|Yi";
const AUDIENCE = String.raw`\s?(?:clients?|customers?|users?|people|downloads|installs|companies|businesses|teams|organi[sz]ations|revenue|sales|ARR|MRR)\b`;
const VENDORS = "Google|Microsoft|Amazon|AWS|Salesforce|HubSpot|SAP|Oracle|OpenAI|Anthropic|NVIDIA|IBM|Cloudflare";
// Vietnamese. \b only knows ASCII letters, so words are bounded with Unicode lookarounds (L before, R after), and a
// number may not continue a word or another number (NUM). Spelled numbers and the nouns a count would claim,
// people included ("3 đồng sáng lập", "8 thành viên"), with any run of up to three spaces between their words:
const L = String.raw`(?<![\p{L}\p{N}_])`;
const R = String.raw`(?![\p{L}\p{N}_])`;
const NUM = String.raw`(?<![\p{L}\p{N}_.,])\d[\d.,]{0,15}`;
const VI_SPELLED = "một|hai|ba|bốn|năm|sáu|bảy|tám|chín|mười|mươi|trăm|nghìn|ngàn|chục";
const VI_COUNTED = "khách hàng|dự án|doanh nghiệp|công ty|tổ chức|nhân sự|nhân viên|chuyên gia|kỹ sư|lập trình viên|đối tác|thương hiệu|quốc gia|người dùng|đồng sáng lập|nhà sáng lập|đồng nghiệp|thành viên".replaceAll(" ", String.raw`\s{1,3}`);
const VI_PRESS = "VnExpress|Tuổi Trẻ|Thanh Niên|CafeF|CafeBiz|VTV|VietnamNet|Dân Trí|Zing|Forbes Việt Nam|Người Lao Động";
const vi = (source) => new RegExp(source, "iu");
// A date in the glossary's format ("tháng 10 năm 2026", "ngày 23 tháng 10 năm 2026") names a month, not ten years:
// a month from 1 to 12 right after "tháng" and right before a four-digit year.
const VI_DATE_MONTH = String.raw`(?<=${L}tháng\s{1,3})(?:0?[1-9]|1[0-2])\s{1,3}năm\s{1,3}\d{4}${R}`;
// The owner's contact details (bilingual spec, decision 4) are facts that only Site identity holds.
const NAP_FIELD = (where, field) => /^content\/(?:vi\/)?site\.json$/.test(where) && /^(?:address\.(?:full|street|locality)|telephone)$/.test(field);

/** [pattern, what, { skip }]: `skip(where, field)` is true where the rule does not apply. */
export const FORBIDDEN = [
  // Prices.
  [/\$\s?\d/, "a price"],
  [/[€£¥₫₹₩₽₺₦₱฿]|\b(?:USD|EUR|GBP|VND|SGD|AUD|CHF|JPY|CNY|INR)\b|\b(?:dollars?|euros?|pounds?|bucks)\b/i, "a price"],
  // Vietnamese prices and rates ("5.000.000 đồng", "200.000đ", "15 triệu", "10 triệu/tháng", "giá từ 9…"). "đồng" is
  // the currency only after a number: hợp đồng, đồng ý and đồng thời are words, and "3 đồng sáng lập" or
  // "5 đồng nghiệp" count people (a client or scale claim, below).
  [vi(String.raw`${NUM}\s{0,3}(?:đồng(?!\s{1,3}(?:sáng\s{1,3}lập|nghiệp)${R})|đ|vnđ|vnd|nghìn|ngàn|triệu|tr|tỷ)${R}`), "a price"],
  [vi(String.raw`${NUM}\s{0,3}(?:\/|mỗi|một|cho mỗi|trên mỗi)\s{0,3}(?:tháng|năm|quý|giờ|ngày|tuần|dự án|người dùng|người|tài khoản|lượt)${R}`), "a price"],
  [vi(String.raw`${L}(?:giá|chi phí|phí|mức phí|báo giá|ngân sách)\s{1,3}(?:(?:dịch vụ|gói|trọn gói)\s{1,3})?(?:chỉ\s{1,3})?(?:từ|chỉ|khoảng|dưới|trên|:)\s{0,3}\d`), "a price"],
  // A number with a rate ("499 per month", "49 a month", "49/mo"); "one team per project" is not a price.
  [/(?<![\w.,])\d[\d,.]{0,12}\s{0,3}(?:(?:per|a|an)\s{1,3}|\/\s{0,3})(?:month|year|yr|mo|hour|hr|day|week|project|user|seat|sprint)s?\b/i, "a price"],
  [/\b(?:hourly|daily|day) rates?\b|\b(?:price[sd]?|pricing|fees?|costs?|rates?)\s{0,3}(?:from|of|start(?:s|ing)?\s(?:at|from)|:)\s{0,3}\d|\bstarting (?:at|from)\s{0,3}\d/i, "a price"],
  // Sizes are not claims, in their plain shapes only: a B or M parameter count right after a model
  // name and an optional version ("Llama 3 70B", "Qwen 2.5 72B"), never followed by an audience or
  // revenue noun; B sizes before "parameters" or "models" ("7B and 13B parameter models"); a k
  // context window ("a 128k context window"); a K screen ("4K display").
  // The unit letter ends at a Unicode edge: "100 ký tự" (characters) and "82 Mức" are words, not k or M.
  [new RegExp(String.raw`(?<![\w.,])(?!(?<=\b(?:${MODEL})\b[ -]?(?:\d{1,2}(?:\.\d)?[ -])?)\d{1,4}(?:\.\d)?[bBmM](?![\p{L}\p{N}_])(?!${AUDIENCE}))\d{1,6}(?:[.,]\d{1,3})?\s?[kKmMbB](?![\p{L}\p{N}_])(?!(?:\s?(?:and|or|,)\s?\d{1,4}[bB]\b){0,3}(?:(?<=[bB])\s?(?:parameters?|params|models?)\b|(?<=[kK])\s{1,3}context\s{1,3}window\b|(?<=[kK])\s?(?:displays?|screens?|monitors?|video|resolution|TV|UHD|HDR)\b))`, "u"), "a price or scale figure", { skip: MEASURE_FIGURE }],
  // The original site and the old identity.
  [/97\.8|31\.2|84\.7/, "an original platform metric"],
  // "space—gear" is the retired dash wordmark: the drawn logo replaced it (docs/brand/).
  [/Platform®|Platform B\.V\.|Platform Labs|plat—form|space—gear/, "the old brand"],
  [/Book a Demo/i, "the old call to action"],
  [/®/, "a registered-trademark sign (use ™ until the mark is registered)"],
  // Clients, scale and results.
  [/Enterprise Clients|Active Users|API Calls/i, "an unverified scale claim"],
  [/(?<![\w.,])\d{1,6}(?:\.\d{1,3})?\s?[MKB]\+/, "a scale figure"],
  [/(?<![\w.,])\d[\d,]{0,15}\+(?!\d)/, "a scale figure"],
  [/(?<![\w.,])\d[\d,.]{0,15}\s{0,3}(?:\+\s{0,3})?(?:(?:happy|satisfied|enterprise|global)\s{1,3})?(?:clients?|customers?|companies|businesses|brands|teams|users|projects|countries|partners|employees|engineers|experts)\b|\b(?:hundreds|thousands|dozens|millions)\s{1,3}of\s{1,3}(?:(?:happy|satisfied|enterprise|global|our)\s{1,3})?(?:clients?|customers?|users?|compan(?:y|ies)|businesses|brands|organi[sz]ations|people)\b/i, "a client or scale claim"],
  [new RegExp(`\\b(?:${SPELLED})(?:[- ](?:${SPELLED}|one)){0,3}\\s{1,3}(?:(?:happy|satisfied|enterprise|global)\\s{1,3})?(?:clients|customers|companies|businesses|brands|engineers|developers|experts|employees|specialists|consultants)\\b|\\bteam of\\s{1,3}(?:\\d{1,4}|${SPELLED})\\s{1,3}(?:engineers|developers|experts|people|specialists|consultants)\\b`, "i"), "a client or scale claim"],
  [/\bFortune\s?(?:50|100|500|1000)\b/, "an unverified client claim"],
  // A client result only with a figure next to it ("98% Client satisfaction", "Customers served:
  // 10,000") or as a stated rate; "Analyse customer satisfaction surveys" describes a service.
  [/(?<![\w.,])\d[\d.,]{0,8}[^.!?\n]{0,30}?\b(?:clients?|customers?|users?)\s{1,3}(?:satisfaction|retention|served|helped|onboarded|reached|saved)\b|\b(?:clients?|customers?|users?)\s{1,3}(?:satisfaction|retention|served|helped|onboarded|reached|saved)\b[^.!?\n]{0,30}?\d|\b(?:client|customer|user)\s{1,3}satisfaction\s{1,3}(?:of|rate|score)\b/i, "a client result claim"],
  // "You own 100% of the code" states ownership and "100% remotely" a way of working, not a result.
  [/(?<![\w.,])(?!100\s?%\s{1,3}(?:of\s{1,3}(?:the|your)\s{1,3}(?:code|source code|IP|intellectual property|work|deliverables|rights)|remote(?:ly)?|online)\b)\d[\d.,]{0,6}\s?%|\bper ?cent\b/i, "a result figure", { skip: MEASURE_FIGURE }],
  // "62 Xử lý" is a word, not a multiplier: the x ends at a Unicode edge.
  [/(?<![\w.,])\d{1,6}(?:\.\d{1,3})?\s?(?:x(?![\p{L}\p{N}_])|×)|\b(?:two|three|four|five|ten)(?:fold| times)\b|\b(?:doubled|tripled|quadrupled)\b/iu, "a multiplier claim"],
  // Press, partners, ratings, awards and certifications.
  [/TechCrunch/, "an unverified press or partnership claim"],
  [/\bAWS\b/, "an unverified press or partnership claim", { skip: LEGAL }],
  [/\b(?:[Aa]s [Ss]een (?:in|on)|[Ff]eatured (?:in|on|by)|[Ii]n the press|[Pp]ress coverage)\b|\b(?:Forbes|Wired|Bloomberg|Reuters|Gartner|Forrester|VentureBeat|Clutch)\b/, "an unverified press claim"],
  // "Microsoft 365 and partner tools" lists products: no "and", "or" or comma between vendor and
  // "partner". "Use your preferred partner" and "We select partner tools" are not claims; "a
  // select partner", "a preferred partner of Google" and "Salesforce's preferred partner" are.
  [new RegExp(String.raw`\b(?:${VENDORS})\s{1,3}(?:(?!(?:and|or)\b)\w{1,20}\s{1,3}){0,2}?partner\b|\b(?:${VENDORS})['’]s\s{1,3}(?:\w{1,20}\s{1,3}){0,2}?partner\b|\b(?:certified|official|premier|gold|silver|platinum|advanced|registered)\s{1,3}(?:tier\s{1,3})?partner\b|\b(?:preferred|select)\s{1,3}partner\s{1,3}(?:of|for|to)\b|\ba\s{1,3}(?:preferred|select)\s{1,3}partner\b`, "i"), "an unverified partnership claim"],
  [/\baward[- ]winning\b|\bwinner of\b|\brated\s{1,3}\d|\b\d\.\d\s?\/\s?(?:5|10)\b|\bout of (?:5|five|10)\b|\b(?:\d|five|four)[- ]star\b|(?:#\s?1|\bnumber one)\s{1,3}(?:\w{1,20}\s{1,3}){0,2}?(?:agency|agencies|consultancy|consultancies|firm|company|provider|studio|choice|partner|developer|team)\b|\btop[- ]rated\b/i, "an unverified rating or award"],
  [/[★☆]|(?<![\w.,])\d(?:\.\d)?\s?stars?\b/i, "an unverified rating or award"],
  [/\bISO\s?\d{4,5}(?:[:-]\d{4})?\s{1,3}(?:certified|certification|compliant|accredited)\b|\bSOC\s?[123]\s{1,3}(?:Type\s{1,3}(?:II|I|1|2)\b|certified|compliant|audited)|\bour\s{1,3}SOC\s?[123]\b|\bSOC\s?[123]\s{1,3}reports?\s{1,3}(?:(?:is|are)\s{1,3})?(?:available|on request)\b|\b(?:certified|accredited)\s{1,3}(?:ISO|SOC)\b/i, "an unverified certification"],
  // Offices.
  [/Amsterdam|New York|Dubai|Keizersgracht/, "an office location"],
  [/\boffices?\s{1,3}(?:in|across|around)\b|\bheadquarter(?:s|ed)\b|\bHQ\s{1,3}(?:in|at)\b|\b(?:our|global|regional)\s{1,3}HQ\b|\bbased (?:in|out of) (?!part\b)|\bour\s{1,3}[A-Z]\w{0,30}\s{1,3}(?:office|studio)\b/i, "an office location"],
  // Experience. The legal pages state periods ("for 2 years"); founding years and decades are refused everywhere.
  [/\b(?:since|founded(?:\s{1,3}in)?|est\.?|established(?:\s{1,3}in)?)\s{1,3}(?:19|20)\d{2}\b|\bsince the (?:19|20)\d0s\b|\bdecades?\b(?![- ]old\b)/i, "an experience claim"],
  [new RegExp(`(?<![\\w.,])\\d{1,4}\\s?(?:\\+\\s?)?(?:years?|yrs?)\\b|\\b(?:one|${SPELLED})\\s{1,3}years?\\b`, "i"), "an experience claim", { skip: LEGAL }],
  // Delivery timelines. A promise to deliver is refused everywhere; other periods are allowed on the legal pages.
  [new RegExp(`\\b(?:deliver(?:s|ed|y)?|ship(?:s|ped)?|launch(?:es|ed)?|go(?:es)? live|complete[sd]?|built)\\b[^.!?\\n]{0,40}?\\b(?:in|within|under)\\s{1,3}(?:just\\s{1,3}|only\\s{1,3})?(?:\\d{1,3}|a|one|${SPELLED})\\s{0,3}(?:hours?|days?|weeks?|months?)\\b`, "i"), "a delivery timeline"],
  [/(?<![\w.,])\d{1,3}\s?-?\s?(?:h|hrs?|hours?|days?|weeks?)\s{1,3}turnaround\b/i, "a delivery timeline"],
  [/\b(?:in|within|under)\s{1,3}(?:just\s{1,3}|only\s{1,3})?\d{1,3}\s?(?:days?|weeks?|months?|hours?)\b|(?<![\w.,])\d{1,3}\s?(?:-|–|to)\s?\d{1,3}\s?(?:days?|weeks?|months?)\b/i, "a delivery timeline", { skip: LEGAL }],
  // Vietnamese counts of khách hàng, dự án, doanh nghiệp, nhân sự, chuyên gia, đồng sáng lập…, also "hàng trăm" and spelled numbers.
  [vi(String.raw`${NUM}\s{0,3}\+?\s{0,3}(?:${VI_COUNTED})${R}|${L}(?:hàng|vài|hơn|trên)\s{1,3}(?:chục|trăm|nghìn|ngàn|triệu)\s{1,3}(?:${VI_COUNTED})${R}|${L}(?:hơn|trên)\s{1,3}(?:${VI_SPELLED})(?:\s{1,3}(?:${VI_SPELLED})){0,3}\s{1,3}(?:${VI_COUNTED})${R}`), "a client or scale claim"],
  // Năm kinh nghiệm, founding years and decades are refused everywhere; "N năm" periods are allowed on the legal pages,
  // and a date ("tháng 10 năm 2026") is not a period.
  [vi(String.raw`${NUM}\s{0,3}\+?\s{0,3}năm\s{1,3}kinh\s{1,3}nghiệm|${L}(?:${VI_SPELLED})(?:\s{1,3}(?:${VI_SPELLED})){0,3}\s{1,3}năm\s{1,3}kinh\s{1,3}nghiệm|${L}(?:thành\s{1,3}lập|ra\s{1,3}đời)\s{1,3}(?:(?:từ|vào)\s{1,3})?(?:năm\s{1,3})?(?:19|20)\d{2}${R}|${L}(?:kể\s{1,3})?từ\s{1,3}năm\s{1,3}(?:19|20)\d{2}${R}|${L}thập\s{1,3}(?:kỷ|niên)${R}`), "an experience claim"],
  [vi(String.raw`(?!${VI_DATE_MONTH})${NUM}\s{0,3}\+?\s{0,3}năm${R}`), "an experience claim", { skip: LEGAL }],
  // Đối tác, giải thưởng, chứng nhận, báo chí. "Không hàm ý quan hệ đối tác" (the terms) and "công cụ của đối tác" are not claims.
  [vi(String.raw`${L}đối\s{1,3}tác\s{1,3}(?:chính\s{1,3}thức|chiến\s{1,3}lược|vàng|bạc|bạch\s{1,3}kim|kim\s{1,3}cương|cấp\s{1,3}cao|được\s{1,3}chứng\s{1,3}nhận|ưu\s{1,3}tiên|hàng\s{1,3}đầu|độc\s{1,3}quyền)${R}|${L}đối\s{1,3}tác\s{1,3}(?:của|với)\s{1,3}(?:${VENDORS})${R}|${L}(?:${VENDORS})\s{1,3}(?:chứng\s{1,3}nhận|công\s{1,3}nhận|ủy\s{1,3}quyền)${R}`), "an unverified partnership claim"],
  [vi(String.raw`${L}(?:giải\s{1,3}thưởng|đạt\s{1,3}giải|đoạt\s{1,3}giải|được\s{1,3}vinh\s{1,3}danh|top\s{1,3}\d{1,3}\s{1,3}(?:công\s{1,3}ty|doanh\s{1,3}nghiệp|đơn\s{1,3}vị|nhà\s{1,3}cung\s{1,3}cấp|agency|thương\s{1,3}hiệu)|(?:đơn\s{1,3}vị|công\s{1,3}ty|doanh\s{1,3}nghiệp|nhà\s{1,3}cung\s{1,3}cấp|agency|thương\s{1,3}hiệu)\s{1,3}số\s{1,3}1|số\s{1,3}1\s{1,3}(?:Việt\s{1,3}Nam|thị\s{1,3}trường|khu\s{1,3}vực|châu\s{1,3}Á|thế\s{1,3}giới|về)|hàng\s{1,3}đầu\s{1,3}(?:Việt\s{1,3}Nam|thị\s{1,3}trường|khu\s{1,3}vực|châu\s{1,3}Á|thế\s{1,3}giới)|được\s{1,3}(?:đánh\s{1,3}giá|xếp\s{1,3}hạng)\s{1,3}\d|${NUM}\s{0,3}sao)${R}`), "an unverified rating or award"],
  [vi(String.raw`${L}(?:chứng\s{1,3}nhận|chứng\s{1,3}chỉ|đạt\s{1,3}chuẩn|tiêu\s{1,3}chuẩn)\s{1,3}(?:ISO|SOC)${R}|${L}được\s{1,3}chứng\s{1,3}nhận${R}`), "an unverified certification"],
  [vi(String.raw`${L}(?:báo\s{1,3}chí|truyền\s{1,3}thông\s{1,3}(?:đưa\s{1,3}tin|nói\s{1,3}về)|lên\s{1,3}báo|xuất\s{1,3}hiện\s{1,3}trên\s{1,3}(?:báo|truyền\s{1,3}hình|VTV)|${VI_PRESS})${R}`), "an unverified press claim", { skip: LEGAL }],
  // Văn phòng, chi nhánh, trụ sở.
  [vi(String.raw`${L}(?:văn\s{1,3}phòng|chi\s{1,3}nhánh|trụ\s{1,3}sở)(?:\s{1,3}(?:chính|đại\s{1,3}diện|giao\s{1,3}dịch))?\s{1,3}(?:tại|ở|đặt\s{1,3}tại)${R}|${L}(?:các|nhiều|hệ\s{1,3}thống)\s{1,3}(?:văn\s{1,3}phòng|chi\s{1,3}nhánh)${R}|${NUM}\s{0,3}(?:văn\s{1,3}phòng|chi\s{1,3}nhánh)${R}|${L}có\s{1,3}(?:văn\s{1,3}phòng|chi\s{1,3}nhánh|trụ\s{1,3}sở)${R}`), "an office location"],
  // Delivery timelines: a promise to deliver is refused everywhere; other periods ("tối đa 90 ngày") only off the legal pages.
  [vi(String.raw`${L}(?:bàn\s{1,3}giao|triển\s{1,3}khai|hoàn\s{1,3}thành|hoàn\s{1,3}tất|ra\s{1,3}mắt|vận\s{1,3}hành|go\s{1,3}live|giao|xây\s{1,3}dựng\s{1,3}xong|làm\s{1,3}xong)${R}[^.!?\n]{0,40}?${L}(?:trong|chỉ\s{1,3}trong|trong\s{1,3}vòng|dưới|chưa\s{1,3}đến|không\s{1,3}quá)\s{1,3}(?:chỉ\s{1,3})?(?:\d{1,3}|${VI_SPELLED})(?:\s{1,3}(?:${VI_SPELLED}))?\s{0,3}(?:giờ|ngày|tuần|tháng)${R}`), "a delivery timeline"],
  [vi(String.raw`${L}(?:trong|chỉ\s{1,3}trong|trong\s{1,3}vòng|dưới|chưa\s{1,3}đến|không\s{1,3}quá|tối\s{1,3}đa)\s{1,3}(?:chỉ\s{1,3})?\d{1,3}\s{0,3}(?:giờ|ngày|tuần|tháng)${R}|${NUM}\s{0,3}(?:-|–|đến|tới)\s{0,3}\d{1,3}\s{0,3}(?:ngày|tuần|tháng)${R}`), "a delivery timeline", { skip: LEGAL }],
  // Results with figures: tăng/giảm N%, gấp N lần, nhanh hơn N lần.
  [vi(String.raw`${L}gấp\s{1,3}(?:\d{1,3}(?:[.,]\d)?|${VI_SPELLED})\s{1,3}lần${R}|${NUM}\s{0,3}lần\s{1,3}(?:nhanh|hiệu\s{1,3}quả|rẻ|tốt|cao|nhiều)|${L}(?:nhanh|hiệu\s{1,3}quả|rẻ|tốt|cao|nhiều)\s{1,3}hơn\s{1,3}(?:\d{1,3}(?:[.,]\d)?|${VI_SPELLED})\s{1,3}lần${R}|${L}(?:tăng|giảm|cải\s{1,3}thiện|tiết\s{1,3}kiệm|rút\s{1,3}ngắn|nâng|cắt\s{1,3}giảm)\s{1,3}(?:\p{L}{1,10}\s{1,3}){0,3}?(?:đến\s{1,3}|tới\s{1,3}|hơn\s{1,3}|thêm\s{1,3}|khoảng\s{1,3})?\d[\d.,]{0,6}\s{0,3}(?:%|phần\s{1,3}trăm)`), "a result figure", { skip: MEASURE_FIGURE }],
  // The owner's phone number and street address, in either language, outside Site identity's address and telephone fields.
  [/(?<!\p{N})(?:\+\s?84|0)\s?386\s?749\s?799(?!\p{N})|\bB4\s{1,3}Street\b|đường\s{1,3}B4(?![\p{L}\p{N}])|\bSala\s{1,3}Urban\s{1,3}Area\b|Khu\s{1,3}đô\s{1,3}thị\s{1,3}Sala(?!\p{L})/iu, "the owner's contact details outside Site identity (content/site.json: address and telephone)", { skip: NAP_FIELD }],
];

/** NFKC, then format characters (\p{Cf}) and the combining grapheme joiner removed: what a reader sees, in plain characters. */
export const fold = (text) => text.normalize("NFKC").replace(/[\p{Cf}\u{34F}]/gu, "");

/** Every forbidden claim in `text`, as "<what> (<match>)". `where` and `field` place it, for scoped rules. */
export function findForbidden(text, where = "", field = "") {
  const folded = fold(text);
  return FORBIDDEN.flatMap(([pattern, what, scope]) => {
    if (scope?.skip(where, field)) return [];
    const hit = folded.match(pattern);
    // JSON quoting shows a line break or a tab inside the match as \n or \t.
    return hit ? [`${what} (${JSON.stringify(hit[0])})`] : [];
  });
}

const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const FIGURE_PARTS = ["value", "unit", "score", "title", "label", "scoreLabel", "sub", "text", "note", "tag"];
/** A group whose fields read as one phrase on the page: a figure, or a title with its sub or text. */
const isGroup = (value) => ["value", "unit", "label", "score"].some((key) => Object.hasOwn(value, key))
  || (Object.hasOwn(value, "title") && (Object.hasOwn(value, "sub") || Object.hasOwn(value, "text")));

/**
 * Every text to scan in a content value, as [field, text]: each string, and each figure group as
 * it reads on the page (the group's own field). Numbers count only inside a figure group.
 */
export function textsOf(value, field = "", out = []) {
  if (typeof value === "string") out.push([field, value]);
  else if (Array.isArray(value)) value.forEach((item, index) => textsOf(item, `${field}[${index}]`, out));
  else if (isRecord(value)) {
    if (isGroup(value)) {
      const part = (key) => (typeof value[key] === "string" || typeof value[key] === "number" ? String(value[key]) : "");
      const [amount, unit, ...rest] = FIGURE_PARTS.map(part);
      out.push([field, [`${amount}${unit}`, ...rest].filter(Boolean).join(" ")]);
    }
    for (const [key, child] of Object.entries(value)) textsOf(child, field ? `${field}.${key}` : key, out);
  }
  return out;
}

/** The problems in [field, text] pairs. A problem already found in a group is not repeated for its fields. */
function findIn(texts, where) {
  const found = [];
  const inside = (field, group) => group === "" || field === group || field.startsWith(`${group}.`) || field.startsWith(`${group}[`);
  for (const [field, text] of texts) {
    for (const problem of findForbidden(text, where, field)) {
      if (!found.some((earlier) => earlier.problem === problem && inside(field, earlier.field))) found.push({ field, problem });
    }
  }
  return found;
}

/** Scans each exported value (functions excluded) on its own, as "<export><field>: <what> (<match>)". */
export function scanExports(content) {
  return Object.entries(content)
    .filter(([, value]) => typeof value !== "function")
    .flatMap(([name, value]) => findIn(textsOf(value), name).map(({ field, problem }) => `${name}${field && !field.startsWith("[") ? "." : ""}${field}: ${problem}`));
}

/**
 * The problems in one content file, as "<field>: <what> (<match>)" (or "<what> (<match>)" for a
 * Markdown file). A JSON file that does not parse is left to the loader, which reports it.
 */
export function scanFile(name, source) {
  let texts = [["", source]];
  if (name.endsWith(".json")) {
    try {
      texts = textsOf(JSON.parse(source));
    } catch {
      return [];
    }
  }
  return findIn(texts, name).map(({ field, problem }) => (field ? `${field}: ${problem}` : problem));
}

/** Every editable content file (JSON or Markdown) under <root>/content, dotfiles excluded. */
export function contentFiles(root = ".") {
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith(".")) return [];
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(?:json|md)$/.test(entry.name) ? [full] : [];
  });
  const dir = path.join(root, "content");
  return fs.existsSync(dir) ? walk(dir).sort() : [];
}

/** Scans every content file, so fields the site does not render are checked too. */
export function scanContentTree(root = ".") {
  return contentFiles(root).flatMap((file) => {
    const name = path.relative(root, file).replaceAll("\\", "/");
    return scanFile(name, fs.readFileSync(file, "utf8")).map((problem) => `${name}: ${problem}`);
  });
}
