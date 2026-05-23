/**
 * Aktuell appversion – bakas in i bundlen vid build via vite.config.ts.
 * Format: YYYY.MM.DD.HHmm
 */
export const APP_VERSION: string =
  typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";

/**
 * Rensa alla service-worker caches och avregistrera SW, sedan hård-reload
 * med cache-bust. Används av "Uppdatera nu"-knappen.
 */
export async function forceAppUpdate(): Promise<void> {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }
  } catch {
    // Ignorera – vi laddar ändå om nedan
  }
  const url = new URL(window.location.href);
  url.searchParams.set("v", Date.now().toString());
  window.location.replace(url.toString());
}
