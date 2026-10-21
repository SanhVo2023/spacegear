// Runs Sveltia CMS's own file-naming code, taken from the vendored bundle, in an isolated vm
// context, so the tests can show which names the media library writes into public/uploads/.
// The bundle is minified and hash-locked (scripts/sveltia-cms.lock.json): the pieces below are
// found by exact text. After an upgrade an anchor may move; then re-check how uploads are named
// against UPLOAD_PATH (scripts/lib/uploads.mjs) and update the anchors.
//
// How an upload is named (0.230.1, functions AY, Zxe and DMe in the bundle):
//   1. oK(name, { slugificationEnabled }): sanitize-filename (it empties a Windows device name
//      such as con.png), then, with slugify_filename, the slug rules (RV) for the name without
//      its extension, and the extension in lower case.
//   2. A configured transformation re-encodes the image through a canvas and replaces the
//      extension (JV) with the new format's.
//   3. When the entry is saved, a name already used in the folder gets -1, -2… (Mj).
import fs from "node:fs";
import vm from "node:vm";
import crypto from "node:crypto";

export const BUNDLE = "public/admin/sveltia/sveltia-cms.js";

// [what, first characters, text that follows the piece (excluded unless `inclusive`)]
const PIECES = [
  ["bundler helpers", "t=Object.create,n=Object.defineProperty", ",d=s((e=>{"],
  ["cache helper", "YA=(e,t,n)=>{", ",XA="],
  ["text helpers", "HD=e=>e.replace(", ",WD="],
  ["random id", "Al=e=>{let t=globalThis.crypto.randomUUID()", ",jl="],
  ["path parts", String.raw`Yme=/(?:(.+?)\/)?`, ",Xme="],
  ["path split", "kk=e=>{let[,t,n,r,i]=e.match(Yme)", ",Zme="],
  ["sanitize-filename", "Ahe=s(((e,t)=>{", ",Aj="],
  ["unique names", "Mj=(e,t)=>{", ",Nj="],
  ["file name cleanup", "Nj=e=>(0,Nhe.default)", ",Phe="],
  ["transliteration and slugs", "wV=new Map([[", "l&&(d=d.toLocaleLowerCase()),d}", true],
  ["asset names", "oK=(e,{slugificationEnabled", ",Bwe="],
  ["image formats", "GV=[`avif`", ",YV="],
];
/** How Zxe picks a transformation: the sniffed format, the declared one, then raster_image. */
export const TRANSFORMATION_CHOICE = "s=o[i]??(a?o[a]:void 0)??t.raster_image";

function piece(bundle, [what, start, end, inclusive = false]) {
  const at = bundle.indexOf(start);
  if (at < 0 || bundle.indexOf(start, at + 1) >= 0) throw new Error(`${BUNDLE}: Sveltia's "${what}" code was not found exactly once; re-check how uploads are named (see tests/helpers/sveltia-names.mjs)`);
  const stop = bundle.indexOf(end, at);
  if (stop < 0) throw new Error(`${BUNDLE}: the end of Sveltia's "${what}" code was not found`);
  return bundle.slice(at, inclusive ? stop + end.length : stop);
}

/**
 * Loads the naming code. `locale` sets what toLocaleLowerCase() uses without an argument, which
 * in Chrome is the browser's language; a Turkish browser lowercases I to the dotless ı.
 */
export function loadSveltiaNames({ locale = "en-US" } = {}) {
  const bundle = fs.readFileSync(BUNDLE, "utf8");
  if (!bundle.includes(TRANSFORMATION_CHOICE)) throw new Error(`${BUNDLE}: Sveltia's transformation choice changed; re-check tests/helpers/sveltia-names.mjs`);
  const source = [
    "var cM={current:undefined};",
    ...PIECES.map((entry) => `var ${piece(bundle, entry)};`),
    `{const lower=String.prototype.toLocaleLowerCase;String.prototype.toLocaleLowerCase=function(l){return lower.call(this,l??${JSON.stringify(locale)})}}`,
    "globalThis.sveltia={cM,oK,RV,JV};",
  ].join("\n");
  const context = vm.createContext({ crypto: { randomUUID: () => crypto.randomUUID() } });
  vm.runInContext(source, context, { filename: "sveltia-names.vm.js" });
  const { cM, oK, RV, JV } = context.sveltia;

  const FORMATS = { jpg: "jpeg", jpeg: "jpeg", jpe: "jpeg", jfif: "jpeg", png: "png", gif: "gif", webp: "webp", avif: "avif", heic: "heic", heif: "heic" };
  return {
    /** The entry slug for a title, with the configuration's slug options. */
    slug(config, title) {
      cM.current = config;
      return RV(title);
    },
    /**
     * The name an upload is saved under, with the configuration's media library options.
     * `taken` lists the names already in the folder. The format is read from the extension
     * here; the CMS sniffs the bytes, which gives the same answer for a correctly named file.
     */
    uploadName(config, original, { taken = [] } = {}) {
      cM.current = config;
      const { slugify_filename: slugificationEnabled = false, transformations = {} } = config.media_libraries?.default?.config ?? {};
      let name = oK(original, { slugificationEnabled });
      const format = FORMATS[name.slice(name.lastIndexOf(".") + 1).toLowerCase()];
      const transformation = (format && transformations[format]) ?? (format ? transformations.raster_image : undefined);
      if (transformation) {
        const to = transformation.format ?? "webp";
        name = JV.test(name) ? name.replace(JV, to) : `${name}.${to}`;
      }
      return oK(name, { assetNamesInSameFolder: taken });
    },
  };
}
