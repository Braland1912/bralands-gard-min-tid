import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
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
import { CalendarPlus2, Check, ChevronDown, ChevronsUpDown, MapPin, MoreVertical, Pencil, Trash2, X } from "lucide-react";
import { STANDARD_PLACES } from "@/lib/place-label";
import {
  type EveningRoundGuest,
  type GuestInput,
  type GuestStatus,
  type PaymentMethod,
  type Currency,
  type AccommodationType,
  type VehicleType,
  PAYMENT_LABELS,
  VEHICLE_TYPE_LABELS,
} from "@/hooks/useEveningRoundGuests";

import { NATIONALITIES, OTHER_CODE, flagUrl, parseNationality } from "@/lib/nationalities";
import { computeStayPrice } from "@/lib/evening-round-pricing";

const PLACE_SUGGESTIONS = [
  "Vid solcellerna",
  "Vid lekplatsen",
  "Vid fotbollsplanen",
  "Vid lilla dasset",
  "Uppe vid jaktornet",
  "Nedanför jaktornet",
];

const NOTE_SUGGESTIONS = [
  "Husvagn",
  "Husbil",
  "Taktält",
  "Tält",
  "Bil",
  "MC",
  "Cyklister",
  "Vandrare",
  "Hund",
  "Barn",
  "Frågor om paddling",
  "Frågor om fiske",
];

/**
 * Lägg till ett förslag i slutet av befintlig text istället för att skriva
 * över den. Använder kommaseparator för anteckningar (flera taggar), mellan-
 * slag för platsetiketter. Hoppar över om förslaget redan finns.
 */
const appendSuggestion = (
  current: string,
  suggestion: string,
  opts: { maxLen?: number; separator?: string } = {},
): string => {
  const { maxLen = 60, separator = " " } = opts;
  const base = current.trim();
  if (!base) return suggestion.slice(0, maxLen);
  const lowerBase = base.toLowerCase();
  if (lowerBase.includes(suggestion.toLowerCase())) return base;
  const sep = /[,–\-]\s*$/.test(base) ? " " : separator;
  return `${base}${sep}${suggestion}`.slice(0, maxLen);
};

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
  /** Extra (tillfälliga) platser för denna runda. */
  extraPlaces?: { id: string; label: string }[];
  /** Skapa en ny extra plats (namngiven). Returnerar etiketten som skapades. */
  onAddPlace?: (label: string) => Promise<string>;
  /** Byt namn på en extra plats. */
  onRenamePlace?: (id: string, newLabel: string) => Promise<unknown>;
  /** Ta bort en extra plats (gästens platsetikett nollas). */
  onDeletePlace?: (id: string) => Promise<unknown>;
  /** Öppna förläng-flödet för befintlig gäst. */
  onExtend?: (guest: EveningRoundGuest) => void;
  /**
   * Specialläge:
   * - `prepaid`: registrera gäst som betalat i förväg, utan plats
   * - `temporary`: skapa en tillfällig plats (tält/fordon på gräs)
   * - `normal` (default): vanligt flöde med platsval
   */
  mode?: "normal" | "prepaid" | "temporary";
  /** Omatchade förbetalda gäster (utan plats) — visas i temporary-läget för snabb tilldelning. */
  prepaidGuests?: EveningRoundGuest[];
  /**
   * Anropas när användaren tilldelar en förbetald gäst i temporary-vyn.
   * Får gästens id och den beskrivning som är ifylld i formuläret.
   */
  onAssignPrepaidTemporary?: (guestId: string, tempDescription: string) => Promise<unknown> | unknown;
  /** Öppna direkt med platsväljaren expanderad (för befintliga gäster utan plats, t.ex. från header-flödet). */
  autoExpandPlacePicker?: boolean;
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
  extraPlaces,
  onAddPlace,
  onRenamePlace,
  onDeletePlace,
  onExtend,
  mode = "normal",
  prepaidGuests: _prepaidGuests = [],
  onAssignPrepaidTemporary: _onAssignPrepaidTemporary,
  autoExpandPlacePicker = false,
}: Props) => {
  const [status, setStatus] = useState<GuestStatus>("here");
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
  const [unpaidReason, setUnpaidReason] = useState<string>("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newPlaceLabel, setNewPlaceLabel] = useState("");
  const [creatingPlace, setCreatingPlace] = useState(false);
  const [accommodation, setAccommodation] = useState<AccommodationType>("vehicle");
  const [editingPlace, setEditingPlace] = useState(false);
  const [placeCleared, setPlaceCleared] = useState(false);

  const [tempDescription, setTempDescription] = useState("");
  const [vehicleType, setVehicleType] = useState<VehicleType>("motorhome");
  const [hasElectricity, setHasElectricity] = useState<boolean>(true);
  const [trailerReg, setTrailerReg] = useState("");
  const [tentPersons, setTentPersons] = useState<number>(2);


  useEffect(() => {
    if (!open) return;
    setPickedPlace(null);
    // Expandera platsväljaren direkt när vi öppnar en befintlig gäst utan plats via header-flödet.
    setEditingPlace(autoExpandPlacePicker && !!guest && guest.place_label == null);
    setPlaceCleared(false);
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
      setOtherNote(guest.payment_method === "O" ? (guest.payment_other_note ?? "") : "");
      setUnpaidReason(!guest.payment_method ? (guest.payment_other_note ?? "") : "");
      setAccommodation(mode === "temporary" ? "temporary" : ((guest.accommodation_type as AccommodationType) ?? "vehicle"));
      setStatus(guest.status);
      setTempDescription(guest.temp_description ?? "");
      setVehicleType((guest.vehicle_type as VehicleType) ?? "motorhome");
      setHasElectricity(guest.has_electricity ?? true);
      setTrailerReg(guest.trailer_registration ?? "");
      setTentPersons(guest.tent_persons ?? 2);

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
      setUnpaidReason("");
      setAccommodation(mode === "temporary" ? "temporary" : "vehicle");
      setStatus("here");
      setTempDescription("");
      setVehicleType("motorhome");
      setHasElectricity(true);
      setTrailerReg("");
      setTentPersons(2);

    }
    setError(null);
  }, [open, guest, defaultDate, mode, autoExpandPlacePicker]);

  // I prepaid/temporary-läge skippas hela platsväljaren – gästen sparas utan plats.
  const skipPlacePicker = mode === "prepaid" || mode === "temporary";

  const place = placeCleared
    ? null
    : skipPlacePicker
      ? null
      : pickedPlace ?? guest?.place_label ?? placeLabel ?? null;
  const hasPlaceOptions = Array.isArray(availablePlaces) && availablePlaces.length > 0 && !skipPlacePicker;
  const showPlacePicker = place == null && hasPlaceOptions && !guest && !editingPlace;
  const canEditPlace = !!guest && hasPlaceOptions;
  const showEditPlacePicker = editingPlace && hasPlaceOptions;
  const takenSet = new Set(
    (takenPlaces ?? []).filter((p) => !guest || p !== guest.place_label),
  );
  // Dela upp i standardplatser (1–21, E1–E6) och extra/tillfälliga platser.
  const standardSet = new Set<string>(STANDARD_PLACES);
  const standardList = (availablePlaces ?? []).filter((p) => standardSet.has(p));
  const extrasList: { id: string; label: string }[] = extraPlaces
    ? extraPlaces
    : (availablePlaces ?? [])
        .filter((p) => !standardSet.has(p))
        .map((label) => ({ id: label, label }));

  const handleRenameExtra = async (id: string, currentLabel: string) => {
    if (!onRenamePlace) return;
    const next = window.prompt("Byt namn på platsen", currentLabel);
    if (next == null) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === currentLabel) return;
    try {
      await onRenamePlace(id, trimmed);
      if (pickedPlace === currentLabel) setPickedPlace(trimmed);
    } catch {
      /* hook visar toast */
    }
  };
  const handleDeleteExtra = async (id: string, currentLabel: string) => {
    if (!onDeletePlace) return;
    if (!window.confirm(`Ta bort platsen "${currentLabel}"? Kopplade gäster behåller sin info men förlorar platsetiketten.`)) return;
    try {
      await onDeletePlace(id);
      if (pickedPlace === currentLabel) {
        setPickedPlace(null);
        setPlaceCleared(true);
      }
    } catch {
      /* hook visar toast */
    }
  };
  const isCash = method === "K";
  const isOther = method === "O";

  // Boende-väljaren visas när ingen fast plats är vald (skapande av ny plats
  // eller specialläge). I `temporary`-läge är boendet låst till "temporary".
  const showAccommodationPicker = !place && mode !== "temporary";
  const isTemporary = accommodation === "temporary" || mode === "temporary";
  const effectiveAccommodation: AccommodationType = isTemporary
    ? "temporary"
    : showAccommodationPicker
      ? accommodation
      : "vehicle";

  // På fasta platser är boendet alltid fordon – tvinga state till "vehicle"
  // så att Spara skickar rätt värde även om användaren tidigare valt tält.
  useEffect(() => {
    if (place && accommodation !== "vehicle" && mode === "normal") {
      setAccommodation("vehicle");
    }
  }, [place, accommodation, mode]);

  // Live-validering av datum: visa fel direkt när avresa är samma dag som ankomst
  // eller tidigare. Tomma fält flaggas inte här (de fångas vid spara).
  const dateError: string | null =
    arrival && departure && departure <= arrival
      ? departure === arrival
        ? "Avresa måste vara minst en natt efter ankomst"
        : "Avresa kan inte vara före ankomst"
      : null;

  const handleSave = async () => {
    const fail = (msg: string) => {
      setError(msg);
      toast.error(msg);
    };
    setError(null);
    if (!arrival || !departure) {
      fail("Ange ankomst och avresa");
      return;
    }
    if (departure <= arrival) {
      fail("Avresa måste vara efter ankomst");
      return;
    }
    // I prepaid/temporary-läge är platsen avsiktligen tom – hoppa över platsvalidering
    if (!skipPlacePicker && place == null && !hasPlaceOptions) {
      fail("Välj en plats");
      return;
    }
    if (!skipPlacePicker && guest && place == null && status === "here" && effectiveAccommodation !== "temporary") {
      fail("Välj en plats för att markera som på plats");
      if (hasPlaceOptions) setEditingPlace(true);
      return;
    }
    if (effectiveAccommodation === "temporary" && !tempDescription.trim()) {
      fail("Beskriv den tillfälliga platsen (t.ex. gult tält vid lekplatsen)");
      return;
    }
    const amt = amount.trim() === "" ? null : Number(amount);
    if (amt != null && (Number.isNaN(amt) || amt < 0)) {
      fail("Ogiltigt belopp");
      return;
    }
    if (isOther && !otherNote.trim()) {
      fail("Beskriv betalningsmetoden");
      return;
    }
    if (method === "none" && !unpaidReason.trim()) {
      fail("Ange varför ingen betalning skett");
      return;
    }
    // Ej betalt får bara kombineras med "ej här" om det är en reservation
    // (ankomst i framtiden). Annars måste betalning registreras.
    // Förbetalda gäster (mode=prepaid) räknas alltid som "ej här" tills plats tilldelas.
    const effectiveStatus: GuestStatus = !guest
      ? (place == null || effectiveAccommodation === "temporary")
        ? (effectiveAccommodation === "temporary" ? "here" : "not_here")
        : "here"
      : placeCleared
        ? "not_here"
        : status;
    if (
      method === "none" &&
      effectiveStatus === "not_here" &&
      arrival <= todayLocal() &&
      mode !== "prepaid"
    ) {
      fail("Ej betalt + ej här går bara för reservationer (ankomst i framtiden)");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        place_label: place,
        guest_name: name.trim(),
        registration_number: effectiveAccommodation === "tent" ? null : (reg.trim() || null),
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
        payment_other_note: isOther
          ? otherNote.trim()
          : method === "none"
            ? unpaidReason.trim()
            : null,
        accommodation_type: effectiveAccommodation,
        temp_description: effectiveAccommodation === "temporary" ? tempDescription.trim() : null,
        vehicle_type: effectiveAccommodation === "vehicle" ? vehicleType : null,
        trailer_registration:
          effectiveAccommodation === "vehicle" && vehicleType === "caravan"
            ? (trailerReg.trim() || null)
            : null,
        has_electricity: effectiveAccommodation === "vehicle" ? hasElectricity : null,
        tent_persons: effectiveAccommodation === "tent" ? tentPersons : null,

        ...(!guest && mode === "prepaid" ? { is_prepaid: true } : {}),
        ...(!guest
          ? { status: effectiveStatus }
          : placeCleared
            ? { status: "not_here" as const }
            : { status }),
      });
      onOpenChange(false);
    } catch (e: any) {
      const msg = e?.message ?? "Kunde inte spara";
      setError(msg);
      toast.error(msg);
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
                <DialogTitle>
                  {guest
                    ? "Redigera gäst"
                    : mode === "prepaid"
                      ? "Förbetald gäst"
                      : mode === "temporary"
                        ? "Tillfällig plats"
                        : "Lägg till gäst"}
                </DialogTitle>
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
                            setPlaceCleared(false);
                          }}
                          className="text-xs text-primary underline underline-offset-2"
                        >
                          Ändra plats
                        </button>
                      )}
                    </span>
                  ) : guest && place == null && !editingPlace ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {placeCleared ? "Ingen plats · markeras som ej kommit" : "Ingen plats vald"}
                      </span>
                      {hasPlaceOptions && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPlace(true);
                            setPickedPlace(null);
                            setPlaceCleared(false);
                          }}
                          className="text-xs text-primary underline underline-offset-2"
                        >
                          Välj plats
                        </button>
                      )}
                    </span>

                  ) : showPlacePicker || showEditPlacePicker ? (
                    autoExpandPlacePicker ? "" : "Välj plats (valfritt – kan väljas senare)"
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
            {guest && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</Label>
                <div className={`grid ${onExtend ? "grid-cols-3" : "grid-cols-2"} gap-1.5`}>
                  <button
                    type="button"
                    onClick={() => {
                      if (place == null) {
                        const msg = "Välj en plats för att markera som på plats";
                        setError(msg);
                        toast.error(msg);
                        if (hasPlaceOptions) setEditingPlace(true);
                        return;
                      }
                      setError(null);
                      setStatus("here");
                    }}
                    aria-pressed={status === "here"}
                    className={cn(
                      "h-10 px-2 rounded-lg border text-sm font-medium inline-flex items-center justify-center gap-1.5 transition-colors",
                      status === "here"
                        ? "border-emerald-600 text-emerald-700 bg-emerald-50"
                        : "border-border text-muted-foreground hover:bg-accent",
                    )}
                  >
                    <Check className="h-4 w-4" />
                    På plats
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus("not_here")}
                    aria-pressed={status === "not_here"}
                    className={cn(
                      "h-10 px-2 rounded-lg border text-sm font-medium inline-flex items-center justify-center gap-1.5 transition-colors",
                      status === "not_here"
                        ? "border-destructive text-destructive bg-destructive/10"
                        : "border-border text-muted-foreground hover:bg-accent",
                    )}
                  >
                    <X className="h-4 w-4" />
                    Ej kommit
                  </button>
                  {onExtend && (
                    <button
                      type="button"
                      onClick={() => {
                        onExtend(guest);
                        onOpenChange(false);
                      }}
                      className="h-10 px-2 rounded-lg border border-border text-sm font-medium inline-flex items-center justify-center gap-1.5 text-muted-foreground hover:bg-accent transition-colors"
                    >
                      <CalendarPlus2 className="h-4 w-4" />
                      Förläng
                    </button>
                  )}
                </div>
              </div>
            )}

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
                  {standardList.map((p) => {
                    const taken = takenSet.has(p);
                    const current = (pickedPlace ?? (guest?.place_label && !placeCleared ? guest.place_label : "")) === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        disabled={taken && !current}
                        onClick={() => {
                          setPickedPlace(p);
                          setPlaceCleared(false);
                          setEditingPlace(false);
                          setStatus("here");
                          setError(null);
                        }}
                        className={`h-10 rounded-lg border text-sm font-semibold transition-colors ${
                          current
                            ? "border-primary bg-primary text-primary-foreground"
                            : taken
                              ? "border-border bg-muted text-muted-foreground/50 cursor-not-allowed"
                              : "border-border bg-card text-foreground hover:bg-accent"
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
                {extrasList.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Tillfälliga platser
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {extrasList.map((ep) => {
                        const taken = takenSet.has(ep.label);
                        const current = (pickedPlace ?? (guest?.place_label && !placeCleared ? guest.place_label : "")) === ep.label;
                        const selectable = !taken || current;
                        return (
                          <div
                            key={ep.id}
                            className={`inline-flex items-center rounded-full border text-xs font-medium overflow-hidden transition-colors ${
                              current
                                ? "border-primary bg-primary text-primary-foreground"
                                : taken
                                  ? "border-border bg-muted text-muted-foreground/50"
                                  : "border-border bg-card text-foreground"
                            }`}
                          >
                            <button
                              type="button"
                              disabled={!selectable}
                              onClick={() => {
                                setPickedPlace(ep.label);
                                setPlaceCleared(false);
                                setEditingPlace(false);
                                setStatus("here");
                                setError(null);
                              }}
                              className={`h-9 pl-3 pr-2 inline-flex items-center ${
                                selectable ? "hover:opacity-90" : "cursor-not-allowed"
                              }`}
                            >
                              {ep.label}
                            </button>
                            {onRenamePlace && (
                              <button
                                type="button"
                                onClick={() => handleRenameExtra(ep.id, ep.label)}
                                className={`h-9 w-8 grid place-items-center border-l ${
                                  current ? "border-primary-foreground/30 text-primary-foreground/80 hover:text-primary-foreground" : "border-border/60 text-muted-foreground hover:text-foreground"
                                }`}
                                aria-label={`Byt namn på ${ep.label}`}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {onDeletePlace && (
                              <button
                                type="button"
                                onClick={() => handleDeleteExtra(ep.id, ep.label)}
                                className={`h-9 w-8 grid place-items-center border-l ${
                                  current ? "border-primary-foreground/30 text-primary-foreground/80 hover:text-primary-foreground" : "border-border/60 text-destructive/80 hover:text-destructive"
                                }`}
                                aria-label={`Ta bort ${ep.label}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setPickedPlace(null);
                    setPlaceCleared(true);
                    setEditingPlace(false);
                  }}
                  className="w-full h-10 rounded-lg border border-dashed border-border bg-card text-sm font-medium text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
                >
                  Ingen plats (markera som ej kommit)
                </button>
                {onAddPlace && (
                  <div className="space-y-1 pt-1">
                    <div className="flex flex-wrap gap-1.5">
                      {PLACE_SUGGESTIONS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setNewPlaceLabel((prev) => appendSuggestion(prev, s))}
                          className="h-7 px-2.5 rounded-full border border-border bg-card text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        value={newPlaceLabel}
                        onChange={(e) => setNewPlaceLabel(e.target.value)}
                        placeholder="T.ex. gult litet tält, husbil, vit bil…"
                        maxLength={60}
                        className="h-10 flex-1 text-sm"
                        onKeyDown={async (e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const label = newPlaceLabel.trim();
                            if (!label || creatingPlace) return;
                            setCreatingPlace(true);
                            try {
                              const created = await onAddPlace(label);
                              setPickedPlace(created);
                              setPlaceCleared(false);
                              setEditingPlace(false);
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
                        className="h-10 sm:w-auto w-full"
                        disabled={!newPlaceLabel.trim() || creatingPlace}
                        onClick={async () => {
                          const label = newPlaceLabel.trim();
                          if (!label) return;
                          setCreatingPlace(true);
                          try {
                            const created = await onAddPlace(label);
                            setPickedPlace(created);
                            setPlaceCleared(false);
                            setEditingPlace(false);
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
                <p className="text-[11px] text-muted-foreground">
                  Upptagna platser är gråa. Nuvarande plats är markerad.
                </p>
              </div>
            )}
            {showPlacePicker && (
              <div className="space-y-2">
                <Label>Plats</Label>
                {!autoExpandPlacePicker && (
                  <p className="text-[11px] text-muted-foreground">
                    Du kan lämna platsen tom och fylla i den senare – antingen när gästen kommer, eller när du hittar dem ute på fältet under rundan efter att betalningen är registrerad.
                  </p>
                )}
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
                      {standardList.map((p) => {
                        const taken = takenSet.has(p);
                        return (
                          <button
                            key={p}
                            type="button"
                            disabled={taken}
                            onClick={() => { setPickedPlace(p); setStatus("here"); setError(null); }}
                            className={`h-10 rounded-lg border text-sm font-semibold transition-colors ${
                              taken
                                ? "border-border bg-muted text-muted-foreground/50 cursor-not-allowed"
                                : "border-border bg-card text-foreground hover:bg-accent"
                            }`}
                          >
                            {p}
                          </button>
                        );
                      })}
                    </div>
                    {extrasList.length > 0 && (
                      <div className="space-y-1.5 mt-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Tillfälliga platser
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {extrasList.map((ep) => {
                            const taken = takenSet.has(ep.label);
                            return (
                              <div
                                key={ep.id}
                                className={`inline-flex items-center rounded-full border text-xs font-medium overflow-hidden ${
                                  taken
                                    ? "border-border bg-muted text-muted-foreground/50"
                                    : "border-border bg-card text-foreground"
                                }`}
                              >
                                <button
                                  type="button"
                                  disabled={taken}
                                  onClick={() => { setPickedPlace(ep.label); setStatus("here"); setError(null); }}
                                  className={`h-9 pl-3 pr-2 inline-flex items-center ${
                                    taken ? "cursor-not-allowed" : "hover:opacity-90"
                                  }`}
                                >
                                  {ep.label}
                                </button>
                                {onRenamePlace && (
                                  <button
                                    type="button"
                                    onClick={() => handleRenameExtra(ep.id, ep.label)}
                                    className="h-9 w-8 grid place-items-center border-l border-border/60 text-muted-foreground hover:text-foreground"
                                    aria-label={`Byt namn på ${ep.label}`}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                )}
                                {onDeletePlace && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteExtra(ep.id, ep.label)}
                                    className="h-9 w-8 grid place-items-center border-l border-border/60 text-destructive/80 hover:text-destructive"
                                    aria-label={`Ta bort ${ep.label}`}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {onAddPlace && (
                      <div className="rounded-xl border border-border bg-muted/40 p-3 space-y-2 mt-2">
                        <div className="text-xs font-semibold text-foreground">
                          Skapa ny plats
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Input
                            value={newPlaceLabel}
                            onChange={(e) => setNewPlaceLabel(e.target.value)}
                            placeholder="T.ex. gult litet tält, husbil, vit bil…"
                            maxLength={60}
                            className="h-10 flex-1 text-sm"
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
                            className="h-10 sm:w-auto w-full"
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
                        <div className="flex flex-wrap gap-1.5">
                          {PLACE_SUGGESTIONS.map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setNewPlaceLabel((prev) => appendSuggestion(prev, s))}
                              className="h-7 px-2.5 rounded-full border border-border bg-card text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {showAccommodationPicker && (
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
            )}
            {effectiveAccommodation === "vehicle" && (
              <div className="space-y-1.5">
                <Label>Fordonstyp</Label>
                <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-border bg-muted p-0.5">
                  {(["motorhome", "car", "caravan"] as VehicleType[]).map((vt) => (
                    <button
                      key={vt}
                      type="button"
                      onClick={() => setVehicleType(vt)}
                      className={cn(
                        "h-9 rounded-lg text-sm font-medium transition-colors",
                        vehicleType === vt
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground",
                      )}
                    >
                      {VEHICLE_TYPE_LABELS[vt]}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {effectiveAccommodation === "vehicle" && (
              <div className="space-y-1.5">
                <Label>El</Label>
                <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-border bg-muted p-0.5">
                  <button
                    type="button"
                    onClick={() => setHasElectricity(true)}
                    className={cn(
                      "h-9 rounded-lg text-sm font-medium transition-colors",
                      hasElectricity
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground",
                    )}
                  >
                    Med el
                  </button>
                  <button
                    type="button"
                    onClick={() => setHasElectricity(false)}
                    className={cn(
                      "h-9 rounded-lg text-sm font-medium transition-colors",
                      !hasElectricity
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground",
                    )}
                  >
                    Utan el
                  </button>
                </div>
              </div>
            )}
            {effectiveAccommodation === "tent" && (
              <div className="space-y-1.5">
                <Label htmlFor="tent-persons">Antal personer</Label>
                <Input
                  id="tent-persons"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={20}
                  value={tentPersons}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setTentPersons(Number.isFinite(v) && v > 0 ? v : 1);
                  }}
                  className="bg-card"
                />
              </div>
            )}
            <div className={cn("grid gap-3", (effectiveAccommodation === "tent" || effectiveAccommodation === "temporary") ? "grid-cols-1" : "grid-cols-2")}>
              {effectiveAccommodation !== "tent" && effectiveAccommodation !== "temporary" && (
                <div className="space-y-1.5">
                  <Label htmlFor="reg">
                    {vehicleType === "caravan" ? "Reg.nr dragbil" : "Reg.nummer"}
                  </Label>
                  <Input id="reg" value={reg} onChange={(e) => setReg(e.target.value)} placeholder="ABC123" />
                </div>
              )}
              {effectiveAccommodation === "vehicle" && vehicleType === "caravan" && (
                <div className="space-y-1.5">
                  <Label htmlFor="trailer-reg">Reg.nr husvagn</Label>
                  <Input
                    id="trailer-reg"
                    value={trailerReg}
                    onChange={(e) => setTrailerReg(e.target.value)}
                    placeholder="XYZ789"
                  />
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
              <div className="rounded-xl border border-border bg-muted/40 p-3 space-y-2">
                {mode !== "prepaid" && (
                  <div className="text-xs font-semibold text-foreground">
                    Beskriv sällskapet
                    {effectiveAccommodation === "tent" && (
                      <span className="block font-normal text-muted-foreground mt-0.5">
                        Beskriv tältet med färg och storlek. T.ex. hund, cyklister, vandrare, barn, frågar om paddling/fiske…
                      </span>
                    )}
                    {effectiveAccommodation === "vehicle" && vehicleType === "motorhome" && (
                      <span className="block font-normal text-muted-foreground mt-0.5">
                        Beskriv husbilen med färg och storlek. T.ex. hund, barn, frågar om paddling/fiske…
                      </span>
                    )}
                    {effectiveAccommodation === "vehicle" && vehicleType === "car" && (
                      <span className="block font-normal text-muted-foreground mt-0.5">
                        Beskriv bilen med färg och storlek. T.ex. hund, barn, frågar om paddling/fiske…
                      </span>
                    )}
                    {effectiveAccommodation === "vehicle" && vehicleType === "caravan" && (
                      <span className="block font-normal text-muted-foreground mt-0.5">
                        Beskriv husvagnen med färg och storlek. T.ex. hund, barn, frågar om paddling/fiske…
                      </span>
                    )}
                  </div>
                )}
                {mode !== "prepaid" && (
                  <div className="flex flex-wrap gap-1.5">
                    {NOTE_SUGGESTIONS.filter((s) => {
                      if (effectiveAccommodation === "tent" && (s === "Husvagn" || s === "Husbil" || s === "Taktält" || s === "MC")) return false;
                      if (effectiveAccommodation === "vehicle" && (s === "Husvagn" || s === "Husbil" || s === "MC")) return false;
                      if (effectiveAccommodation === "vehicle" && vehicleType === "motorhome" && (s === "Taktält" || s === "Tält" || s === "Bil" || s === "Cyklister" || s === "Vandrare")) return false;
                      if (effectiveAccommodation === "vehicle" && vehicleType === "car" && (s === "Bil" || s === "Cyklister" || s === "Vandrare")) return false;
                      if (effectiveAccommodation === "vehicle" && vehicleType === "caravan" && (s === "Taktält" || s === "Tält" || s === "Bil" || s === "Cyklister" || s === "Vandrare")) return false;
                      return true;
                    }).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setNotes((prev) => appendSuggestion(prev, s, { maxLen: 500, separator: ", " }))}
                        className="h-7 px-2.5 rounded-full border border-border bg-card text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={
                    mode === "prepaid"
                      ? "T.ex. meddelande från gästen via Campio…"
                      : effectiveAccommodation === "tent"
                      ? "T.ex. hund, cyklister, vandrare, barn, frågar om paddling/fiske…"
                      : effectiveAccommodation === "vehicle"
                      ? "T.ex. hund, barn, frågar om paddling/fiske…"
                      : "T.ex. husvagn, husbil, taktält, hund, cyklister, vandrare, MC, barn, frågar om paddling/fiske…"
                  }
                  rows={4}
                  className="min-h-[96px] resize-y bg-card"
                />
              </div>
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
            <div className="space-y-1.5">
              <Label>Betalning</Label>
              <div className="rounded-xl border border-border bg-muted/40 p-3 space-y-3">
                <div className={cn("grid gap-3", isCash ? "grid-cols-1" : "grid-cols-[1fr_110px]") }>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Betalningsmetod</Label>
                    <Select
                      value={method}
                      onValueChange={(v) => {
                        const next = v as PaymentMethod | "none";
                        setMethod(next);
                        if (next !== "none" && currency === "SEK" && !amount.trim()) {
                          const suggested = computeStayPrice({
                            arrival,
                            departure,
                            accommodation: effectiveAccommodation === "tent" ? "tent" : "vehicle",
                            hasElectricity,
                            tentPersons,
                          });
                          if (suggested && (effectiveAccommodation === "tent" || effectiveAccommodation === "vehicle")) {
                            setAmount(String(suggested));
                          }
                        }
                      }}
                    >
                      <SelectTrigger className="bg-card">
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
                      <Label htmlFor="amt" className="text-xs font-semibold">Belopp (kr)</Label>
                      <Input
                        id="amt"
                        type="number"
                        inputMode="numeric"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="bg-card"
                      />
                    </div>
                  )}
                </div>
                {isOther && (
                  <div className="space-y-1.5">
                    <Label htmlFor="other-note" className="text-xs font-semibold">Beskrivning av betalning</Label>
                    <Input
                      id="other-note"
                      value={otherNote}
                      onChange={(e) => setOtherNote(e.target.value)}
                      placeholder="T.ex. faktura, presentkort…"
                      maxLength={120}
                      className="bg-card"
                    />
                  </div>
                )}
                {method === "none" && mode !== "prepaid" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="unpaid-reason" className="text-xs font-semibold">Varför ingen betalning?</Label>
                    <Input
                      id="unpaid-reason"
                      value={unpaidReason}
                      onChange={(e) => setUnpaidReason(e.target.value)}
                      placeholder="T.ex. var ej där, har ej kommit, ville inte…"
                      maxLength={160}
                      className="bg-card"
                    />
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {["Var ej där", "Har ej kommit, bara reserverat", "Ville inte av någon anledning"].map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setUnpaidReason(r)}
                          className="h-7 px-2.5 rounded-full border border-border bg-card text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {isCash && (
                  <div className="grid grid-cols-[1fr_110px] gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="amt" className="text-xs font-semibold">Belopp</Label>
                      <Input
                        id="amt"
                        type="number"
                        inputMode="numeric"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="bg-card"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Valuta</Label>
                      <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                        <SelectTrigger className="bg-card">
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
              </div>
            </div>
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
