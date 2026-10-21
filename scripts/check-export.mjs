import fs from "node:fs/promises";
import path from "node:path";
const root="dist";const errors=[];let bytes=0;let count=0;
async function walk(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())await walk(file);else{count++;const stat=await fs.stat(file);bytes+=stat.size;const relative=path.relative(root,file).replaceAll("\\","/");if(stat.size>25*1024*1024)errors.push(`Oversized asset: ${relative}`);if(/gen-raw|assets\/source|\.env|\.map$|images\/(team|reviews|labs)|galaxy-small|earth-4k|earth-optimized|earth-color|models\/earth\.glb|seo\/og\.jpg|vercel\.svg|next\.svg/.test(relative))errors.push(`Excluded source/template asset: ${relative}`);}}}
await walk(root);
for(const route of ["","services","services/digital-transformation","services/ai-strategy","services/applied-ai","services/automation-integration","services/product-delivery","about","approach","contact","privacy","terms"]){
  const file=path.join(root,route,"index.html");try{const html=await fs.readFile(file,"utf8");if(!html.includes("spacegear.tech"))errors.push(`Missing identity: ${route}`);if((html.match(/<h1(?:\s|>)/g)||[]).length!==1)errors.push(`H1 count: ${route}`);if(!html.includes('rel="canonical"'))errors.push(`No canonical: ${route}`);}catch{errors.push(`Missing HTML: ${route}`);}
}
await fs.access(path.join(root,"404.html")).catch(()=>errors.push("Missing 404"));
// Every exported text file: no sample preview content (src/lib/samples.ts) and no old identity.
// The brand strings mirror FORBIDDEN in tests/content.test.mjs. The real service name
// "Digital Product & Platform Delivery" does not match them.
const OLD_IDENTITY=[/Platform®/,/plat—form/i,/Platform B\.V\./,/Platform Labs/,/Book a Demo/i,/hello@platform\.nl/i,/\bplatform\.nl\b/i];
// The original's metrics are checked in HTML and RSC payloads only; minified JS can hold such digits by chance.
const OLD_METRICS=/(?<![\d.])(?:97\.8|31\.2|84\.7)(?![\d])/;
async function scanText(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory()){await scanText(file);continue;}if(!/\.(html|js|txt|json|xml|css|mjs)$/.test(entry.name))continue;const text=await fs.readFile(file,"utf8"),relative=path.relative(root,file).replaceAll("\\","/");if(text.includes("spacegear-sample-content"))errors.push(`Sample content exported: ${relative}`);for(const pattern of OLD_IDENTITY){const hit=text.match(pattern);if(hit)errors.push(`Old identity "${hit[0]}" in ${relative}`);}if(/\.(html|txt)$/.test(entry.name)){const hit=text.match(OLD_METRICS);if(hit)errors.push(`Original metric "${hit[0]}" in ${relative}`);}}}
await scanText(root);
// Every local asset an exported page references must exist in dist/ (un-allowlisted assets fail the build).
const need=async(ref,from)=>{ref=decodeURIComponent(ref);await fs.access(path.join(root,ref)).catch(()=>errors.push(`Missing asset ${ref} referenced by ${from}`));};
const localAsset=/(?:src|href|poster)="(\/(?:images|models|draco|seo)\/[^"?#\s,]+|\/(?:icon\.svg|apple-icon\.png|favicon\.ico)(?=["?#]))/g;
const srcSets=/(?:srcSet|srcset|imageSrcSet|imagesrcset)="([^"]*)"/g;
const socialImage=/<meta\b[^>]*\b(?:property="og:image"|name="twitter:image")[^>]*>/g;
async function scanRefs(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())await scanRefs(file);else if(entry.name.endsWith(".html")){const html=await fs.readFile(file,"utf8"),from=path.relative(root,file);for(const m of html.matchAll(localAsset))await need(m[1],from);for(const m of html.matchAll(srcSets))for(const candidate of m[1].split(",")){const url=candidate.trim().split(/\s+/)[0].replace(/[?#].*$/,"");if(/^\/(?:images|models|draco|seo)\//.test(url))await need(url,from);}for(const m of html.matchAll(socialImage)){const content=m[0].match(/\bcontent="([^"]*)"/)?.[1];if(!content)continue;const url=new URL(content.replaceAll("&amp;","&"));if(url.origin==="https://spacegear.tech")await need(url.pathname,from);}}}}
await scanRefs(root);
// Assets referenced only from JS chunks (the globe texture tiers, section art) and the Draco decoder files must ship too.
const chunkAsset=/"(\/(?:images|models|textures)\/[A-Za-z0-9_./-]+\.(?:glb|webp|png|jpe?g|svg|avif))"/g;
async function scanChunks(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())await scanChunks(file);else if(entry.name.endsWith(".js"))for(const m of (await fs.readFile(file,"utf8")).matchAll(chunkAsset))await need(m[1],path.relative(root,file));}}
await scanChunks(path.join(root,"_next/static/chunks")).catch(()=>errors.push("Missing JS chunks: _next/static/chunks"));
for(const file of ["draco/draco_decoder.wasm","draco/draco_wasm_wrapper.js","draco/draco_decoder.js"])await fs.access(path.join(root,file)).catch(()=>errors.push(`Missing Draco decoder file: ${file}`));
if(errors.length){console.error(errors.join("\n"));process.exitCode=1;}else console.log(`Export valid: 12 core pages, ${count} files, ${(bytes/1048576).toFixed(2)} MiB total.`);
