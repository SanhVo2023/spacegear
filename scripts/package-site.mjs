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
const roots=["_next","404","_not-found","services","about","approach","contact","privacy","terms"];
const assets=["apple-icon.png","icon.svg","favicon.ico","licenses/fonts.txt","images/galaxy-small.webp","images/galaxy.webp","images/hero-poster.webp","images/earth-color.webp","images/suite/design-engine.webp","images/suite/scale-matrix.webp","images/suite/neural-net.webp","images/suite/shield-core.webp","images/suite/neural-core.webp","models/earth-optimized.glb","models/earth-hq.glb","seo/og.png","draco/draco_decoder.wasm","draco/draco_wasm_wrapper.js","draco/draco_decoder.js"];
const files=(await fs.readdir(source)).filter(name=>/^(index\.(html|txt)|404\.html|robots\.txt|sitemap\.xml|__next\..*\.txt)$/.test(name));
for(const name of [...roots,...assets,...files]) {
  const dest=path.join(target,name);await fs.mkdir(path.dirname(dest),{recursive:true});
  await fs.cp(path.join(source,name),dest,{recursive:true});
}
let headers=await fs.readFile("public/_headers","utf8");
if(process.env.SITE_MODE!=="production")headers+="\n/*\n  X-Robots-Tag: noindex, nofollow\n";
await fs.writeFile(path.join(target,"_headers"),headers);
const routes=["services","services/digital-transformation","services/ai-strategy","services/applied-ai","services/automation-integration","services/product-delivery","about","approach","contact","privacy","terms"];
const redirects=["/index.html / 301",...routes.flatMap(route=>[`/${route} /${route}/ 301`,`/${route}/index.html /${route}/ 301`])];
await fs.writeFile(path.join(target,"_redirects"),redirects.join("\n")+"\n");
await fs.mkdir("artifacts",{recursive:true});
await fs.writeFile("artifacts/package-manifest.json",JSON.stringify({roots,assets,files,mode:process.env.SITE_MODE||"preview"},null,2));
console.log("Cloudflare package assembled from explicit route and asset allowlists.");
