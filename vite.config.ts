import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// Bygg-version: YYYY.MM.DD.HHmm (lokal byggtid)
const APP_VERSION = (() => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}.${pad(
    d.getHours(),
  )}${pad(d.getMinutes())}`;
})();

// Korta release notes som visas i uppdateringsbannern. Redigeras i
// public/release-notes.txt – första raden används som "Vad är nytt".
const readReleaseNotes = (): string => {
  try {
    const raw = fs.readFileSync(
      path.resolve(__dirname, "public/release-notes.txt"),
      "utf8",
    );
    return raw.split("\n").map((l) => l.trim()).find((l) => l.length > 0) ?? "";
  } catch {
    return "";
  }
};

const buildVersionPayload = () =>
  JSON.stringify({ version: APP_VERSION, notes: readReleaseNotes() });

// Emitterar /version.json i bygget och serverar den i dev så
// klienten kan polla efter ny version.
const appVersionPlugin = () => ({
  name: "app-version-json",
  generateBundle() {
    // @ts-expect-error – this is bound to rollup plugin context
    this.emitFile({
      type: "asset",
      fileName: "version.json",
      source: buildVersionPayload(),
    });
  },
  configureServer(server: any) {
    server.middlewares.use("/version.json", (_req: any, res: any) => {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "no-store");
      res.end(buildVersionPayload());
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    appVersionPlugin(),
    VitePWA({
      registerType: "autoUpdate",
      // Disabled in dev so the service worker doesn't interfere with the Lovable preview iframe
      devOptions: {
        enabled: false,
      },
      includeAssets: [
        "favicon.ico",
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/icon-maskable-512.png",
        "icons/apple-touch-icon.png",
      ],
      // Use the existing public/manifest.json instead of generating one
      manifest: false,
      workbox: {
        navigateFallbackDenylist: [/^\/~oauth/, /^\/api/, /^\/version\.json/],
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        // Säkerställ att version.json aldrig cachas
        navigateFallbackAllowlist: [/^(?!.*version\.json).*$/],
        // Ny SW tar över omedelbart – ingen väntan på att alla flikar stängs
        skipWaiting: true,
        clientsClaim: true,
        // Rensa gamla precache-entries från tidigare builds
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // version.json: aldrig cacha – vi vill alltid se senaste
            urlPattern: ({ url }) => url.pathname === "/version.json",
            handler: "NetworkOnly",
          },
          {
            // Supabase REST/Auth: network-first with short timeout
            urlPattern: ({ url }) => url.origin.includes("supabase.co"),
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: "images",
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: ({ request }) =>
              request.destination === "style" ||
              request.destination === "script" ||
              request.destination === "font",
            handler: "StaleWhileRevalidate",
            options: { cacheName: "static-resources" },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
