import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  UserCheck,
  MapPinPlus,
  CreditCard,
  ChevronRight,
  ChevronDown,
  Calendar,
  Car,
  Tent,
  Globe,
  StickyNote,
  Zap,
} from "lucide-react";
import {
  type EveningRoundGuest,
  VEHICLE_TYPE_LABELS,
  formatDateLabel,
} from "@/hooks/useEveningRoundGuests";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prepaidGuests: EveningRoundGuest[];
  /** Användaren valde att lägga till en helt ny gäst på en ny tillfällig plats. */
  onPickNewGuest: () => void;
  /** Användaren valde att koppla en redan förbetald gäst till en ny tillfällig plats. */
  onPickPrepaid: (guest: EveningRoundGuest) => void;
}

/**
 * Mellandialog som visas när användaren trycker "Lägg till plats".
 * Två tabbar:
 *  1) Förbetald – välj en redan förbetald gäst som dykt upp.
 *  2) Ny gäst – registrera en helt ny gäst på platsen.
 */
const AddPlaceChoiceDialog = ({
  open,
  onOpenChange,
  prepaidGuests,
  onPickNewGuest,
  onPickPrepaid,
}: Props) => {
  const hasPrepaid = prepaidGuests.length > 0;
  const [tab, setTab] = useState<"prepaid" | "new">(hasPrepaid ? "prepaid" : "new");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // När dialogen öppnas, defaulta till förbetald om det finns sådana, annars ny gäst.
  useEffect(() => {
    if (open) {
      setTab(hasPrepaid ? "prepaid" : "new");
      setExpandedId(null);
    }
  }, [open, hasPrepaid]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Lägg till plats</DialogTitle>
          <DialogDescription>
            Koppla en förbetald gäst eller lägg till en helt ny.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "prepaid" | "new")}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="prepaid">
              Förbetald{hasPrepaid ? ` (${prepaidGuests.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="new">Ny gäst</TabsTrigger>
          </TabsList>

          <TabsContent value="prepaid" className="mt-3">
            {!hasPrepaid ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Inga omatchade förbetalda just nu.
              </div>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {prepaidGuests.map((g) => {
                  const label =
                    g.guest_name ||
                    g.registration_number ||
                    (g.accommodation_type === "tent" ? "Tält" : "Gäst");
                  const isOpen = expandedId === g.id;
                  const vehicleLabel =
                    g.accommodation_type === "tent"
                      ? `Tält${g.tent_persons ? ` (${g.tent_persons} pers)` : ""}`
                      : g.vehicle_type
                      ? VEHICLE_TYPE_LABELS[g.vehicle_type]
                      : "Fordon";
                  return (
                    <div
                      key={g.id}
                      className="rounded-xl border border-sky-200 bg-card overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedId(isOpen ? null : g.id)}
                        className="w-full text-left p-3 hover:bg-sky-50 transition-colors flex items-center gap-3"
                      >
                        <div className="h-9 w-9 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                          {g.accommodation_type === "tent" ? (
                            <Tent className="h-4 w-4" />
                          ) : (
                            <UserCheck className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-foreground truncate">
                            {label}
                          </div>
                          {(g.registration_number || g.nationality) && (
                            <div className="text-[11px] text-muted-foreground truncate">
                              {[g.registration_number, g.nationality].filter(Boolean).join(" · ")}
                            </div>
                          )}
                        </div>
                        {g.payment_amount != null && (
                          <span className="text-[11px] text-sky-800 shrink-0 inline-flex items-center gap-0.5">
                            <CreditCard className="h-3 w-3" />
                            {g.payment_amount} {g.payment_currency ?? "kr"}
                          </span>
                        )}
                        <ChevronDown
                          className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${
                            isOpen ? "rotate-180" : ""
                          }`}
                        />
                      </button>

                      {isOpen && (
                        <div className="border-t border-sky-200 bg-sky-50/40 p-3 space-y-2">
                          <div className="grid grid-cols-1 gap-1.5 text-xs text-foreground">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span>
                                {formatDateLabel(g.arrival_date)} → {formatDateLabel(g.departure_date)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {g.accommodation_type === "tent" ? (
                                <Tent className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              ) : (
                                <Car className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              )}
                              <span>
                                {vehicleLabel}
                                {g.registration_number ? ` · ${g.registration_number}` : ""}
                                {g.trailer_registration ? ` + släp ${g.trailer_registration}` : ""}
                              </span>
                            </div>
                            {g.has_electricity != null && (
                              <div className="flex items-center gap-2">
                                <Zap className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span>{g.has_electricity ? "Med el" : "Utan el"}</span>
                              </div>
                            )}
                            {g.nationality && (
                              <div className="flex items-center gap-2">
                                <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span>{g.nationality}</span>
                              </div>
                            )}
                            {g.payment_amount != null && (
                              <div className="flex items-center gap-2">
                                <CreditCard className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span>
                                  Betalt {g.payment_amount} {g.payment_currency ?? "kr"}
                                  {g.payment_method ? ` · ${g.payment_method}` : ""}
                                </span>
                              </div>
                            )}
                            {g.notes && (
                              <div className="flex items-start gap-2">
                                <StickyNote className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                                <span className="whitespace-pre-wrap">{g.notes}</span>
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => onPickPrepaid(g)}
                            className="w-full mt-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold py-2 px-3 inline-flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <MapPinPlus className="h-4 w-4" />
                            Koppla till plats
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="new" className="mt-3">
            <button
              type="button"
              onClick={() => onPickNewGuest()}
              className="w-full text-left rounded-xl border border-border bg-card hover:bg-accent p-4 transition-colors flex items-center gap-3"
            >
              <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <MapPinPlus className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-foreground">
                  Lägg till ny gäst
                </div>
                <div className="text-xs text-muted-foreground">
                  Registrera en ny gäst på en tillfällig plats
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default AddPlaceChoiceDialog;
