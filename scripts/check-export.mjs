import fs from "node:fs/promises";
import path from "node:path";
const root="dist";const errors=[];let bytes=0;let count=0;
async function walk(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())await walk(file);else{count++;const stat=await fs.stat(file);bytes+=stat.size;const relative=path.relative(root,file).replaceAll("\\","/");if(stat.size>25*1024*1024)errors.push(`Oversized asset: ${relative}`);if(/gen-raw|assets\/source|\.env|\.map$|images\/(team|reviews|labs)|galaxy-small|earth-4k|earth-optimized|earth-color|models\/earth\.glb|seo\/og\.jpg|vercel\.svg|next\.svg/.test(relative)||/\.glb$|(?:^|\/)draco\//i.test(relative))errors.push(`Excluded source/template asset: ${relative}`);}}}
await walk(root);
for(const route of ["","services","services/digital-transformation","services/ai-strategy","services/applied-ai","services/automation-integration","services/product-delivery","about","approach","contact","privacy","terms"]){
  const file=path.join(root,route,"index.html");try{const html=await fs.readFile(file,"utf8");if(!html.includes("spacegear.tech"))errors.push(`Missing identity: ${route}`);if((html.match(/<h1(?:\s|>)/g)||[]).length!==1)errors.push(`H1 count: ${route}`);if(!html.includes('rel="canonical"'))errors.push(`No canonical: ${route}`);}catch{errors.push(`Missing HTML: ${route}`);}
}
await fs.access(path.join(root,"404.html")).catch(()=>errors.push("Missing 404"));
// Every exported text file: no sample preview content (src/lib/samples.ts) and no old identity.
// The brand strings mirror FORBIDDEN in tests/content.test.mjs. The real service name
// "Digital Product & Platform Delivery" does not match them. "space—gear" is the retired dash
// wordmark: the drawn logo (docs/brand/) replaced it, so no page, payload or chunk may bring it back.
const OLD_IDENTITY=[/Platform®/,/plat—form/i,/Platform B\.V\./,/Platform Labs/,/Book a Demo/i,/hello@platform\.nl/i,/\bplatform\.nl\b/i,/space—gear/i];
// The original's metrics are checked in HTML and RSC payloads only; minified JS can hold such digits by chance.
const OLD_METRICS=/(?<![\d.])(?:97\.8|31\.2|84\.7)(?![\d])/;
async function scanText(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory()){await scanText(file);continue;}if(!/\.(html|js|txt|json|xml|css|mjs)$/.test(entry.name))continue;const text=await fs.readFile(file,"utf8"),relative=path.relative(root,file).replaceAll("\\","/");if(text.includes("spacegear-sample-content"))errors.push(`Sample content exported: ${relative}`);for(const pattern of OLD_IDENTITY){const hit=text.match(pattern);if(hit)errors.push(`Old identity "${hit[0]}" in ${relative}`);}if(/\.(html|txt)$/.test(entry.name)){const hit=text.match(OLD_METRICS);if(hit)errors.push(`Original metric "${hit[0]}" in ${relative}`);}}}
await scanText(root);
// Every local asset an exported page references must exist in dist/ (un-allowlisted assets fail the build).
const need=async(ref,from)=>{ref=decodeURIComponent(ref);await fs.access(path.join(root,ref)).catch(()=>errors.push(`Missing asset ${ref} referenced by ${from}`));};
const localAsset=/(?:src|href|poster)="(\/(?:images|models|draco|textures|seo)\/[^"?#\s,]+|\/(?:icon\.svg|apple-icon\.png|favicon\.ico|manifest\.webmanifest)(?=["?#]))/g;
const srcSets=/(?:srcSet|srcset|imageSrcSet|imagesrcset)="([^"]*)"/g;
const socialImage=/<meta\b[^>]*\b(?:property="og:image"|name="twitter:image")[^>]*>/g;
async function scanRefs(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())await scanRefs(file);else if(entry.name.endsWith(".html")){const html=await fs.readFile(file,"utf8"),from=path.relative(root,file);for(const m of html.matchAll(localAsset))await need(m[1],from);for(const m of html.matchAll(srcSets))for(const candidate of m[1].split(",")){const url=candidate.trim().split(/\s+/)[0].replace(/[?#].*$/,"");if(/^\/(?:images|models|draco|textures|seo)\//.test(url))await need(url,from);}for(const m of html.matchAll(socialImage)){const content=m[0].match(/\bcontent="([^"]*)"/)?.[1];if(!content)continue;const url=new URL(content.replaceAll("&amp;","&"));if(url.origin==="https://spacegear.tech")await need(url.pathname,from);}}}}
await scanRefs(root);
// Every icon the web manifest (src/app/manifest.ts) names must ship; only the manifest names them, not the HTML.
try{const manifest=JSON.parse(await fs.readFile(path.join(root,"manifest.webmanifest"),"utf8"));if(!manifest.icons?.length)errors.push("manifest.webmanifest names no icons");for(const icon of manifest.icons||[])await need(icon.src,"manifest.webmanifest");}catch(error){errors.push(`Unreadable manifest.webmanifest: ${error.message}`);}
// Assets referenced only from JS chunks (the globe texture tiers, section art) must ship too. No GLB or Draco
// file ships at all (the "Excluded" check above), so a page or chunk that still names one fails as missing.
const chunkAsset=/"(\/(?:images|models|textures)\/[A-Za-z0-9_./-]+\.(?:glb|webp|png|jpe?g|svg|avif))"/g;
async function scanChunks(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())await scanChunks(file);else if(entry.name.endsWith(".js"))for(const m of (await fs.readFile(file,"utf8")).matchAll(chunkAsset))await need(m[1],path.relative(root,file));}}
await scanChunks(path.join(root,"_next/static/chunks")).catch(()=>errors.push("Missing JS chunks: _next/static/chunks"));
// >>> CMS (showcase Part 3): uploads, and the letter case of every local path (scripts/lib/uploads.mjs,
// scripts/lib/exact-paths.mjs):
// - every /uploads/ file a page or chunk names must ship under exactly that name (srcset variants
//   included), and no such path may step out of uploads/;
// - what ships under uploads/ passes the upload rules again (types, bytes, names, nothing hidden:
//   the excluded-asset rule's .env and .map cases included), so a file that changed during the
//   build cannot ship unchecked;
// - no page, payload or chunk may name a shipped file in another letter case (Windows finds it,
//   Cloudflare does not);
// - the excluded-asset rule at the top is for site assets, so it does not judge upload names.
const {UPLOAD_REF,uploadProblems}=await import("./lib/uploads.mjs");
const {exactIndex,wrongCaseReferences}=await import("./lib/exact-paths.mjs");
for(let i=errors.length-1;i>=0;i--)if(errors[i].startsWith("Excluded source/template asset: uploads/"))errors.splice(i,1);
const shipped=exactIndex(root);
async function scanUploads(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name),relative=path.relative(root,file).replaceAll("\\","/");if(entry.isDirectory()){if(relative!=="admin")await scanUploads(file);}else if(/\.(html|txt|js)$/.test(entry.name))for(const [ref] of (await fs.readFile(file,"utf8")).matchAll(UPLOAD_REF)){if(/\/\.\.?\//.test(ref))errors.push(`Unsafe upload path ${ref} in ${relative}`);else if(!shipped.has(ref.slice(1)))errors.push(`Missing asset ${ref} referenced by ${relative}`);}}}
await scanUploads(root);
// /admin/ (Task 10): exactly the committed page and config.yml and the Sveltia files with their pinned
// hashes, nothing else, no link and nothing hidden (scripts/lib/admin.mjs). _headers: /admin/* and
// /uploads/* replace the site CSP with their own (admin noindex, uploads sandboxed and nosniff), and
// every other shipped path gets exactly the /* policy (scripts/lib/headers.mjs mirrors Cloudflare).
const {adminProblems}=await import("./lib/admin.mjs");
const {headerProblems,sitePaths}=await import("./lib/headers.mjs");
errors.push(...adminProblems(path.join(root,"admin"),{label:`${root}/admin`,reference:"public/admin"}));
errors.push(...headerProblems(await fs.readFile(path.join(root,"_headers"),"utf8").catch(()=>""),sitePaths(root)).map(problem=>`${root}/_headers: ${problem.replace(/^_headers /,"")}`));
errors.push(...uploadProblems(path.join(root,"uploads"),{label:`${root}/uploads`,variants:true}));
errors.push(...wrongCaseReferences(root,{skip:["admin"]}));
// <<< CMS
if(errors.length){console.error(errors.join("\n"));process.exitCode=1;}else console.log(`Export valid: 12 core pages, ${count} files, ${(bytes/1048576).toFixed(2)} MiB total.`);
