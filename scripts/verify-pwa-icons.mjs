#!/usr/bin/env node
/**
 * Verifierar att alla ikoner som manifestet refererar till finns på disk.
 * Körs som "prebuild" så vi aldrig publicerar en app med trasiga ikoner.
 * Vid saknad ikon: kopiera in en standard-fallback (warm beige bg + logga)
 * och varna i konsolen.
 */
import { existsSync, copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const publicDir = join(root, "public");
const manifestPath = join(publicDir, "manifest.json");

if (!existsSync(manifestPath)) {
  console.warn("[verify-pwa-icons] Inget manifest.json — hoppar över check.");
  process.exit(0);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const icons = [
  ...(manifest.icons ?? []).map((i) => i.src),
  "/icons/apple-touch-icon.png",
];

// Hitta första existerande ikon att använda som fallback
const fallbackCandidates = [
  "/icons/icon-512.png",
  "/icons/icon-192.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
];
const fallbackSrc = fallbackCandidates
  .map((p) => join(publicDir, p))
  .find((p) => existsSync(p));

let missing = 0;
let recovered = 0;

for (const rel of icons) {
  const abs = join(publicDir, rel);
  if (existsSync(abs)) continue;

  missing++;
  if (fallbackSrc) {
    mkdirSync(dirname(abs), { recursive: true });
    copyFileSync(fallbackSrc, abs);
    recovered++;
    console.warn(
      `[verify-pwa-icons] Saknad: ${rel} → kopierade fallback från ${fallbackSrc.replace(publicDir, "")}`,
    );
  } else {
    console.error(`[verify-pwa-icons] Saknad: ${rel} och ingen fallback finns!`);
  }
}

if (missing === 0) {
  console.log(`[verify-pwa-icons] OK — alla ${icons.length} ikoner finns.`);
} else if (recovered === missing) {
  console.warn(
    `[verify-pwa-icons] ${recovered}/${missing} ikoner återställdes från fallback. Ersätt dem med riktiga ikoner.`,
  );
} else {
  console.error(`[verify-pwa-icons] ${missing - recovered} ikon(er) saknas helt!`);
  process.exit(1);
}
