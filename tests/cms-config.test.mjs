import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { load } from "js-yaml";
import { configProblems, loadSchema } from "../scripts/check-sveltia-config.mjs";

const { contentSchemas, SINGLETON_FILES, COLLECTION_NAMES } = await import("../src/lib/content-model.ts");
const { SERVICES } = await import("../src/lib/content.ts");
const { LEGAL_BODY_PATTERN, parseLegalMarkdown } = await import("../src/lib/legal-markdown.ts");
const config = load(fs.readFileSync("public/admin/config.yml", "utf8"));
const schemas = contentSchemas(SERVICES.map((service) => service.slug));
const pages = config.collections.find((collection) => collection.name === "pages");
const legal = config.collections.find((collection) => collection.name === "legal");
/** A CMS path for one language: "content/{{locale}}/home.json" → content/home.json (en) or content/vi/home.json (vi). */
const localePath = (template, locale = "en") => template.replace("{{locale}}/", locale === "en" ? "" : `${locale}/`);

// Sveltia CMS 0.230.1 numbers a collection with `reorder: true` itself: a new entry gets the
// highest order plus one, and dragging or deleting entries renumbers them 1, 2, 3…, always in the
// `order` field. So that field is hidden in the editor instead of being typed by hand.
const REORDER_KEY = "order";

// One CMS field must express exactly the rule its schema enforces.
function mirrorField(schema, field, where, { reorder = false } = {}) {
  const meta = schema.meta;
  const required = field.required !== false;
  switch (meta.kind) {
    case "text": {
      assert.ok((meta.format === "image" ? ["image"] : ["string", "text"]).includes(field.widget), `${where}: widget ${field.widget} for ${meta.format} text`);
      assert.equal(required, meta.min > 0, `${where}: required`);
      if (field.widget !== "image") assert.equal(field.maxlength, meta.max, `${where}: maxlength`);
      assert.equal(field.pattern?.[0], meta.pattern?.source, `${where}: pattern`);
      return;
    }
    case "number":
      if (reorder && field.name === REORDER_KEY) {
        assert.deepEqual([field.widget, meta.min, meta.integer], ["hidden", 1, true], `${where}: written by the CMS as 1, 2, 3…`);
        return;
      }
      assert.equal(field.widget, "number", `${where}: widget`);
      assert.deepEqual([field.min, field.max, field.value_type], [meta.min, meta.max, meta.integer ? "int" : "float"], `${where}: bounds`);
      return;
    case "boolean":
      assert.equal(field.widget, "boolean", `${where}: widget`);
      return;
    case "literal":
      assert.deepEqual([field.widget, field.default], ["hidden", meta.value], `${where}: fixed value`);
      return;
    case "oneOf":
      assert.equal(field.widget, "select", `${where}: widget`);
      assert.deepEqual(field.options, [...meta.values], `${where}: options`);
      return;
    case "nullable":
      assert.equal(required, false, `${where}: optional`);
      return mirrorField(meta.inner, { ...field, required: undefined }, where);
    case "object":
      assert.equal(field.widget, "object", `${where}: widget`);
      return mirrorFields(meta.shape, field.fields, where);
    case "list": {
      if (meta.max === 0) {
        assert.deepEqual([field.widget, field.default], ["hidden", []], `${where}: always empty`);
        return;
      }
      assert.equal(field.widget, "list", `${where}: widget`);
      assert.equal(required, meta.min > 0, `${where}: required`);
      assert.deepEqual([field.min, field.max], [meta.min > 0 ? meta.min : undefined, meta.max], `${where}: list size`);
      if (meta.item.meta.kind === "object") return mirrorFields(meta.item.meta.shape, field.fields, `${where}[]`);
      assert.ok(field.field, `${where}: a list of single values uses "field"`);
      return mirrorField(meta.item, field.field, `${where}[]`);
    }
  }
}

function mirrorFields(shape, fields, where, options) {
  assert.deepEqual(fields.map((field) => field.name), Object.keys(shape), `${where}: CMS fields follow the schema keys, in order`);
  for (const field of fields) mirrorField(shape[field.name], field, `${where}.${field.name}`, options);
}

/** Every field of the configuration, aliases resolved, with where it is. */
function allFields() {
  const found = [];
  const walk = (fields, where) => {
    for (const field of fields ?? []) {
      const at = `${where}.${field.name}`;
      found.push([at, field]);
      walk(field.fields, at);
      if (field.field) walk([field.field], at);
    }
  };
  for (const collection of config.collections) {
    walk(collection.fields, collection.name);
    for (const file of collection.files ?? []) walk(file.fields, `${collection.name}/${file.name}`);
  }
  return found;
}

test("every content file has a CMS entry whose fields mirror its schema", () => {
  const files = new Map(pages.files.map((file) => [localePath(file.file), file]));
  mirrorFields(schemas.site.meta.shape, files.get("content/site.json").fields, "content/site.json");
  for (const [name, file] of Object.entries(SINGLETON_FILES)) {
    assert.ok(files.has(file), `${file} is editable in the CMS`);
    mirrorFields(schemas.singletons[name].meta.shape, files.get(file).fields, file);
  }
  assert.equal(pages.files.length, Object.keys(SINGLETON_FILES).length + 1, "no CMS entry for an unknown file");
});

test("every folder collection mirrors its entry schema, and the CMS keeps its order", () => {
  for (const name of COLLECTION_NAMES) {
    const collection = config.collections.find((item) => item.name === name);
    assert.ok(collection, `${name} is a CMS collection`);
    assert.deepEqual([collection.folder, collection.extension, collection.format], [`content/{{locale}}/${name}`, "json", "json"], `${name}: folder and format`);
    assert.ok(fs.existsSync(localePath(collection.folder)), `${localePath(collection.folder)} exists`);
    assert.equal(collection.reorder, true, `${name}: entries are ordered by dragging them, which writes ${REORDER_KEY}`);
    mirrorFields(schemas.collections[name].meta.shape, collection.fields, `content/${name}`, { reorder: true });
  }
});

test("services keep their pages: no creating, deleting or renaming them in the CMS", () => {
  const services = config.collections.find((item) => item.name === "services");
  assert.deepEqual([services.create, services.delete, services.duplicate], [false, false, false]);
  assert.equal(services.fields.find((field) => field.name === "slug").readonly, true);
});

test("legal pages are Markdown files with a single plain-text body field", () => {
  assert.deepEqual(legal.files.map((file) => file.file), ["content/{{locale}}/legal/privacy.md", "content/{{locale}}/legal/terms.md"]);
  for (const file of legal.files) {
    assert.ok(fs.existsSync(localePath(file.file)), `${localePath(file.file)} exists`);
    assert.deepEqual(file.fields.map((field) => field.name), ["body"]);
    // The markdown and rich-text widgets write \ escapes, which the legal parser refuses.
    assert.equal(file.fields[0].widget, "text", `${file.file}: a plain text area`);
    assert.match(file.fields[0].hint, /Leave a blank line before each heading/);
  }
});

// Sveltia tests a field pattern with new RegExp(source) (no flags) against the trimmed value.
const legalPattern = () => legal.files[0].fields[0].pattern;
const cmsAccepts = (body) => new RegExp(legalPattern()[0]).test(body.trim());
const parserAccepts = (body) => {
  try {
    parseLegalMarkdown(body, "probe.md");
    return true;
  } catch {
    return false;
  }
};

// tests/cms-legal-pattern.test.mjs fuzzes the pattern against the parser; these are named cases.
test("the legal body pattern mirrors the parser: a '## ' heading first, no inline or block syntax, no empty section", () => {
  const [source, message] = legalPattern();
  assert.equal(source, LEGAL_BODY_PATTERN, "built in src/lib/legal-markdown.ts from the parser's own rules");
  assert.match(message, /Start with a line "## Heading"/);
  for (const file of legal.files) {
    assert.equal(file.fields[0].pattern, legalPattern(), "one rule for both pages");
    for (const locale of ["en", "vi"]) {
      const body = fs.readFileSync(localePath(file.file, locale), "utf8");
      assert.ok(cmsAccepts(body) && parserAccepts(body), `${localePath(file.file, locale)}: today's text passes both`);
    }
  }
  const good = "## Heading\n\nA plain paragraph, with commas: and colons.\n\n## Second\n\nMore text.";
  assert.ok(cmsAccepts(good) && parserAccepts(good));
  const refused = [
    "Text before the first heading.\n\n## Heading\n\nText.",
    "# Heading\n\nText.",
    "##Heading\n\nText.",
    "## Heading\n\nText.\n\n- a list item",
    "## Heading\n\nText.\n\n1. a numbered item",
    "## Section #2\n\nText.",
    "## Heading\n\n### Detail\n\nText.",
    "## Heading\n\n## Text below\n\nText.",
    "## Heading\n\nText.\n\n---",
    ...["*bold*", "_em_", "`code`", "<b>tag</b>", "[link](https://example.com)", "a \\ escape", "a | table", "~~struck~~", "&amp; entity", "&#36;5"].map((sample) => `## Heading\n\nText with ${sample}.`),
  ];
  for (const body of refused) {
    assert.equal(cmsAccepts(body), false, `the CMS refuses ${JSON.stringify(body)}`);
    assert.equal(parserAccepts(body), false, `the parser refuses ${JSON.stringify(body)}`);
  }
});

test("i18n: English stays at today's paths, Vietnamese mirrors it under content/vi/, and every Vietnamese entry is required", () => {
  assert.deepEqual(config.i18n, { structure: "multiple_folders", locales: ["en", "vi"], default_locale: "en", omit_default_locale_from_file_path: true });
  for (const collection of config.collections) {
    assert.equal(collection.i18n, true, `${collection.name}: i18n`);
    for (const file of collection.files ?? []) {
      assert.equal(file.i18n, true, `${collection.name}/${file.name}: i18n`);
      assert.match(file.file, /^content\/\{\{locale\}\}\//, file.file);
      for (const locale of ["en", "vi"]) assert.ok(fs.existsSync(localePath(file.file, locale)), localePath(file.file, locale));
    }
    if (collection.folder) {
      assert.match(collection.folder, /^content\/\{\{locale\}\}\//, collection.folder);
      assert.equal(collection.initial_locales, undefined, `${collection.name}: both languages are always saved (Vietnamese cannot be switched off)`);
    }
  }
});

/** Whether a schema holds text an editor translates: plain text without a fixed pattern, or a group or list holding some. */
function translatable(meta) {
  switch (meta.kind) {
    case "text": return meta.format === "plain" && !meta.pattern;
    case "list": return meta.max > 0 && translatable(meta.item.meta);
    case "object": return Object.values(meta.shape).some((child) => translatable(child.meta));
    case "nullable": return translatable(meta.inner.meta);
    default: return false;
  }
}

/** Every CMS field says how it behaves in Vietnamese: translated (true) or copied from English (duplicate). */
function i18nFields(shape, fields, where) {
  for (const field of fields) {
    const meta = shape[field.name].meta;
    assert.equal(field.i18n, translatable(meta) ? true : "duplicate", `${where}.${field.name}`);
    const inner = meta.kind === "nullable" ? meta.inner.meta : meta;
    if (inner.kind === "object") i18nFields(inner.shape, field.fields, `${where}.${field.name}`);
    if (inner.kind === "list" && inner.max > 0) {
      if (inner.item.meta.kind === "object") i18nFields(inner.item.meta.shape, field.fields, `${where}.${field.name}[]`);
      else assert.equal(field.field.i18n, translatable(inner.item.meta) ? true : "duplicate", `${where}.${field.name}[]`);
    }
  }
}

test("text is translated; links, images, numbers, choices, patterned counts and the order are copied from English", () => {
  const files = new Map(pages.files.map((file) => [localePath(file.file), file]));
  i18nFields(schemas.site.meta.shape, files.get("content/site.json").fields, "content/site.json");
  for (const [name, file] of Object.entries(SINGLETON_FILES)) i18nFields(schemas.singletons[name].meta.shape, files.get(file).fields, file);
  for (const name of COLLECTION_NAMES) i18nFields(schemas.collections[name].meta.shape, config.collections.find((item) => item.name === name).fields, `content/${name}`);
  for (const file of legal.files) assert.equal(file.fields[0].i18n, true, `${file.file}: the body is translated`);
});

test("emoji autocomplete is off in every text input", () => {
  const typed = allFields().filter(([, field]) => ["string", "text"].includes(field.widget));
  assert.ok(typed.length > 100, "the walk sees the fields");
  for (const [where, field] of typed) assert.equal(field.use_emoji_autocomplete, false, where);
});

test("uploads go to public/uploads and are served from /uploads", () => {
  assert.equal(config.media_folder, "public/uploads");
  assert.equal(config.public_folder, "/uploads");
  assert.equal(config.media_libraries.stock_assets, false, "no third-party stock photo providers");
  assert.deepEqual(config.asset_collections.map((item) => [item.media_folder, item.public_folder, item.readonly]), [["public/images", "/images", true]]);
});

test("uploads are renamed to names the build accepts, and only still-image formats are re-encoded", () => {
  const library = config.media_libraries.default.config;
  assert.equal(library.slugify_filename, true, "file names follow the slug rules below");
  assert.deepEqual(config.slug, { encoding: "ascii", clean_accents: true, sanitize_replacement: "-", trim: true, lowercase: true, maxlength: 60 });
  assert.equal(library.filename_template, undefined, "names stay readable; the CMS adds -1, -2… when a name is taken");
  // Per-format keys, not raster_image: GIF and WebP uploads are kept as they are, so an animation
  // keeps playing (re-encoding through a canvas keeps only the first frame). check-content refuses
  // uploads that carry location data, which those two formats could still contain.
  assert.deepEqual(Object.keys(library.transformations).sort(), ["avif", "heic", "jpeg", "png"]);
  for (const options of Object.values(library.transformations)) assert.deepEqual(options, { format: "webp", quality: 85, width: 2560, height: 2560 });
});

// The release's own JSON schema (scripts/sveltia-cms.schema.json, pinned in SVELTIA.schema) is the
// reference for which options exist: scripts/check-sveltia-config.mjs validates against it offline.
test("config.yml is valid for the vendored release's own schema, which refuses unknown options", () => {
  const schema = loadSchema();
  assert.deepEqual(configProblems(config, schema), []);
  assert.deepEqual(configProblems({ ...config, bogus_option: true }, schema), ["/ should NOT have additional properties (bogus_option)"], "an option the release does not have, at the top level");
  assert.ok(configProblems({ ...config, use_emoji_autocomplete: false }, schema).includes("/ should NOT have additional properties (use_emoji_autocomplete)"), "a field option set at the top level");
  const order = structuredClone(config);
  order.collections.find((collection) => collection.name === "faqs").fields.find((field) => field.name === "order").auto_increment = true;
  assert.ok(configProblems(order, schema).some((problem) => problem.includes("auto_increment")), "an option 0.230.1's fields do not have (Task 9)");
});
