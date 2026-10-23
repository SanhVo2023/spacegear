import { spawnSync } from "node:child_process";
import { RELEASE_ENV_FILE, loadReleaseEnv, withReleaseDefaults } from "./lib/release-env.mjs";
// The public production values come from release.env; a variable set (not empty) in the environment wins.
const release=withReleaseDefaults(process.env,loadReleaseEnv());
const env={...release.env,SITE_MODE:"production"};
console.log(`Build variables: ${Object.entries(release.sources).map(([key,source])=>`${key} from ${source==="environment"?"the environment":RELEASE_ENV_FILE}`).join(", ")}.`);
// >>> CMS (showcase Part 3): index the content entries and write the upload variants first, as npm run build does.
for(const script of ["scripts/build-content-index.mjs","scripts/build-upload-variants.mjs"]){const step=spawnSync(process.execPath,[script],{env,stdio:"inherit"});if(step.status!==0)process.exit(step.status||1);}
// <<< CMS
const checks=spawnSync(process.execPath,["--experimental-strip-types","scripts/check-content.mjs","--production"],{env,stdio:"inherit"});
if(checks.status!==0)process.exit(checks.status||1);
if(!env.NEXT_PUBLIC_TURNSTILE_SITE_KEY||/^[123]x0+/.test(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY))throw new Error("A production Turnstile site key is required.");
for(const args of [["node_modules/next/dist/bin/next","build"],["scripts/package-site.mjs"],["scripts/check-export.mjs"]]){
  const result=spawnSync(process.execPath,args,{env,stdio:"inherit"});if(result.status!==0)process.exit(result.status||1);
}
