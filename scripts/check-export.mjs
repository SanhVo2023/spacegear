import fs from "node:fs/promises";
import path from "node:path";
const root="dist";const errors=[];let bytes=0;let count=0;
async function walk(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())await walk(file);else{count++;const stat=await fs.stat(file);bytes+=stat.size;const relative=path.relative(root,file).replaceAll("\\","/");if(stat.size>25*1024*1024)errors.push(`Oversized asset: ${relative}`);if(/gen-raw|assets\/source|\.env|\.map$|images\/(team|reviews|labs)|earth-4k|models\/earth\.glb|seo\/og\.jpg|vercel\.svg|next\.svg/.test(relative))errors.push(`Excluded source/template asset: ${relative}`);}}}
await walk(root);
for(const route of ["","services","services/digital-transformation","services/ai-strategy","services/applied-ai","services/automation-integration","services/product-delivery","about","approach","contact","privacy","terms"]){
  const file=path.join(root,route,"index.html");try{const html=await fs.readFile(file,"utf8");if(!html.includes("spacegear.tech"))errors.push(`Missing identity: ${route}`);if((html.match(/<h1(?:\s|>)/g)||[]).length!==1)errors.push(`H1 count: ${route}`);if(!html.includes('rel="canonical"'))errors.push(`No canonical: ${route}`);if(/hello@platform\.nl|Platform®|Platform B\.V\.|Book a Demo|97\.8/.test(html))errors.push(`Old identity: ${route}`);}catch{errors.push(`Missing HTML: ${route}`);}
}
await fs.access(path.join(root,"404.html")).catch(()=>errors.push("Missing 404"));
if(errors.length){console.error(errors.join("\n"));process.exitCode=1;}else console.log(`Export valid: 12 core pages, ${count} files, ${(bytes/1048576).toFixed(2)} MiB total.`);
