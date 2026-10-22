// The form in which Sveltia CMS writes a content file: keys in the order of the configuration's
// fields (which follow the schema keys, tests/cms-config.test.mjs), with `order` first in a
// reorderable folder collection, JSON.stringify(data, null, 2) and a final newline. Files kept in
// this form change only where an editor changed something.

const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

/** `value` with its keys in `schema`'s order, recursively. Unknown keys keep their place after the known ones. */
export function inSchemaOrder(schema, value) {
  const { meta } = schema;
  if (meta.kind === "nullable") return value === null ? null : inSchemaOrder(meta.inner, value);
  if (meta.kind === "list") return Array.isArray(value) ? value.map((item) => inSchemaOrder(meta.item, item)) : value;
  if (meta.kind !== "object" || !isRecord(value)) return value;
  const out = {};
  for (const [key, child] of Object.entries(meta.shape)) if (Object.hasOwn(value, key)) out[key] = inSchemaOrder(child, value[key]);
  for (const [key, child] of Object.entries(value)) if (!Object.hasOwn(out, key)) out[key] = child;
  return out;
}

/** The text Sveltia writes for `data`: schema order, `order` first when `orderFirst`, 2-space JSON and a newline. */
export function canonicalJson(schema, data, { orderFirst = false } = {}) {
  let value = inSchemaOrder(schema, data);
  if (orderFirst && isRecord(value) && Object.hasOwn(value, "order")) {
    const { order, ...rest } = value;
    value = { order, ...rest };
  }
  return `${JSON.stringify(value, null, 2)}\n`;
}
