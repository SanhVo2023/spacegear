import fs from "node:fs/promises";
import path from "node:path";
const source="out",target="dist";
// Production builds run in a fresh checkout, so removed routes/chunks cannot linger.
// Local previews overwrite allowed files without deleting preserved source material.
if(process.env.SITE_MODE==="production") {
  let exists=true;try { await fs.access(target); } catch(error) { if(error.code==="ENOENT")exists=false;else throw error; }
  if(exists)throw new Error("Production packaging requires a fresh checkout with no dist directory.");
}
await fs.mkdir(target,{recursive:true});
const roots=["_next","404","_not-found","services","about","approach","contact","privacy","terms","vi"];
// The hero globe's texture tiers (scripts/build-globe-textures.mjs): 1k phones, 2k desktop first frame, 4k streamed.
const globeTextures=["1k","2k","4k"].flatMap(tier=>["day","night","normal","spec","clouds"].map(map=>`textures/earth/${tier}/${map}.webp`));
const assets=["apple-icon.png","icon.svg","favicon.ico","icon-192.png","icon-512.png","icon-maskable-512.png","licenses/fonts.txt","images/galaxy.webp","images/hero-poster.webp","images/hero-poster-3840w.webp","images/suite/design-engine.webp","images/suite/scale-matrix.webp","images/suite/neural-net.webp","images/suite/shield-core.webp","images/suite/neural-core.webp","images/faq-team.webp","seo/og.png",...globeTextures];
const files=(await fs.readdir(source)).filter(name=>/^(index\.(html|txt)|404\.html|robots\.txt|sitemap\.xml|manifest\.webmanifest|__next\..*\.txt)$/.test(name));
for(const name of [...roots,...assets,...files]) {
  const dest=path.join(target,name);await fs.mkdir(path.dirname(dest),{recursive:true});
  await fs.cp(path.join(source,name),dest,{recursive:true});
}
// >>> CMS (showcase Part 3): ship the CMS uploads, and next to each the variants that the variant
// step cached for its current bytes: only regular .webp, .png, .jpg, .jpeg, .avif and .gif files with
// names the site can show, never a dotfile (.gitkeep, the CMS's .sveltia-tmp-*), an SVG, HTML or
// other file, or a link (scripts/lib/uploads.mjs). They come from public/uploads/, not out/, because
// next build follows links when it copies public/; the variants come from .cache/upload-variants/.
const {shipUploads}=await import("./lib/uploads.mjs");
console.log(`Uploads shipped: ${(await shipUploads("public/uploads",path.join(target,"uploads"),".cache/upload-variants")).length} files.`);
// Then /admin/ (Task 10): exactly the editor page, config.yml and the pinned Sveltia files, also from
// public/ for the same reason; a link, an extra file or a changed vendored byte stops packaging
// (scripts/lib/admin.mjs). public/_headers gives /admin/* and /uploads/* their own policies.
const {shipAdmin}=await import("./lib/admin.mjs");
console.log(`Admin shipped: ${(await shipAdmin("public/admin",path.join(target,"admin"),{label:"public/admin"})).length} files.`);
// <<< CMS
let headers=await fs.readFile("public/_headers","utf8");
// Previews add X-Robots-Tag inside the existing /* rule: a second /* rule replaces the first one's
// headers in the local preview, which then served no CSP or other security headers at all.
if(process.env.SITE_MODE!=="production"){
  const marked=headers.replace(/^\/\*(\r?\n)/m,(rule,eol)=>`${rule}  X-Robots-Tag: noindex, nofollow${eol}`);
  if(marked===headers)throw new Error("public/_headers needs a /* rule for the preview X-Robots-Tag.");
  headers=marked;
}
await fs.writeFile(path.join(target,"_headers"),headers);
const pages=["services","services/digital-transformation","services/ai-strategy","services/applied-ai","services/automation-integration","services/product-delivery","about","approach","contact","privacy","terms"];
// Both languages: /vi/ mirrors every English page.
const routes=[...pages,"vi",...pages.map(route=>`vi/${route}`)];
const redirects=["/index.html / 301",...routes.flatMap(route=>[`/${route} /${route}/ 301`,`/${route}/index.html /${route}/ 301`])];
await fs.writeFile(path.join(target,"_redirects"),redirects.join("\n")+"\n");
await fs.mkdir("artifacts",{recursive:true});
await fs.writeFile("artifacts/package-manifest.json",JSON.stringify({roots,assets,files,mode:process.env.SITE_MODE||"preview"},null,2));
console.log("Cloudflare package assembled from explicit route and asset allowlists.");
