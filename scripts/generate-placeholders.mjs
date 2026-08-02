// One-shot generator for local placeholder artwork used by the mock data layer.
// Kept as an .mjs script (not TS) so it needs no build step. Re-run with
// `node scripts/generate-placeholders.mjs` if the mock catalog changes.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const posters = [
  ["afterglow", "Afterglow", "#3d1f4f", "#f0a97a"],
  ["paperlantern", "Paper Lantern", "#22334d", "#e8c07d"],
  ["lowcountry", "Low Country", "#0f1b1a", "#88b4a1"],
  ["northlight", "Northlight", "#0e1f3a", "#a78bff"],
  ["gildedroom", "The Gilded Room", "#2b1a0e", "#d9a76b"],
  ["smallhours", "The Small Hours", "#1a1420", "#c7bfd6"],
  ["orbitalnotes", "Orbital Notes", "#0f1a24", "#7fb2d1"],
  ["brightindex", "The Bright Index", "#241a2e", "#f2c26b"],
];

const backdrops = [
  ["afterglow", "#3d1f4f", "#0b0b0f", "#f0a97a"],
  ["northlight", "#0e1f3a", "#0b0b0f", "#a78bff"],
  ["brightindex", "#241a2e", "#0b0b0f", "#f2c26b"],
];

const avatars = [
  ["ari", "AO", "#3a2450"],
  ["mira", "MB", "#1e3a3a"],
  ["jules", "JM", "#3a2a1e"],
];

function posterSvg(title, bg, accent) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600" role="img" aria-label="${title}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${bg}"/>
      <stop offset="1" stop-color="#0b0b0f"/>
    </linearGradient>
  </defs>
  <rect width="400" height="600" fill="url(#g)"/>
  <circle cx="200" cy="230" r="90" fill="${accent}" opacity="0.15"/>
  <circle cx="200" cy="230" r="46" fill="${accent}" opacity="0.9"/>
  <text x="200" y="520" text-anchor="middle" font-family="Georgia, serif" font-size="30" fill="#f4efe6">${title}</text>
</svg>`;
}

function backdropSvg(bg1, bg2, accent) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" role="img" aria-hidden="true">
  <defs>
    <radialGradient id="r" cx="30%" cy="40%" r="70%">
      <stop offset="0" stop-color="${accent}" stop-opacity="0.45"/>
      <stop offset="1" stop-color="${bg2}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="l" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${bg1}"/>
      <stop offset="1" stop-color="${bg2}"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#l)"/>
  <rect width="1600" height="900" fill="url(#r)"/>
</svg>`;
}

function avatarSvg(initials, bg) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="${initials}">
  <rect width="128" height="128" fill="${bg}"/>
  <text x="64" y="78" text-anchor="middle" font-family="Georgia, serif" font-size="52" fill="#f4efe6">${initials}</text>
</svg>`;
}

const root = new URL("..", import.meta.url).pathname;
const posterDir = join(root, "public/media/posters");
const backdropDir = join(root, "public/media/backdrops");
const avatarDir = join(root, "public/media/avatars");
mkdirSync(posterDir, { recursive: true });
mkdirSync(backdropDir, { recursive: true });
mkdirSync(avatarDir, { recursive: true });

for (const [slug, title, bg, accent] of posters) {
  writeFileSync(join(posterDir, `${slug}.svg`), posterSvg(title, bg, accent));
}
for (const [slug, bg1, bg2, accent] of backdrops) {
  writeFileSync(join(backdropDir, `${slug}.svg`), backdropSvg(bg1, bg2, accent));
}
for (const [slug, initials, bg] of avatars) {
  writeFileSync(join(avatarDir, `${slug}.svg`), avatarSvg(initials, bg));
}

console.log(
  `Generated ${posters.length} posters, ${backdrops.length} backdrops, ${avatars.length} avatars.`,
);
