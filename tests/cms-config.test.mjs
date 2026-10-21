import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { load } from "js-yaml";

const { contentSchemas, SINGLETON_FILES, COLLECTION_NAMES } = await import("../src/lib/content-model.ts");
const { SERVICES } = await import("../src/lib/content.ts");
const { INLINE_SYNTAX, parseLegalMarkdown } = await import("../src/lib/legal-markdown.ts");
const config = load(fs.readFileSync("public/admin/config.yml", "utf8"));
const schemas = contentSchemas(SERVICES.map((service) => service.slug));
const pages = config.collections.find((collection) => collection.name === "pages");
const legal = config.collections.find((collection) => collection.name === "legal");

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
  const files = new Map(pages.files.map((file) => [file.file, file]));
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
    assert.deepEqual([collection.folder, collection.extension, collection.format], [`content/${name}`, "json", "json"], `${name}: folder and format`);
    assert.ok(fs.existsSync(collection.folder), `${collection.folder} exists`);
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
  assert.deepEqual(legal.files.map((file) => file.file), ["content/legal/privacy.md", "content/legal/terms.md"]);
  for (const file of legal.files) {
    assert.ok(fs.existsSync(file.file), `${file.file} exists`);
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

test("the legal body pattern mirrors the parser: it starts with a '## ' heading and has no inline syntax", () => {
  const [source, message] = legalPattern();
  assert.equal(source, String.raw`^(?![\s\S]*(?:${INLINE_SYNTAX.source}))##[ \t]+\S`, "built from INLINE_SYNTAX in src/lib/legal-markdown.ts, so the two cannot drift");
  assert.match(message, /Start with a line "## Heading"/);
  for (const file of legal.files) {
    assert.equal(file.fields[0].pattern, legalPattern(), "one rule for both pages");
    const body = fs.readFileSync(file.file, "utf8");
    assert.ok(cmsAccepts(body) && parserAccepts(body), `${file.file}: today's text passes both`);
  }
  const good = "## Heading\n\nA plain paragraph, with commas: and colons.\n\n## Second\n\nMore text.";
  assert.ok(cmsAccepts(good) && parserAccepts(good));
  const refused = [
    "Text before the first heading.\n\n## Heading\n\nText.",
    "# Heading\n\nText.",
    "##Heading\n\nText.",
    ...["*bold*", "_em_", "`code`", "<b>tag</b>", "[link](https://example.com)", "a \\ escape", "a | table", "~~struck~~", "&amp; entity", "&#36;5"].map((sample) => `## Heading\n\nText with ${sample}.`),
  ];
  for (const body of refused) {
    assert.equal(cmsAccepts(body), false, `the CMS refuses ${JSON.stringify(body)}`);
    assert.equal(parserAccepts(body), false, `the parser refuses ${JSON.stringify(body)}`);
  }
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
