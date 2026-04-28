import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Share, Plus } from "lucide-react";
import logoFallback from "@/assets/logo-braland.svg";

const STORAGE_KEY = "install-prompt-shown";

/**
 * Visar ikonen i modalen med tre fallback-nivåer:
 *   1. /icons/icon-192.png (riktiga PWA-ikonen)
 *   2. SVG-loggan (importerad asset, alltid bundlad)
 *   3. Centrerad textinitial "B" på beige bakgrund — om även SVG misslyckas
 *      ser användaren fortfarande en snygg, igenkännbar ruta.
 */
const AppIconPreview = () => {
  const [stage, setStage] = useState<"png" | "svg" | "text">("png");
  const src = stage === "png" ? "/icons/icon-192.png" : logoFallback;

  if (stage === "text") {
    return (
      <div
        role="img"
        aria-label="Brålandsklockan"
        className="w-20 h-20 mx-auto rounded-xl border border-accent bg-primary flex items-center justify-center"
      >
        <span className="text-3xl font-semibold text-primary-foreground tracking-tight">B</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt="Brålandsklockan"
      width={80}
      height={80}
      loading="eager"
      decoding="async"
      className="w-20 h-20 mx-auto rounded-xl border border-accent bg-primary object-contain p-2"
      onError={() => setStage((s) => (s === "png" ? "svg" : "text"))}
    />
  );
};


interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const detectIOS = () => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPad på iPadOS 13+ rapporterar sig som Mac, men har touch
  const iPadOS = /Macintosh/.test(ua) && "ontouchend" in document;
  return /iPhone|iPad|iPod/.test(ua) || iPadOS;
};

const isStandalone = () => {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
};

const isInIframe = () => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};

const InstallAppModal = () => {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [hasNativePrompt, setHasNativePrompt] = useState(false);
  const isIOS = detectIOS();

  // Lyssna på beforeinstallprompt direkt vid mount
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      promptRef.current = e as BeforeInstallPromptEvent;
      setHasNativePrompt(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Visa modal en gång efter inloggning
  useEffect(() => {
    if (loading || !user) return;
    if (isInIframe() || isStandalone()) return; // aldrig i preview eller om redan installerad
    if (localStorage.getItem(STORAGE_KEY)) return;

    // Vänta lite så inloggningen hinner kännas klar
    const t = window.setTimeout(() => {
      // På icke-iOS: visa bara om vi har native prompt eller efter en kort grace
      if (isIOS || hasNativePrompt) {
        setOpen(true);
      } else {
        // Ge browsern lite extra tid att skicka beforeinstallprompt
        const t2 = window.setTimeout(() => {
          if (promptRef.current) {
            setHasNativePrompt(true);
            setOpen(true);
          }
        }, 2000);
        return () => window.clearTimeout(t2);
      }
    }, 1500);

    return () => window.clearTimeout(t);
  }, [loading, user, isIOS, hasNativePrompt]);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  };

  const installApp = async () => {
    const p = promptRef.current;
    if (!p) {
      dismiss();
      return;
    }
    try {
      await p.prompt();
      await p.userChoice;
    } catch {
      // ignore
    } finally {
      promptRef.current = null;
      setHasNativePrompt(false);
      dismiss();
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) dismiss(); }}>
      <SheetContent
        side="right"
        className="w-full max-w-full p-0 flex flex-col gap-0 sm:max-w-none md:max-w-md md:rounded-l-2xl"
      >
        <div className="flex-shrink-0 p-4 border-b border-border bg-card">
          <SheetTitle className="text-base font-semibold text-foreground">
            Installera Brålandsklockan
          </SheetTitle>
          <div className="text-sm text-muted-foreground mt-0.5">
            Få den på hemskärmen som en riktig app
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-center">
          <AppIconPreview />
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">
              Snabbare åtkomst varje dag
            </h2>
            <p className="text-sm text-muted-foreground">
              Lägg till Brålandsklockan på hemskärmen så öppnas den direkt — utan att starta webbläsaren först.
            </p>
          </div>

          {isIOS && (
            <div className="text-sm text-foreground bg-secondary rounded-xl p-4 text-left space-y-2">
              <p className="font-medium">Så lägger du till den på iPhone:</p>
              <ol className="space-y-1.5 list-decimal list-inside text-muted-foreground">
                <li>
                  Tryck på <span className="inline-flex items-center gap-1 font-semibold text-foreground"><Share className="h-4 w-4" />dela-ikonen</span> längst ner i Safari
                </li>
                <li>
                  Välj <span className="inline-flex items-center gap-1 font-semibold text-foreground"><Plus className="h-4 w-4" />Lägg till på hemskärmen</span>
                </li>
                <li>Tryck på <span className="font-semibold text-foreground">Lägg till</span> i hörnet</li>
              </ol>
            </div>
          )}

          {!isIOS && !hasNativePrompt && (
            <div className="text-sm text-muted-foreground bg-secondary rounded-xl p-4">
              Använd din webbläsares meny och välj <span className="font-semibold text-foreground">"Installera app"</span> eller <span className="font-semibold text-foreground">"Lägg till på hemskärmen"</span>.
            </div>
          )}
        </div>

        <div className="flex-shrink-0 flex gap-2 p-4 border-t border-border bg-card">
          <Button variant="outline" className="flex-1" onClick={dismiss}>
            {isIOS ? "Inte nu" : "Inte nu"}
          </Button>
          {!isIOS && hasNativePrompt && (
            <Button className="flex-1" onClick={installApp}>
              Installera
            </Button>
          )}
          {isIOS && (
            <Button className="flex-1" onClick={dismiss}>
              Klar
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default InstallAppModal;
