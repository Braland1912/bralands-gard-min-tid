import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn } from "@/lib/utils";
import { useOverlayScrollGuard } from "@/hooks/useOverlayScrollGuard";

const PopoverOpenContext = React.createContext<boolean>(false);

const Popover: React.FC<React.ComponentProps<typeof PopoverPrimitive.Root>> = ({
  open,
  defaultOpen,
  onOpenChange,
  ...props
}) => {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen ?? false);
  const isControlled = open !== undefined;
  const currentOpen = isControlled ? open : internalOpen;
  return (
    <PopoverOpenContext.Provider value={!!currentOpen}>
      <PopoverPrimitive.Root
        open={open}
        defaultOpen={defaultOpen}
        onOpenChange={(o) => {
          if (!isControlled) setInternalOpen(o);
          onOpenChange?.(o);
        }}
        {...props}
      />
    </PopoverOpenContext.Provider>
  );
};

const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => {
  const open = React.useContext(PopoverOpenContext);
  const guard = useOverlayScrollGuard(open);
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={8}
        onOpenAutoFocus={(e) => {
          // Förhindra autoscroll till första fokuserade elementet på mobil
          e.preventDefault();
        }}
        onCloseAutoFocus={guard.onCloseAutoFocus}
        onPointerDownOutside={guard.onPointerDownOutside}
        className={cn(
          "z-50 w-72 max-w-[calc(100vw-1rem)] max-h-[min(80svh,28rem)] overflow-auto overscroll-contain touch-pan-y rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none pointer-events-auto data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
});
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent };
