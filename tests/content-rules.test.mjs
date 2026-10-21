// Rules check-content reports for how editors use the CMS (scripts/lib/content-rules.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { load } from "js-yaml";
import { stageNumberProblems } from "../scripts/lib/content-rules.mjs";
import { projectTempDir, removeProjectTemp } from "./helpers/project-temp.mjs";

const { ENGAGEMENTS } = await import("../src/lib/content.ts");

test("engagement stage numbers follow the list order", () => {
  assert.deepEqual(stageNumberProblems(ENGAGEMENTS), [], "today's engagements are 01, 02, 03 in order");
  const swapped = [ENGAGEMENTS[1], ENGAGEMENTS[0], ENGAGEMENTS[2]];
  assert.deepEqual(stageNumberProblems(swapped), [
    `content/engagements: "${ENGAGEMENTS[1].name}" is number 1 in the list but its stage number is "02"; keep stage numbers in list order (01, 02, 03…): set it to "01"`,
    `content/engagements: "${ENGAGEMENTS[0].name}" is number 2 in the list but its stage number is "01"; keep stage numbers in list order (01, 02, 03…): set it to "02"`,
  ]);
  const config = load(fs.readFileSync("public/admin/config.yml", "utf8"));
  const field = config.collections.find((collection) => collection.name === "engagements").fields.find((item) => item.name === "stageNo");
  assert.match(field.hint, /Keep stage numbers in list order/, "the CMS field says so too");
});

test("check-content reports engagements dragged out of stage order, and changes no file (temporary project)", () => {
  const root = projectTempDir("check-stages-");
  try {
    for (const dir of ["content", "src/lib", "scripts/lib", "public/images"]) fs.cpSync(dir, path.join(root, dir), { recursive: true });
    for (const file of ["scripts/check-content.mjs", "scripts/build-content-index.mjs"]) fs.copyFileSync(file, path.join(root, file));
    fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ type: "module" }));
    // What dragging "Embed & improve" to the top does: the CMS renumbers order 1, 2, 3.
    const files = ["improve.json", "assess.json", "build.json"];
    const before = {};
    files.forEach((file, index) => {
      const full = path.join(root, "content", "engagements", file);
      const data = JSON.parse(fs.readFileSync(full, "utf8"));
      data.order = index + 1;
      fs.writeFileSync(full, `${JSON.stringify(data, null, 2)}\n`);
      before[file] = fs.readFileSync(full, "utf8");
    });
    const env = { ...process.env, SITE_MODE: "preview", NEXT_PUBLIC_SHOW_SAMPLES: "" };
    const result = spawnSync(process.execPath, ["--experimental-strip-types", path.join(root, "scripts", "check-content.mjs")], { cwd: path.join(root, "src"), encoding: "utf8", env });
    assert.equal(result.status, 1, result.stdout);
    const listed = result.stderr.split(/\r?\n/).filter((line) => line.startsWith("  - ")).map((line) => line.slice(4));
    assert.deepEqual(listed.filter((line) => line.includes("stage number")).map((line) => line.replace(/: set it to .*$/, "")), [
      'content/engagements: "Embed & improve" is number 1 in the list but its stage number is "03"; keep stage numbers in list order (01, 02, 03…)',
      'content/engagements: "Assess & prioritize" is number 2 in the list but its stage number is "01"; keep stage numbers in list order (01, 02, 03…)',
      'content/engagements: "Validate & build" is number 3 in the list but its stage number is "02"; keep stage numbers in list order (01, 02, 03…)',
    ]);
    for (const file of files) assert.equal(fs.readFileSync(path.join(root, "content", "engagements", file), "utf8"), before[file], `${file} is left as it was`);
  } finally { removeProjectTemp(root); }
});
