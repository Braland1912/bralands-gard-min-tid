import { Check, LogOut, MoreVertical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  type EveningRoundGuest,
  type GuestStatus,
  PAYMENT_LABELS,
} from "@/hooks/useEveningRoundGuests";

interface Props {
  guest: EveningRoundGuest;
  onStatusChange: (id: string, status: GuestStatus) => void;
  onEdit: (guest: EveningRoundGuest) => void;
}

const formatDate = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${parseInt(d, 10)}/${parseInt(m, 10)}`;
};

const statusColors: Record<GuestStatus, string> = {
  here: "text-emerald-600",
  checked_out: "text-amber-600",
  not_here: "text-destructive",
};
const statusLabels: Record<GuestStatus, string> = {
  here: "Här",
  checked_out: "Utcheckad",
  not_here: "Inte här",
};

const EveningRoundCard = ({ guest, onStatusChange, onEdit }: Props) => {
  const isUnpaid = !guest.payment_method || !guest.payment_amount;

  const StatusBtn = ({
    s,
    Icon,
    label,
  }: {
    s: GuestStatus;
    Icon: typeof Check;
    label: string;
  }) => {
    const active = guest.status === s;
    return (
      <button
        type="button"
        onClick={() => onStatusChange(guest.id, s)}
        aria-label={label}
        aria-pressed={active}
        className={`h-9 w-9 rounded-xl border flex items-center justify-center transition-colors ${
          active
            ? `${statusColors[s]} border-current bg-current/10`
            : "text-muted-foreground border-border hover:bg-accent"
        }`}
      >
        <Icon className="h-4 w-4" />
      </button>
    );
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-medium text-muted-foreground">Plats {guest.place_number}</div>
          <div className="text-base font-semibold leading-tight">{guest.guest_name}</div>
          {guest.registration_number && (
            <div className="text-xs text-muted-foreground mt-0.5">
              Reg.nr: {guest.registration_number}
            </div>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={() => onEdit(guest)} aria-label="Redigera">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <StatusBtn s="here" Icon={Check} label="Här" />
        <StatusBtn s="checked_out" Icon={LogOut} label="Utcheckad" />
        <StatusBtn s="not_here" Icon={X} label="Inte här" />
        <span className={`text-sm font-medium ${statusColors[guest.status]}`}>
          {statusLabels[guest.status]}
        </span>
      </div>

      <div className="text-sm text-muted-foreground">
        Ankomst/Avresa: {formatDate(guest.arrival_date)} → {formatDate(guest.departure_date)}
      </div>

      <div>
        {isUnpaid ? (
          <Badge variant="destructive">EJ BETALT</Badge>
        ) : (
          <div className="text-sm font-medium">
            {PAYMENT_LABELS[guest.payment_method!]} • {guest.payment_amount} kr
          </div>
        )}
      </div>
    </div>
  );
};

export default EveningRoundCard;
