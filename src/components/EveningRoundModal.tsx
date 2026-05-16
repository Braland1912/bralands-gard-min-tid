import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, MoreVertical, Trash2, X } from "lucide-react";
import {
  type EveningRoundGuest,
  type GuestInput,
  type PaymentMethod,
  type Currency,
  type AccommodationType,
  PAYMENT_LABELS,
} from "@/hooks/useEveningRoundGuests";
import { NATIONALITIES, OTHER_CODE, flagUrl, parseNationality } from "@/lib/nationalities";

const CURRENCIES: Currency[] = ["SEK", "EUR", "NOK"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placeLabel: string | null;
  guest: EveningRoundGuest | null;
  defaultDate: string;
  onSave: (input: GuestInput) => Promise<unknown> | void;
  onDelete?: (id: string) => Promise<unknown> | void;
  availablePlaces?: string[];
  takenPlaces?: string[];
  /** Skapa en ny extra plats (namngiven). Returnerar etiketten som skapades. */
  onAddPlace?: (label: string) => Promise<string>;
}

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const tomorrowLocal = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const addDaysLocal = (iso: string, days: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};

const EveningRoundModal = ({
  open,
  onOpenChange,
  placeLabel,
  guest,
  defaultDate,
  onSave,
  onDelete,
  availablePlaces,
  takenPlaces,
  onAddPlace,
}: Props) => {
  const [pickedPlace, setPickedPlace] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [reg, setReg] = useState("");
  const [notes, setNotes] = useState("");
  const [nationality, setNationality] = useState("");
  const [nationalityOther, setNationalityOther] = useState("");
  const [natOpen, setNatOpen] = useState(false);
  const [arrival, setArrival] = useState(defaultDate || todayLocal());
  const [departure, setDeparture] = useState(tomorrowLocal());
  const [method, setMethod] = useState<PaymentMethod | "none">("none");
  const [amount, setAmount] = useState<string>("");
  const [currency, setCurrency] = useState<Currency>("SEK");
  const [otherNote, setOtherNote] = useState<string>("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newPlaceLabel, setNewPlaceLabel] = useState("");
  const [creatingPlace, setCreatingPlace] = useState(false);
  const [accommodation, setAccommodation] = useState<AccommodationType>("vehicle");
  const [editingPlace, setEditingPlace] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPickedPlace(null);
    setEditingPlace(false);
    setNewPlaceLabel("");
    if (guest) {
      setName(guest.guest_name);
      setReg(guest.registration_number ?? "");
      setNotes(guest.notes ?? "");
      const parsed = parseNationality(guest.nationality);
      setNationality(parsed?.code ?? "");
      setNationalityOther(parsed?.code === OTHER_CODE ? parsed.custom ?? "" : "");
      setArrival(guest.arrival_date);
      setDeparture(guest.departure_date);
      setMethod(guest.payment_method ?? "none");
      setAmount(guest.payment_amount != null ? String(guest.payment_amount) : "");
      setCurrency((guest.payment_currency as Currency) ?? "SEK");
      setOtherNote(guest.payment_other_note ?? "");
      setAccommodation((guest.accommodation_type as AccommodationType) ?? "vehicle");
    } else {
      setName("");
      setReg("");
      setNotes("");
      setNationality("");
      setNationalityOther("");
      setArrival(defaultDate || todayLocal());
      setDeparture(tomorrowLocal());
      setMethod("none");
      setAmount("");
      setCurrency("SEK");
      setOtherNote("");
      setAccommodation("vehicle");
    }
    setError(null);
  }, [open, guest, defaultDate]);

  const place = pickedPlace ?? guest?.place_label ?? placeLabel ?? null;
  const hasPlaceOptions = Array.isArray(availablePlaces) && availablePlaces.length > 0;
  const showPlacePicker = place == null && hasPlaceOptions;
  const canEditPlace = !!guest && hasPlaceOptions;
  const showEditPlacePicker = editingPlace && hasPlaceOptions;
  const takenSet = new Set(
    (takenPlaces ?? []).filter((p) => !guest || p !== guest.place_label),
  );
  const isCash = method === "K";
  const isOther = method === "O";

  // Live-validering av datum: visa fel direkt när avresa är samma dag som ankomst
  // eller tidigare. Tomma fält flaggas inte här (de fångas vid spara).
  const dateError: string | null =
    arrival && departure && departure <= arrival
      ? departure === arrival
        ? "Avresa måste vara minst en natt efter ankomst"
        : "Avresa kan inte vara före ankomst"
      : null;

  const handleSave = async () => {
    setError(null);
    if (!arrival || !departure) {
      setError("Ange ankomst och avresa");
      return;
    }
    if (departure <= arrival) {
      setError("Avresa måste vara efter ankomst");
      return;
    }
    if (place == null && !showPlacePicker) {
      setError("Välj en plats");
      return;
    }
    const amt = amount.trim() === "" ? null : Number(amount);
    if (amt != null && (Number.isNaN(amt) || amt < 0)) {
      setError("Ogiltigt belopp");
      return;
    }
    if (isOther && !otherNote.trim()) {
      setError("Beskriv betalningsmetoden");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        place_label: place,
        guest_name: name.trim(),
        registration_number: accommodation === "tent" ? null : (reg.trim() || null),
        arrival_date: arrival,
        departure_date: departure,
        payment_method: method === "none" ? null : method,
        payment_amount: amt,
        payment_currency: method === "none" ? null : isCash ? currency : "SEK",
        notes: notes.trim() || null,
        nationality:
          nationality === OTHER_CODE
            ? nationalityOther.trim()
              ? `${OTHER_CODE}:${nationalityOther.trim()}`
              : OTHER_CODE
            : nationality.trim() || null,
        payment_other_note: isOther ? otherNote.trim() : null,
        accommodation_type: accommodation,
      });
      onOpenChange(false);
    } catch (e: any) {
      setError(e?.message ?? "Kunde inte spara");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="p-0 gap-0 w-full sm:max-w-md max-h-[100dvh] sm:max-h-[90vh] h-[100dvh] sm:h-auto rounded-none sm:rounded-2xl flex flex-col">
          <DialogHeader className="px-4 pt-4 pb-3 border-b border-border shrink-0 space-y-1">
            <div className="flex items-start justify-between gap-2 pr-8">
              <div className="min-w-0 flex-1">
                <DialogTitle>{guest ? "Redigera gäst" : "Lägg till gäst"}</DialogTitle>
                <DialogDescription>
                  {place != null ? (
                    <span className="inline-flex items-center gap-2">
                      <span>Plats {place}</span>
                      {canEditPlace && !editingPlace && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPlace(true);
                            setPickedPlace(null);
                          }}
                          className="text-xs text-primary underline underline-offset-2"
                        >
                          Ändra plats
                        </button>
                      )}
                    </span>
                  ) : showPlacePicker ? (
                    "Välj plats (valfritt – kan väljas senare)"
                  ) : (
                    ""
                  )}
                </DialogDescription>
              </div>
              {guest && onDelete && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="-mt-1 mr-6" aria-label="Mer">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setConfirmDelete(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Radera gäst
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
            {showEditPlacePicker && (
              <div className="space-y-2 rounded-xl border border-border bg-muted/40 p-3">
                <div className="flex items-center justify-between">
                  <Label>Välj ny plats</Label>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPlace(false);
                      setPickedPlace(null);
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Avbryt
                  </button>
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                  {availablePlaces!.map((p) => {
                    const taken = takenSet.has(p);
                    const isCurrent = guest?.place_label === p && !pickedPlace;
                    const isPicked = pickedPlace === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        disabled={taken}
                        onClick={() => {
                          setPickedPlace(p);
                          setEditingPlace(false);
                        }}
                        className={
                          taken
                            ? "h-10 rounded-lg border border-border bg-muted text-muted-foreground text-xs font-medium opacity-50 cursor-not-allowed"
                            : isPicked || isCurrent
                              ? "h-10 rounded-lg border border-primary bg-primary text-primary-foreground text-xs font-semibold"
                              : "h-10 rounded-lg border border-border bg-card text-xs font-semibold hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
                        }
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Upptagna platser är gråa. Nuvarande plats är markerad.
                </p>
              </div>
            )}
            {showPlacePicker && (
              <div className="space-y-2">
                <Label>Plats</Label>
                {place != null ? (
                  <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
                    <span className="text-sm">Plats <strong>{place}</strong></span>
                    <button
                      type="button"
                      onClick={() => setPickedPlace(null)}
                      className="text-xs text-muted-foreground hover:text-foreground underline"
                    >
                      Ändra
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-6 gap-1.5">
                      {availablePlaces!.map((p) => {
                        const taken = takenSet.has(p);
                        return (
                          <button
                            key={p}
                            type="button"
                            disabled={taken}
                            onClick={() => setPickedPlace(p)}
                            className={
                              taken
                                ? "h-10 rounded-lg border border-border bg-muted text-muted-foreground text-xs font-medium opacity-50 cursor-not-allowed"
                                : "h-10 rounded-lg border border-border bg-card text-xs font-semibold hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
                            }
                          >
                            {p}
                          </button>
                        );
                      })}
                    </div>
                    {onAddPlace && (
                      <div className="space-y-1 pt-1">
                        <div className="flex gap-2">
                          <Input
                            value={newPlaceLabel}
                            onChange={(e) => setNewPlaceLabel(e.target.value)}
                            placeholder="Ny plats t.ex. Stuga 1"
                            maxLength={60}
                            className="h-9"
                            onKeyDown={async (e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                const label = newPlaceLabel.trim();
                                if (!label || creatingPlace) return;
                                setCreatingPlace(true);
                                try {
                                  const created = await onAddPlace(label);
                                  setPickedPlace(created);
                                  setNewPlaceLabel("");
                                } catch {
                                  /* hook visar toast */
                                } finally {
                                  setCreatingPlace(false);
                                }
                              }
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={!newPlaceLabel.trim() || creatingPlace}
                            onClick={async () => {
                              const label = newPlaceLabel.trim();
                              if (!label) return;
                              setCreatingPlace(true);
                              try {
                                const created = await onAddPlace(label);
                                setPickedPlace(created);
                                setNewPlaceLabel("");
                              } catch {
                                /* hook visar toast */
                              } finally {
                                setCreatingPlace(false);
                              }
                            }}
                          >
                            Skapa
                          </Button>
                        </div>
                        <div
                          className={`text-[11px] text-right tabular-nums ${
                            newPlaceLabel.length >= 60
                              ? "text-destructive font-medium"
                              : newPlaceLabel.length >= 50
                                ? "text-amber-600"
                                : "text-muted-foreground"
                          }`}
                          aria-live="polite"
                        >
                          {newPlaceLabel.length} / 60 tecken
                        </div>
                      </div>
                    )}
                  </>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Du kan lämna platsen tom och välja den när gästen kommer.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Boende</Label>
              <div className="inline-flex w-full rounded-xl border border-border bg-muted p-0.5">
                <button
                  type="button"
                  onClick={() => setAccommodation("vehicle")}
                  className={cn(
                    "flex-1 h-9 rounded-lg text-sm font-medium transition-colors",
                    accommodation === "vehicle"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground",
                  )}
                >
                  Fordon
                </button>
                <button
                  type="button"
                  onClick={() => setAccommodation("tent")}
                  className={cn(
                    "flex-1 h-9 rounded-lg text-sm font-medium transition-colors",
                    accommodation === "tent"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground",
                  )}
                >
                  Tält
                </button>
              </div>
            </div>
            <div className={cn("grid gap-3", accommodation === "tent" ? "grid-cols-1" : "grid-cols-2")}>
              {accommodation !== "tent" && (
                <div className="space-y-1.5">
                  <Label htmlFor="reg">Reg.nummer</Label>
                  <Input id="reg" value={reg} onChange={(e) => setReg(e.target.value)} placeholder="ABC123" />
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Nationalitet</Label>
                <Popover open={natOpen} onOpenChange={setNatOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={natOpen}
                      className="w-full justify-between font-normal"
                    >
                      {nationality ? (
                        (() => {
                          const n = NATIONALITIES.find((x) => x.code === nationality);
                          const isOther = nationality === OTHER_CODE;
                          return (
                            <span className="flex items-center gap-2 truncate">
                              {!isOther && (
                                <img
                                  src={flagUrl(nationality)}
                                  alt=""
                                  loading="lazy"
                                  className="h-3.5 w-5 rounded-[2px] border border-border object-cover"
                                />
                              )}
                              {isOther
                                ? nationalityOther.trim() || "Övrigt"
                                : n?.label ?? nationality}
                              {!isOther && n?.plate && (
                                <span className="text-xs font-mono font-medium text-muted-foreground">
                                  ({n.plate})
                                </span>
                              )}
                            </span>
                          );
                        })()
                      ) : (
                        <span className="text-muted-foreground">Välj…</span>
                      )}
                      <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[--radix-popover-trigger-width] p-0 pointer-events-auto"
                    align="start"
                  >
                    <Command>
                      <CommandInput placeholder="Sök land…" />
                      <CommandList>
                        <CommandEmpty>Inget land hittades.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="ingen"
                            onSelect={() => {
                              setNationality("");
                              setNatOpen(false);
                            }}
                          >
                            <X className="h-4 w-4 mr-2 opacity-60" />
                            Ingen
                          </CommandItem>
                          {NATIONALITIES.map((n) => (
                            <CommandItem
                              key={n.code}
                              value={`${n.label} ${n.code} ${n.plate}`}
                              onSelect={() => {
                                setNationality(n.code);
                                setNatOpen(false);
                              }}
                            >
                              {n.code === OTHER_CODE ? (
                                <span className="h-3.5 w-5 mr-2 rounded-[2px] border border-border bg-muted flex items-center justify-center text-[9px] text-muted-foreground">
                                  ?
                                </span>
                              ) : (
                                <img
                                  src={flagUrl(n.code)}
                                  alt=""
                                  loading="lazy"
                                  className="h-3.5 w-5 mr-2 rounded-[2px] border border-border object-cover"
                                />
                              )}
                              <span className="flex-1">{n.label}</span>
                              {n.code !== OTHER_CODE && (
                                <span className="ml-2 text-xs font-mono font-medium text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                                  {n.plate}
                                </span>
                              )}
                              <Check
                                className={cn(
                                  "ml-2 h-4 w-4",
                                  nationality === n.code ? "opacity-100" : "opacity-0",
                                )}
                              />
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {nationality === OTHER_CODE && (
                  <Input
                    value={nationalityOther}
                    onChange={(e) => setNationalityOther(e.target.value)}
                    placeholder="Skriv land…"
                    className="mt-2"
                  />
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Anteckning</Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="T.ex. lugn gäst, husdjur…"
              />
            </div>
            {(() => {
              const today = todayLocal();
              const tomorrow = tomorrowLocal();
              const arrPresets = [
                { label: "Idag", value: today },
              ];
              const depPresets: Array<{ label: string; value: string }> = [
                { label: "1 natt", value: addDaysLocal(arrival || today, 1) },
                { label: "2 nätter", value: addDaysLocal(arrival || today, 2) },
                { label: "3 nätter", value: addDaysLocal(arrival || today, 3) },
                { label: "4 nätter", value: addDaysLocal(arrival || today, 4) },
                { label: "1 vecka", value: addDaysLocal(arrival || today, 7) },
              ];
              const chipBase =
                "px-2.5 h-7 rounded-full text-xs font-medium border transition-colors whitespace-nowrap";
              const chipActive = "bg-primary text-primary-foreground border-primary";
              const chipIdle = "bg-card text-muted-foreground border-border hover:bg-accent";
              return (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5 min-w-0">
                    <Label htmlFor="arr">Ankomst</Label>
                    <Input
                      id="arr"
                      type="date"
                      value={arrival}
                      onChange={(e) => setArrival(e.target.value)}
                      placeholder="ÅÅÅÅ-MM-DD"
                      className="input-datetime"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {arrPresets.map((p) => (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => {
                            setArrival(p.value);
                            if (departure <= p.value) {
                              setDeparture(addDaysLocal(p.value, 1));
                            }
                          }}
                          className={cn(chipBase, arrival === p.value ? chipActive : chipIdle)}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5 min-w-0">
                    <Label htmlFor="dep">Avresa</Label>
                    <Input
                      id="dep"
                      type="date"
                      value={departure}
                      onChange={(e) => setDeparture(e.target.value)}
                      placeholder="ÅÅÅÅ-MM-DD"
                      min={arrival || undefined}
                      aria-invalid={!!dateError}
                      aria-describedby={dateError ? "dep-error" : undefined}
                      className={cn(
                        "input-datetime",
                        dateError &&
                          "border-destructive focus-visible:ring-destructive bg-destructive/5",
                      )}
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {depPresets.map((p) => (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => setDeparture(p.value)}
                          className={cn(chipBase, departure === p.value ? chipActive : chipIdle)}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                    {dateError && (
                      <p
                        id="dep-error"
                        role="alert"
                        className="text-xs font-medium text-destructive"
                      >
                        {dateError}
                      </p>
                    )}
                  </div>
                </div>
              );
            })()}
            <div className={cn("grid gap-3", isCash ? "grid-cols-1" : "grid-cols-[1fr_110px]") }>
              <div className="space-y-1.5">
                <Label>Betalningsmetod</Label>
                <Select value={method} onValueChange={(v) => setMethod(v as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Välj…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ingen</SelectItem>
                    {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((m) => (
                      <SelectItem key={m} value={m}>
                        {PAYMENT_LABELS[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!isCash && (
                <div className="space-y-1.5">
                  <Label htmlFor="amt">Belopp (kr)</Label>
                  <Input
                    id="amt"
                    type="number"
                    inputMode="numeric"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
              )}
            </div>
            {isOther && (
              <div className="space-y-1.5">
                <Label htmlFor="other-note">Beskrivning av betalning</Label>
                <Input
                  id="other-note"
                  value={otherNote}
                  onChange={(e) => setOtherNote(e.target.value)}
                  placeholder="T.ex. faktura, presentkort…"
                  maxLength={120}
                />
              </div>
            )}
            {isCash && (
              <div className="grid grid-cols-[1fr_110px] gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="amt">Belopp</Label>
                  <Input
                    id="amt"
                    type="number"
                    inputMode="numeric"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Valuta</Label>
                  <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3 px-4 py-3 border-t border-border bg-card shrink-0 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="h-11">
              Avbryt
            </Button>
            <Button onClick={handleSave} disabled={saving || !!dateError} className="h-11">
              <Check className="h-4 w-4" />
              Spara
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Radera gäst?</AlertDialogTitle>
            <AlertDialogDescription>
              Detta tar bort gästen från plats {guest?.place_label}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (guest && onDelete) {
                  await onDelete(guest.id);
                  setConfirmDelete(false);
                  onOpenChange(false);
                }
              }}
            >
              Radera
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default EveningRoundModal;
