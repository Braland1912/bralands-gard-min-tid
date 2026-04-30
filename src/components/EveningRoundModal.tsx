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
import { Check, MoreVertical, Trash2 } from "lucide-react";
import {
  type EveningRoundGuest,
  type GuestInput,
  type PaymentMethod,
  type Currency,
  PAYMENT_LABELS,
} from "@/hooks/useEveningRoundGuests";

const CURRENCIES: Currency[] = ["SEK", "EUR", "NOK"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placeNumber: number | null;
  guest: EveningRoundGuest | null;
  defaultDate: string;
  onSave: (input: GuestInput) => Promise<unknown> | void;
  onDelete?: (id: string) => Promise<unknown> | void;
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

const EveningRoundModal = ({
  open,
  onOpenChange,
  placeNumber,
  guest,
  defaultDate,
  onSave,
  onDelete,
}: Props) => {
  const [name, setName] = useState("");
  const [reg, setReg] = useState("");
  const [notes, setNotes] = useState("");
  const [nationality, setNationality] = useState("");
  const [arrival, setArrival] = useState(defaultDate || todayLocal());
  const [departure, setDeparture] = useState(tomorrowLocal());
  const [method, setMethod] = useState<PaymentMethod | "none">("none");
  const [amount, setAmount] = useState<string>("");
  const [currency, setCurrency] = useState<Currency>("SEK");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (guest) {
      setName(guest.guest_name);
      setReg(guest.registration_number ?? "");
      setNotes(guest.notes ?? "");
      setNationality(guest.nationality ?? "");
      setArrival(guest.arrival_date);
      setDeparture(guest.departure_date);
      setMethod(guest.payment_method ?? "none");
      setAmount(guest.payment_amount != null ? String(guest.payment_amount) : "");
      setCurrency((guest.payment_currency as Currency) ?? "SEK");
    } else {
      setName("");
      setReg("");
      setNotes("");
      setNationality("");
      setArrival(defaultDate || todayLocal());
      setDeparture(tomorrowLocal());
      setMethod("none");
      setAmount("");
      setCurrency("SEK");
    }
    setError(null);
  }, [open, guest, defaultDate]);

  const place = guest?.place_number ?? placeNumber ?? null;
  const isCash = method === "K";

  const handleSave = async () => {
    setError(null);
    if (!name.trim()) {
      setError("Ange ett namn");
      return;
    }
    if (!arrival || !departure) {
      setError("Ange ankomst och avresa");
      return;
    }
    if (departure <= arrival) {
      setError("Avresa måste vara efter ankomst");
      return;
    }
    if (place == null) {
      setError("Saknar plats");
      return;
    }
    const amt = amount.trim() === "" ? null : Number(amount);
    if (amt != null && (Number.isNaN(amt) || amt < 0)) {
      setError("Ogiltigt belopp");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        place_number: place,
        guest_name: name.trim(),
        registration_number: reg.trim() || null,
        arrival_date: arrival,
        departure_date: departure,
        payment_method: method === "none" ? null : method,
        payment_amount: amt,
        notes: notes.trim() || null,
        nationality: nationality.trim() || null,
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <DialogTitle>{guest ? "Redigera gäst" : "Lägg till gäst"}</DialogTitle>
                <DialogDescription>{place != null ? `Plats ${place}` : ""}</DialogDescription>
              </div>
              {guest && onDelete && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="-mt-1 mr-6" aria-label="Mer">
                      <MoreVertical className="h-4 w-4" />
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

          <div className="space-y-4 rounded-xl bg-muted/40 p-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Namn</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="reg">Reg.nummer</Label>
                <Input id="reg" value={reg} onChange={(e) => setReg(e.target.value)} placeholder="ABC123" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nat">Nationalitet</Label>
                <Input
                  id="nat"
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value.toUpperCase().slice(0, 2))}
                  placeholder="SE"
                  maxLength={2}
                />
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="arr">Ankomst</Label>
                <Input
                  id="arr"
                  type="date"
                  value={arrival}
                  onChange={(e) => setArrival(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dep">Avresa</Label>
                <Input
                  id="dep"
                  type="date"
                  value={departure}
                  onChange={(e) => setDeparture(e.target.value)}
                />
              </div>
            </div>
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
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Avbryt
            </Button>
            <Button onClick={handleSave} disabled={saving}>
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
              Detta tar bort {guest?.guest_name} från plats {guest?.place_number}.
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
