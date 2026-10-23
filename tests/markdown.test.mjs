import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const { renderMarkdown, markdownProblems } = await import("../src/lib/markdown.ts");

test("headings h2–h4 get ids and an anchor; text is escaped; raw HTML is shown as text, never as markup", () => {
  const { html, headings } = renderMarkdown("## Vì sao cần đo Ấ\n\nA <b>bold</b> claim.\n\n### Vì sao cần đo Ấ\n", "vi");
  assert.deepEqual(headings, [{ id: "vi-sao-can-do-a", text: "Vì sao cần đo Ấ", level: 2 }, { id: "vi-sao-can-do-a-2", text: "Vì sao cần đo Ấ", level: 3 }]);
  assert.match(html, /<h2 id="vi-sao-can-do-a">Vì sao cần đo Ấ<a class="labs-anchor" href="#vi-sao-can-do-a" aria-label="Liên kết đến mục này: Vì sao cần đo Ấ">#<\/a><\/h2>/);
  assert.match(html, /A &lt;b&gt;bold&lt;\/b&gt; claim\./);
  assert.doesNotMatch(html, /<b>/);
  assert.match(renderMarkdown("## Why & how", "en").html, /aria-label="Link to this section: Why &amp; how"/);
});

test("heading ids stay unique, even when a heading's own text ends in -2", () => {
  const { headings } = renderMarkdown("## Foo\n\n## Foo\n\n## Foo 2\n\n#### 🚀\n", "en");
  assert.deepEqual(headings.map((heading) => heading.id), ["foo", "foo-2", "foo-2-2", "section"]);
});

test("links: site paths follow the language, https links get rel noopener noreferrer", () => {
  const { html } = renderMarkdown("[Liên hệ](/contact/) và [nguồn](https://example.org/a)", "vi");
  assert.match(html, /<a href="\/vi\/contact\/">Liên hệ<\/a>/);
  assert.match(html, /<a href="https:\/\/example\.org\/a" rel="noopener noreferrer">nguồn<\/a>/);
  assert.match(renderMarkdown("[Contact](/contact/)", "en").html, /<a href="\/contact\/">/);
  assert.match(renderMarkdown("[Logo](/images/logo.webp)", "vi").html, /<a href="\/images\/logo\.webp">/, "shared paths keep their address");
  assert.doesNotMatch(renderMarkdown("[x](javascript:alert(1))", "en").html, /<a /, "markdown-it refuses javascript: links");
});

test("images render through contentImage (upload variants), lazily, with their alt text", () => {
  const { html } = renderMarkdown("![A workflow diagram](/uploads/workflow.jpg)", "en");
  assert.match(html, /<img src="\/uploads\/workflow\.jpg\.w1280\.webp" srcset="\/uploads\/workflow\.jpg\.w640\.webp 640w, \/uploads\/workflow\.jpg\.w1280\.webp 1280w" sizes="\(min-width: 1024px\) 720px, 100vw" alt="A workflow diagram" loading="lazy" decoding="async">/);
  assert.match(renderMarkdown("![Suite](/images/suite/neural-net.webp)", "en").html, /<img src="\/images\/suite\/neural-net\.webp" alt="Suite" loading="lazy" decoding="async">/, "site images keep their file");
  assert.match(renderMarkdown('![A "quoted" *word*](/uploads/a.webp)', "en").html, /alt="A &quot;quoted&quot; word"/, "the alt text is plain, escaped text");
});

test("lists, blockquotes and code render; tables and strikethrough stay text", () => {
  const { html } = renderMarkdown("- one\n- two\n\n> quote\n\n```js\nconst x = \"<script>\";\n```\n\n| a | b |\n|---|---|\n\n~~no~~", "en");
  assert.match(html, /<ul>\n<li>one<\/li>/);
  assert.match(html, /<blockquote>/);
  assert.match(html, /<pre><code class="language-js">const x = &quot;&lt;script&gt;&quot;;/);
  assert.doesNotMatch(html, /<table|<s>|<del>/);
});

test("word count for the reading time", () => {
  assert.equal(renderMarkdown("## Title here\n\nOne two three four.", "en").words, 6);
  assert.equal(renderMarkdown("One\ntwo **three**\\\nfour [five](/about/) ![not counted](/uploads/a.webp)\n\n```\ncode not counted\n```", "en").words, 5, "a line break separates words; image descriptions and code blocks are not read");
});

test("validation: only h2–h4, no raw HTML, images need a site path and alt text, links are site paths or https", () => {
  const problems = markdownProblems("# Top\n\n##### Deep\n\n<div>x</div>\n\nText <span>y</span>\n\n![](/uploads/a.jpg)\n\n![Alt](https://cdn.example/a.jpg)\n\n[mail](mailto:a@b.co) [plain](http://example.org) [ok](/about/) [also](https://example.org)", "content/articles/x.md");
  for (const expected of [
    "content/articles/x.md, line 1: use headings ## to #### only (found #)",
    "content/articles/x.md, line 3: use headings ## to #### only (found #####)",
    "content/articles/x.md, line 5: raw HTML is not allowed",
    "content/articles/x.md, line 7: raw HTML is not allowed",
    "content/articles/x.md, line 9: the image needs a description",
    'content/articles/x.md, line 11: the image "https://cdn.example/a.jpg" must be an upload or a site image',
    'content/articles/x.md, line 13: the link "mailto:a@b.co" must be a site path such as /contact/ or a full https:// address',
    'content/articles/x.md, line 13: the link "http://example.org" must be a site path such as /contact/ or a full https:// address',
  ]) assert.ok(problems.some((problem) => problem.startsWith(expected)), `${expected}\n${problems.join("\n")}`);
  assert.equal(problems.length, 8);
  assert.deepEqual(markdownProblems("## Fine\n\nText with [a link](/about/) and ![alt](/images/suite/neural-net.webp).", "x.md"), []);
  assert.deepEqual(markdownProblems("## Setext heading\n\nTitle\n=====\n", "x.md"), ["x.md, line 3: use headings ## to #### only (found #)"]);
});

test("validation: tables and strikethrough, which the site shows as plain text, are refused", () => {
  assert.deepEqual(markdownProblems("## Data\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\nOld ~~price~~ text", "x.md"), [
    "x.md, line 3: tables are not shown on the site; use a list or paragraphs",
    "x.md, line 7: strikethrough (~~…~~) is not shown on the site",
  ]);
});

// The first Labs article, as drafted (docs/labs-drafts) or once published (content/), checked as real content:
// headings, uploads under /uploads/labs/<slug>/, a localized contact link and no validation problem.
const SLUG = "how-we-built-spacegear-tech";
function article(locale) {
  const candidates = [`docs/labs-drafts/${SLUG}/${locale}.md`, locale === "vi" ? `content/vi/articles/${SLUG}.md` : `content/articles/${SLUG}.md`];
  const file = candidates.find((candidate) => fs.existsSync(candidate));
  assert.ok(file, `the ${locale} article is at ${candidates.join(" or ")}`);
  return { file, body: fs.readFileSync(file, "utf8").replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "") };
}

for (const locale of ["en", "vi"]) {
  test(`the ${locale} article renders as written and passes validation`, () => {
    const { file, body } = article(locale);
    assert.deepEqual(markdownProblems(body, file), []);
    const { html, headings, words } = renderMarkdown(body, locale);
    const lines = body.split("\n");
    assert.equal(headings.length, lines.filter((line) => /^#{2,4} /.test(line)).length, "every heading is listed");
    assert.ok(headings.every((heading) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(heading.id)), headings.map((heading) => heading.id).join(" "));
    assert.equal(new Set(headings.map((heading) => heading.id)).size, headings.length, "ids are unique");
    for (const heading of headings) assert.ok(html.includes(`<h${heading.level} id="${heading.id}">`), heading.id);

    const images = [...html.matchAll(/<img [^>]*>/g)].map((match) => match[0]);
    assert.equal(images.length, lines.filter((line) => line.startsWith("![")).length, "every image renders");
    for (const image of images) {
      assert.match(image, new RegExp(`^<img src="/uploads/labs/${SLUG}/[a-z0-9-]+\\.webp\\.w1280\\.webp" srcset="[^"]+ 640w, [^"]+ 1280w" sizes="\\(min-width: 1024px\\) 720px, 100vw" alt="[^"]{20,}" loading="lazy" decoding="async">$`), image);
    }
    assert.ok(html.includes(`<a href="${locale === "vi" ? "/vi/contact/" : "/contact/"}">`), "the contact link follows the language");
    assert.doesNotMatch(html, /<(?:script|iframe|style|table|del|s)[\s>]/);
    assert.ok(words > 1500, `${words} words`);
  });
}
