import * as React from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TimePickerProps {
  value: string; // "HH:mm" or ""
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minuteStep?: number;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function TimePicker({
  value,
  onChange,
  placeholder = "Välj tid",
  className,
  minuteStep = 5,
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [h, m] = value ? value.split(":").map(Number) : [null, null];
  const selectedH = h ?? -1;
  const selectedM = m ?? -1;

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => i * minuteStep);

  const setPart = (newH: number, newM: number) => {
    onChange(`${pad(newH)}:${pad(newM)}`);
  };

  const hourRef = React.useRef<HTMLDivElement>(null);
  const minRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    // Scroll selected into view
    requestAnimationFrame(() => {
      hourRef.current?.querySelector<HTMLElement>("[data-selected='true']")?.scrollIntoView({ block: "center" });
      minRef.current?.querySelector<HTMLElement>("[data-selected='true']")?.scrollIntoView({ block: "center" });
    });
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "h-12 w-full justify-start font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <Clock className="mr-2 h-4 w-4 opacity-60" />
          {value || placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
        <div className="flex h-60">
          <ScrollArea className="h-full">
            <div ref={hourRef} className="flex flex-col p-1 w-16">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground text-center pb-1 pt-0.5">
                Tim
              </div>
              {hours.map((hour) => {
                const isSel = hour === selectedH;
                return (
                  <button
                    key={hour}
                    type="button"
                    data-selected={isSel}
                    onClick={() => setPart(hour, selectedM === -1 ? 0 : selectedM)}
                    className={cn(
                      "h-9 rounded-md text-sm tabular-nums transition-colors",
                      isSel
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    {pad(hour)}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
          <div className="w-px bg-border" />
          <ScrollArea className="h-full">
            <div ref={minRef} className="flex flex-col p-1 w-16">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground text-center pb-1 pt-0.5">
                Min
              </div>
              {minutes.map((minute) => {
                const isSel = minute === selectedM;
                return (
                  <button
                    key={minute}
                    type="button"
                    data-selected={isSel}
                    onClick={() => setPart(selectedH === -1 ? new Date().getHours() : selectedH, minute)}
                    className={cn(
                      "h-9 rounded-md text-sm tabular-nums transition-colors",
                      isSel
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    {pad(minute)}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>
        <div className="flex items-center justify-between border-t p-2 gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
          >
            Rensa
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => setOpen(false)}
            disabled={!value}
          >
            Klar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
