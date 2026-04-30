import * as React from "react";

/**
 * Skyddar Radix-overlays (Select/Popover/DropdownMenu) mot två vanliga
 * mobilbuggar:
 *
 * 1. När bakgrunden scrollas snabbt hamnar overlayen "fel" — vi stänger den
 *    direkt så att användaren slipper trycka i tomma luften.
 * 2. Touch-scroll på iOS/Android genererar ofta ett "ghost click" ~300ms
 *    senare. Vi ignorerar pointerdown-händelser i det fönstret så att
 *    listan inte stängs eller väljer fel rad.
 *
 * Returnerar handlers som kan spridas på Radix Content-komponenten.
 */
export function useOverlayScrollGuard(open: boolean | undefined) {
  const lastTouchScrollAt = React.useRef(0);

  React.useEffect(() => {
    if (!open) return;

    const onTouchMove = () => {
      lastTouchScrollAt.current = Date.now();
    };
    const onScroll = (e: Event) => {
      // Stäng inte om scrollen sker INNE i overlayen — bara om sidan rör sig
      const target = e.target as HTMLElement | Document | null;
      if (target instanceof HTMLElement) {
        if (
          target.closest(
            "[data-radix-select-content],[data-radix-popover-content],[data-radix-dropdown-menu-content],[data-radix-popper-content-wrapper]",
          )
        ) {
          return;
        }
      }
      lastTouchScrollAt.current = Date.now();
    };

    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("scroll", onScroll, { capture: true } as any);
    };
  }, [open]);

  const onPointerDownOutside = React.useCallback((e: any) => {
    const target = e?.target as HTMLElement | null;
    // Råkar trycka på en scroll-yta? Behåll menyn öppen.
    if (target?.closest("[data-radix-scroll-area-viewport]")) {
      e.preventDefault();
      return;
    }
    // Ghost-klick efter touch-scroll: ignorera
    if (Date.now() - lastTouchScrollAt.current < 300) {
      e.preventDefault();
    }
  }, []);

  const onCloseAutoFocus = React.useCallback((e: Event) => {
    // Förhindra fokus-skutt när menyn stängs (annars hoppar viewporten)
    e.preventDefault();
  }, []);

  return { onPointerDownOutside, onCloseAutoFocus };
}
