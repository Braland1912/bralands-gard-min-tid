import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// --- PWA / Service Worker hantering ---------------------------------------
// I Lovables editor-preview körs appen i en iframe på *.lovableproject.com /
// id-preview--*. En aktiv service worker där cachear gammal kod och bryter
// navigering. Vi avregistrerar därför alla SW i de miljöerna och registrerar
// bara i prod-build på riktig domän.
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const isPreviewHost =
  typeof window !== "undefined" &&
  (window.location.hostname.includes("id-preview--") ||
    window.location.hostname.includes("lovableproject.com") ||
    window.location.hostname.includes("lovable.dev"));

if (isPreviewHost || isInIframe) {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister());
    });
  }
} else if (import.meta.env.PROD) {
  // Registrera service worker först efter load så start-rendern inte blockeras
  window.addEventListener("load", () => {
    import("virtual:pwa-register")
      .then(({ registerSW }) => {
        const updateSW = registerSW({
          immediate: true,
          onNeedRefresh() {
            // Ny SW installerad och väntar → aktivera direkt och ladda om
            updateSW(true);
          },
        });

        if ("serviceWorker" in navigator) {
          // När SW-controllern byts (t.ex. efter skipWaiting) → hård-reload
          // så att appen kör den nya koden – kritiskt för PWA på hemskärmen.
          let refreshing = false;
          navigator.serviceWorker.addEventListener("controllerchange", () => {
            if (refreshing) return;
            refreshing = true;
            window.location.reload();
          });

          // Trigga update-check varje gång appen får fokus / blir synlig.
          // I standalone-läge (hemskärm) räcker det inte att lita på att
          // registrerad SW själv pollar – vi tvingar en check.
          const checkForUpdate = async () => {
            try {
              const reg = await navigator.serviceWorker.getRegistration();
              await reg?.update();
            } catch {
              /* ignore */
            }
          };
          window.addEventListener("focus", checkForUpdate);
          document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") checkForUpdate();
          });
        }
      })
      .catch(() => {
        /* no-op om plugin inte är aktiv */
      });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
