import { spawnSync } from "node:child_process";
const env={...process.env,SITE_MODE:"production"};
// >>> CMS (showcase Part 3): index the content entries and write the upload variants first, as npm run build does.
for(const script of ["scripts/build-content-index.mjs","scripts/build-upload-variants.mjs"]){const step=spawnSync(process.execPath,[script],{env,stdio:"inherit"});if(step.status!==0)process.exit(step.status||1);}
// <<< CMS
const checks=spawnSync(process.execPath,["--experimental-strip-types","scripts/check-content.mjs","--production"],{env,stdio:"inherit"});
if(checks.status!==0)process.exit(checks.status||1);
if(!env.NEXT_PUBLIC_TURNSTILE_SITE_KEY||/^[123]x0+/.test(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY))throw new Error("A production Turnstile site key is required.");
for(const args of [["node_modules/next/dist/bin/next","build"],["scripts/package-site.mjs"],["scripts/check-export.mjs"]]){
  const result=spawnSync(process.execPath,args,{env,stdio:"inherit"});if(result.status!==0)process.exit(result.status||1);
}
