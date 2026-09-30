import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import sharp from "sharp";

const configured = process.argv[2] === "configured";
const dir = configured ? "quality-evidence" : "quality-evidence-no-env";
for (const surface of [
  "home",
  "explore-empty",
  "explore-search",
  "title-detail",
]) {
  for (const profile of ["desktop", "mobile"]) {
    const file = `${dir}/${configured ? "configured-" : ""}perf-${surface}-${profile}.json`;
    const evidence = JSON.parse(await readFile(file, "utf8"));
    assert.equal(evidence.runs, 3, `${file}: all repetitions required`);
    assert.equal(evidence.samples?.length, 3, `${file}: raw samples required`);
    if (configured) {
      assert(
        evidence.artworkRequestsMedian > 0,
        `${file}: artwork requests required`,
      );
      assert(
        evidence.samples.every((sample) =>
          sample.images.some(
            (image) => image.inInitialViewport && image.naturalWidth > 0,
          ),
        ),
        `${file}: loaded artwork required`,
      );
    }
  }
  if (!configured) await stat(`${dir}/a11y-${surface}.json`);
}
if (configured) {
  for (const name of [
    "configured-save-dialog-open",
    "configured-reflow-320",
    "configured-zoom-200",
    "configured-reduced-motion",
    "configured-contrast",
    "a11y-save-dialog",
  ]) {
    const body = JSON.parse(await readFile(`${dir}/${name}.json`, "utf8"));
    assert(Object.keys(body).length > 0, `${name}: empty evidence`);
  }
  for (const surface of [
    "home",
    "explore-empty",
    "explore-search",
    "title-detail",
    "save-dialog",
  ]) {
    for (const profile of ["desktop", "mobile"]) {
      const file = `portfolio-screenshots/${surface}-${profile}.png`;
      assert((await stat(file)).size > 4096, `${file}: empty screenshot`);
      const image = await sharp(file).metadata();
      assert(
        image.width > 300 && image.height > 300,
        `${file}: invalid dimensions`,
      );
    }
  }
}
console.log(
  `Required ${configured ? "configured-fixture" : "no-env"} artifacts are complete.`,
);
