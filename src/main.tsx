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
        registerSW({ immediate: true });
      })
      .catch(() => {
        /* no-op om plugin inte är aktiv */
      });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
